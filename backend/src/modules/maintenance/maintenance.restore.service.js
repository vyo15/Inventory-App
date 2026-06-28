const fs = require("fs");
const path = require("path");
const {
  closeDb,
  getDb,
  getDbPath,
  runSerializedDbOperation,
} = require("../../db/connection");
const env = require("../../config/env");
const { createAuditLog } = require("../../utils/auditLog");
const { getRequestContext } = require("../../middlewares/requestContext");
const { broadcastDatabaseReplacement } = require("../realtime/realtime.service");
const { runMigrations } = require("../../db/migrate");
const {
  RESTORE_CONFIRM_KEYWORD,
  createOfficialSqliteBackup,
  enrichBackupLog,
  extractBackupDatabaseToTemp,
  getBackupPreview,
  normalizeBackupFilename,
} = require("./backup");
const { runDatabaseIntegrityChecks } = require("./maintenance.dataQuality.service");
const { createHttpError } = require("./maintenance.shared");

const removeSqliteRuntimeSidecars = (dbPath) => {
  for (const suffix of ["-wal", "-shm"]) {
    const sidecarPath = `${dbPath}${suffix}`;
    if (fs.existsSync(sidecarPath)) fs.rmSync(sidecarPath, { force: true });
  }
};

const createRestoreSiblingPath = (activeDbPath, label) => {
  const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  return `${activeDbPath}.${label}-${suffix}`;
};

const replaceActiveDatabaseWithCandidate = ({ activeDbPath, candidatePath, swapPath }) => {
  const hadActiveDb = fs.existsSync(activeDbPath);

  if (hadActiveDb) {
    fs.renameSync(activeDbPath, swapPath);
  }

  try {
    fs.renameSync(candidatePath, activeDbPath);
  } catch (error) {
    if (hadActiveDb && fs.existsSync(swapPath) && !fs.existsSync(activeDbPath)) {
      fs.renameSync(swapPath, activeDbPath);
    }
    throw error;
  }

  return { hadActiveDb };
};

const restoreActiveDatabaseFromSwap = ({ activeDbPath, swapPath, hadActiveDb }) => {
  if (!hadActiveDb || !fs.existsSync(swapPath)) {
    return false;
  }

  fs.rmSync(activeDbPath, { force: true });
  removeSqliteRuntimeSidecars(activeDbPath);
  fs.renameSync(swapPath, activeDbPath);
  removeSqliteRuntimeSidecars(activeDbPath);
  return true;
};

const getActiveDbValidation = async (db) => {
  const { foreignKeyRows, integrityCheck, valid } = await runDatabaseIntegrityChecks(db);

  return {
    integrityCheck,
    foreignKeyCheck: foreignKeyRows.length ? `${foreignKeyRows.length} issue(s)` : "ok",
    valid,
  };
};

const registerRestoredBackupLog = async (db, backup, { status = "verified" } = {}) => {
  if (!backup?.filename || !backup?.path) return null;

  const existing = await db.get(
    "SELECT * FROM backup_logs WHERE filename = ? AND path = ? ORDER BY id DESC LIMIT 1",
    [backup.filename, backup.path]
  );
  if (existing) return enrichBackupLog(existing);

  const sizeBytes = Number(
    backup.sizeBytes
    ?? backup.size_bytes
    ?? (fs.existsSync(backup.path) ? fs.statSync(backup.path).size : 0)
  );
  const createdAt = backup.manifest?.createdAt || backup.createdAt || backup.created_at || new Date().toISOString();
  const result = await db.run(
    `
      INSERT INTO backup_logs (filename, path, size_bytes, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    [backup.filename, backup.path, sizeBytes, status, createdAt]
  );

  return enrichBackupLog({
    id: result.lastID,
    filename: backup.filename,
    path: backup.path,
    size_bytes: sizeBytes,
    status,
    created_at: createdAt,
  });
};

const executeRestore = async ({ confirmKeyword, filename, backupFileName, actor = "system" } = {}) => runSerializedDbOperation(async () => {
  const tempDir = path.join(env.backupDir, ".tmp", `restore-${Date.now()}`);
  const activeDbPath = getDbPath();
  let requestedFilename = "";
  let backup = null;
  let preRestoreBackup = null;
  let candidatePath = "";
  let swapPath = "";
  let activeDatabaseReplaced = false;
  let hadActiveDb = false;
  let restoreSucceeded = false;

  try {
    const normalizedConfirmKeyword = String(confirmKeyword || "").trim();
    if (normalizedConfirmKeyword !== RESTORE_CONFIRM_KEYWORD) {
      return {
        restored: false,
        requiredConfirmKeyword: RESTORE_CONFIRM_KEYWORD,
        destructiveAllowed: false,
      };
    }

    const db = await getDb();
    requestedFilename = normalizeBackupFilename(filename || backupFileName || "");
    if (!requestedFilename) {
      return {
        restored: false,
        backupRequired: true,
        destructiveAllowed: false,
      };
    }

    backup = await db.get(
      "SELECT * FROM backup_logs WHERE filename = ? ORDER BY id DESC LIMIT 1",
      [requestedFilename]
    );

    if (!backup?.path || !fs.existsSync(backup.path)) {
      return {
        restored: false,
        backupFound: Boolean(backup),
        backupFileExists: false,
      };
    }

    const preview = await getBackupPreview(backup);
    if (!preview.validForRestore) {
      return {
        restored: false,
        backupFound: true,
        backupFileExists: true,
        destructiveAllowed: false,
        preview,
      };
    }

    if (!preview.safeForRestore) {
      throw createHttpError(
        "Backup tidak memiliki administrator aktif. Restore normal diblokir agar IMS tidak kembali ke Setup Administrator Pertama. Pilih backup lain yang memiliki administrator aktif.",
        409,
        "RESTORE_ACTIVE_ADMIN_REQUIRED"
      );
    }

    preRestoreBackup = await createOfficialSqliteBackup(db, {
      type: "pre-restore",
      actor,
      action: "pre_restore_backup_create",
      notes: `Backup otomatis sebelum restore dari ${requestedFilename}.`,
    });

    const extractedBackup = await extractBackupDatabaseToTemp(backup, tempDir);
    candidatePath = createRestoreSiblingPath(activeDbPath, "restore-candidate");
    swapPath = createRestoreSiblingPath(activeDbPath, "restore-rollback");
    fs.copyFileSync(extractedBackup.dbPath, candidatePath, fs.constants.COPYFILE_EXCL);

    await closeDb();
    removeSqliteRuntimeSidecars(activeDbPath);

    const replacement = replaceActiveDatabaseWithCandidate({
      activeDbPath,
      candidatePath,
      swapPath,
    });
    hadActiveDb = replacement.hadActiveDb;
    activeDatabaseReplaced = true;
    candidatePath = "";

    await runMigrations();
    const restoredDb = await getDb();
    const activeValidation = await getActiveDbValidation(restoredDb);

    if (!activeValidation.valid) {
      throw createHttpError(
        "Database hasil restore gagal validasi integrity/foreign key.",
        500,
        "RESTORE_POST_VALIDATION_FAILED"
      );
    }

    const registeredPreRestoreBackup = await registerRestoredBackupLog(restoredDb, preRestoreBackup, { status: "verified" });
    const registeredRestoreSourceBackup = await registerRestoredBackupLog(restoredDb, backup, { status: backup.status || "verified" });

    const summary = {
      mode: "executed_guarded",
      restored: true,
      rollbackAvailable: Boolean(hadActiveDb && swapPath),
      selectedBackup: {
        id: backup.id,
        filename: backup.filename,
        path: backup.path,
        sizeBytes: backup.size_bytes,
        createdAt: backup.created_at,
      },
      backupManifest: extractedBackup.manifest || preview.manifest || null,
      backupValidation: extractedBackup.validation || preview.validation || null,
      activeDatabaseValidation: activeValidation,
      preRestoreBackup,
      registeredPreRestoreBackup,
      registeredRestoreSourceBackup,
      actor,
      note: [
        "Database aktif diganti secara staged setelah backup otomatis dibuat,",
        "checksum/integrity valid, keyword konfirmasi valid, dan validasi database aktif lulus.",
        "Jika migrasi, validasi, atau audit gagal, database sebelum restore dikembalikan otomatis.",
      ].join(" "),
    };

    const result = await restoredDb.run(
      `
        INSERT INTO restore_logs (filename, backup_path, plan_status, destructive_allowed, summary_json, actor)
        VALUES (?, ?, 'executed_guarded', 1, ?, ?)
      `,
      [backup.filename, backup.path, JSON.stringify(summary), actor]
    );

    await createAuditLog({
      module: "maintenance",
      action: "restore_execute",
      entityType: "restore_log",
      entityId: result.lastID,
      actor,
      description: "Restore database lokal guarded berhasil dijalankan setelah validasi backup dan database aktif",
      metadata: summary,
    });

    if (registeredPreRestoreBackup?.id) {
      await createAuditLog({
        module: "maintenance",
        action: "pre_restore_backup_re_register",
        entityType: "backup_log",
        entityId: registeredPreRestoreBackup.id,
        actor,
        description: "Backup pre-restore otomatis didaftarkan ulang setelah database aktif selesai direstore",
        metadata: {
          filename: registeredPreRestoreBackup.filename,
          path: registeredPreRestoreBackup.path,
          sizeBytes: registeredPreRestoreBackup.size_bytes,
          backupType: registeredPreRestoreBackup.backupType,
          restoreSource: backup.filename,
        },
      });
    }

    if (registeredRestoreSourceBackup?.id) {
      await createAuditLog({
        module: "maintenance",
        action: "restore_source_backup_re_register",
        entityType: "backup_log",
        entityId: registeredRestoreSourceBackup.id,
        actor,
        description: "Backup sumber restore dipastikan tercatat ulang setelah database aktif selesai direstore",
        metadata: {
          filename: registeredRestoreSourceBackup.filename,
          path: registeredRestoreSourceBackup.path,
          sizeBytes: registeredRestoreSourceBackup.size_bytes,
          backupType: registeredRestoreSourceBackup.backupType,
          restoreSource: backup.filename,
        },
      });
    }

    restoreSucceeded = true;
    fs.rmSync(swapPath, { force: true });
    swapPath = "";

    broadcastDatabaseReplacement({
      originClientId: getRequestContext().clientId || "",
      reason: "guarded_restore_completed",
    });

    return {
      id: result.lastID,
      ...summary,
    };
  } catch (error) {
    if (!activeDatabaseReplaced) {
      throw error;
    }

    const rollbackSummary = {
      mode: "automatic_restore_rollback",
      restored: false,
      rollbackAttempted: true,
      rollbackSucceeded: false,
      selectedBackup: requestedFilename || backup?.filename || null,
      preRestoreBackup: preRestoreBackup?.filename || null,
      originalErrorCode: error?.errorCode || error?.code || "RESTORE_EXECUTION_FAILED",
      originalErrorMessage: error?.message || "Restore gagal setelah database aktif diganti.",
      actor,
    };

    try {
      await closeDb().catch(() => {});

      let restoredFromSwap = restoreActiveDatabaseFromSwap({
        activeDbPath,
        swapPath,
        hadActiveDb,
      });

      if (!restoredFromSwap && preRestoreBackup) {
        const rollbackTempDir = path.join(tempDir, "automatic-rollback");
        const rollbackBackup = await extractBackupDatabaseToTemp(preRestoreBackup, rollbackTempDir);
        const rollbackCandidatePath = createRestoreSiblingPath(activeDbPath, "automatic-rollback-candidate");

        try {
          fs.copyFileSync(rollbackBackup.dbPath, rollbackCandidatePath, fs.constants.COPYFILE_EXCL);
          fs.rmSync(activeDbPath, { force: true });
          removeSqliteRuntimeSidecars(activeDbPath);
          fs.renameSync(rollbackCandidatePath, activeDbPath);
          restoredFromSwap = true;
        } finally {
          fs.rmSync(rollbackCandidatePath, { force: true });
        }
      }

      if (!restoredFromSwap) {
        throw new Error("Snapshot database sebelum restore tidak tersedia untuk rollback otomatis.");
      }

      const rollbackDb = await getDb();
      const rollbackValidation = await getActiveDbValidation(rollbackDb);
      if (!rollbackValidation.valid) {
        throw new Error(
          `Database hasil rollback tidak valid: integrity=${rollbackValidation.integrityCheck}, foreignKey=${rollbackValidation.foreignKeyCheck}`
        );
      }

      rollbackSummary.rollbackSucceeded = true;
      rollbackSummary.activeDatabaseValidation = rollbackValidation;

      const rollbackLog = await rollbackDb.run(
        `
          INSERT INTO restore_logs (filename, backup_path, plan_status, destructive_allowed, summary_json, actor)
          VALUES (?, ?, 'rolled_back_guarded', 0, ?, ?)
        `,
        [
          backup?.filename || requestedFilename || "unknown",
          backup?.path || "",
          JSON.stringify(rollbackSummary),
          actor,
        ]
      );

      await createAuditLog({
        module: "maintenance",
        action: "restore_rollback",
        entityType: "restore_log",
        entityId: rollbackLog.lastID,
        actor,
        description: "Restore gagal dan database aktif sebelum restore berhasil dikembalikan otomatis",
        metadata: rollbackSummary,
      });
    } catch (rollbackError) {
      const fatalError = createHttpError(
        "Restore gagal dan rollback otomatis juga gagal. Hentikan layanan lokal dan pulihkan backup pre-restore secara manual.",
        500,
        "RESTORE_ROLLBACK_FAILED"
      );
      fatalError.cause = error;
      fatalError.rollbackError = rollbackError;
      throw fatalError;
    }

    const safeError = createHttpError(
      "Restore gagal. Database aktif berhasil dikembalikan otomatis ke kondisi sebelum restore.",
      500,
      "RESTORE_ROLLED_BACK"
    );
    safeError.cause = error;
    safeError.rollback = rollbackSummary;
    throw safeError;
  } finally {
    if (!restoreSucceeded && candidatePath) {
      fs.rmSync(candidatePath, { force: true });
    }
    if (restoreSucceeded && swapPath) {
      fs.rmSync(swapPath, { force: true });
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

const createRestorePlan = async ({ filename, backupFileName, actor = "system" } = {}) => {
  const db = await getDb();
  const requestedFilename = normalizeBackupFilename(filename || backupFileName || "");
  const backup = requestedFilename
    ? await db.get("SELECT * FROM backup_logs WHERE filename = ? ORDER BY id DESC LIMIT 1", [requestedFilename])
    : await db.get("SELECT * FROM backup_logs ORDER BY id DESC LIMIT 1");

  const activeDbExists = fs.existsSync(getDbPath());
  const preview = backup ? await getBackupPreview(backup).catch((error) => ({
    backup: enrichBackupLog(backup),
    validationError: error.message,
    validForRestore: false,
    safeForRestore: false,
  })) : null;

  const summary = {
    mode: "preview_only",
    destructiveAllowed: false,
    requiredConfirmKeyword: RESTORE_CONFIRM_KEYWORD,
    backupFound: Boolean(backup),
    backupFileExists: Boolean(preview?.backup?.fileExists),
    activeDbExists,
    validForRestore: Boolean(preview?.validForRestore),
    safeForRestore: Boolean(preview?.safeForRestore),
    selectedBackup: preview?.backup ? {
      id: preview.backup.id,
      filename: preview.backup.filename,
      path: preview.backup.path,
      sizeBytes: preview.backup.size_bytes,
      createdAt: preview?.manifest?.createdAt || preview.backup.created_at,
      registeredAt: preview.backup.created_at,
      status: preview.backup.status,
      backupType: preview.backup.backupType,
      manifestStatus: preview.backup.manifestStatus,
    } : null,
    manifest: preview?.manifest || preview?.backup?.manifest || null,
    validation: preview?.validation || null,
    accountSummary: preview?.accountSummary || preview?.validation?.accountSummary || null,
    businessSummary: preview?.businessSummary || preview?.validation?.businessSummary || null,
    restoreSafety: preview?.restoreSafety || preview?.validation?.restoreSafety || null,
    validationError: preview?.validationError || null,
    blockedActions: [
      "Tidak overwrite database aktif.",
      "Tidak menghentikan layanan lokal otomatis.",
      "Tidak menghapus file database lokal aktif.",
      "Restore destructive hanya lewat /api/maintenance/restore-execute dengan session administrator lokal dan keyword konfirmasi.",
    ],
    guidedSteps: [
      "Pilih backup dari daftar resmi.",
      "Validasi checksum dan integrity check.",
      "Review preview jumlah data.",
      `Ketik ${RESTORE_CONFIRM_KEYWORD} untuk eksekusi restore guarded.`,
    ],
    manualSafeSteps: [
      "Buat backup terbaru terlebih dahulu.",
      "Jangan copy file database lokal aktif saat layanan berjalan.",
      "Gunakan restore guarded dari UI agar sistem membuat pre-restore backup otomatis.",
      "Setelah restore, refresh aplikasi dan cek status layanan dari Maintenance Center.",
    ],
  };

  const result = await db.run(
    `
      INSERT INTO restore_logs (filename, backup_path, plan_status, destructive_allowed, summary_json, actor)
      VALUES (?, ?, 'preview_only', 0, ?, ?)
    `,
    [backup?.filename || requestedFilename || null, backup?.path || null, JSON.stringify(summary), actor]
  );

  await createAuditLog({
    module: "maintenance",
    action: "restore_plan_preview",
    entityType: "restore_log",
    entityId: result.lastID,
    actor,
    description: "Restore plan database lokal dibuat sebagai preview-only dengan validasi backup",
    metadata: summary,
  });

  return {
    id: result.lastID,
    ...summary,
  };
};


module.exports = {
  createRestorePlan,
  executeRestore,
};
