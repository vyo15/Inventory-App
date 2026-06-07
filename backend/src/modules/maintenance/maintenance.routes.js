const express = require("express");
const fs = require("fs");
const path = require("path");
const { closeDb, getDb, getDbPath } = require("../../db/connection");
const env = require("../../config/env");
const { createAuditLog } = require("../../utils/auditLog");
const { runMigrations } = require("../../db/migrate");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const { success } = require("../../utils/response");
const {
  RESTORE_CONFIRM_KEYWORD,
  createOfficialSqliteBackup,
  enrichBackupLog,
  enrichBackupLogs,
  extractBackupDatabaseToTemp,
  getBackupPreview,
  normalizeBackupFilename,
} = require("../../utils/sqliteBackup");

const router = express.Router();

router.get("/status", async (req, res, next) => {
  try {
    const db = await getDb();
    const [schemaVersion, userCount, activeAdminCount, customerCount, categoryCount, supplierCount, auditCount, backupCount, restorePlanCount, moduleRuntimeStatusCount, latestBackup] = await Promise.all([
      db.get("SELECT value FROM schema_meta WHERE key = 'schema_version'"),
      db.get("SELECT COUNT(*) AS count FROM users"),
      db.get("SELECT COUNT(*) AS count FROM users WHERE role = 'administrator' AND status = 'active'"),
      db.get("SELECT COUNT(*) AS count FROM customers WHERE status != 'deleted'"),
      db.get("SELECT COUNT(*) AS count FROM categories WHERE status != 'deleted'"),
      db.get("SELECT COUNT(*) AS count FROM suppliers WHERE status != 'deleted'"),
      db.get("SELECT COUNT(*) AS count FROM audit_logs"),
      db.get("SELECT COUNT(*) AS count FROM backup_logs"),
      db.get("SELECT COUNT(*) AS count FROM restore_logs"),
      db.get("SELECT COUNT(*) AS count FROM module_migration_status"),
      db.get("SELECT * FROM backup_logs ORDER BY id DESC LIMIT 1"),
    ]);

    return success(res, "Status layanan database lokal berhasil dimuat", {
      dbPath: getDbPath(),
      backupDir: env.backupDir,
      schemaVersion: schemaVersion?.value || "unknown",
      userCount: userCount?.count || 0,
      activeAdministratorCount: activeAdminCount?.count || 0,
      customerCount: customerCount?.count || 0,
      categoryCount: categoryCount?.count || 0,
      supplierCount: supplierCount?.count || 0,
      auditCount: auditCount?.count || 0,
      backupCount: backupCount?.count || 0,
      restorePlanCount: restorePlanCount?.count || 0,
      moduleRuntimeStatusCount: moduleRuntimeStatusCount?.count || 0,
      migrationStatusCount: moduleRuntimeStatusCount?.count || 0,
      latestBackup: enrichBackupLog(latestBackup),
      backupFormat: "imsbak_zip_manifest_checksum",
      backupPolicy: {
        manual: true,
        autoDailyOnBackendStart: true,
        preRestoreBackup: true,
        verifyChecksum: true,
        verifyIntegrityCheck: true,
        externalCopyReminderDays: 7,
      },
      restoreMode: "guarded_confirm_keyword",
      restoreConfirmKeyword: RESTORE_CONFIRM_KEYWORD,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/backup", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const backup = await createOfficialSqliteBackup(db, {
      type: req.body?.backupType || req.body?.type || "manual",
      actor: req.localAuth.user.username,
      action: "backup_create",
      notes: req.body?.notes || "Backup manual resmi dari UI IMS.",
    });

    return success(res, "Backup database berhasil dibuat dan diverifikasi", backup);
  } catch (error) {
    return next(error);
  }
});

const removeSqliteRuntimeSidecars = (dbPath) => {
  for (const suffix of ["-wal", "-shm"]) {
    const sidecarPath = `${dbPath}${suffix}`;
    if (fs.existsSync(sidecarPath)) fs.rmSync(sidecarPath, { force: true });
  }
};

const getActiveDbValidation = async (db) => {
  const integrityRows = await db.all("PRAGMA integrity_check;");
  const foreignKeyRows = await db.all("PRAGMA foreign_key_check;");
  const integrityMessages = integrityRows.map((row) => row.integrity_check || Object.values(row)[0]).filter(Boolean);
  const integrityCheck = integrityMessages.length === 1 && String(integrityMessages[0]).toLowerCase() === "ok"
    ? "ok"
    : integrityMessages.join("; ") || "unknown";

  return {
    integrityCheck,
    foreignKeyCheck: foreignKeyRows.length ? `${foreignKeyRows.length} issue(s)` : "ok",
    valid: integrityCheck === "ok" && foreignKeyRows.length === 0,
  };
};

router.post("/restore-execute", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  const tempDir = path.join(env.backupDir, ".tmp", `restore-${Date.now()}`);

  try {
    const confirmKeyword = String(req.body?.confirmKeyword || "").trim();
    if (confirmKeyword !== RESTORE_CONFIRM_KEYWORD) {
      return success(res, "Restore belum dijalankan. Keyword konfirmasi belum sesuai.", {
        restored: false,
        requiredConfirmKeyword: RESTORE_CONFIRM_KEYWORD,
        destructiveAllowed: false,
      });
    }

    const db = await getDb();
    const requestedFilename = normalizeBackupFilename(req.body?.filename || req.body?.backupFileName || "");
    if (!requestedFilename) {
      return success(res, "Restore dibatalkan karena filename backup wajib dipilih secara eksplisit.", {
        restored: false,
        backupRequired: true,
        destructiveAllowed: false,
      });
    }

    const backup = await db.get(
      "SELECT * FROM backup_logs WHERE filename = ? ORDER BY id DESC LIMIT 1",
      [requestedFilename]
    );

    if (!backup?.path || !fs.existsSync(backup.path)) {
      return success(res, "Restore dibatalkan karena file backup tidak ditemukan.", {
        restored: false,
        backupFound: Boolean(backup),
        backupFileExists: false,
      });
    }

    const preview = await getBackupPreview(backup);
    if (!preview.validForRestore) {
      return success(res, "Restore dibatalkan karena backup tidak lolos validasi.", {
        restored: false,
        backupFound: true,
        backupFileExists: true,
        destructiveAllowed: false,
        preview,
      });
    }

    const actor = req.localAuth.user.username;
    const preRestoreBackup = await createOfficialSqliteBackup(db, {
      type: "pre-restore",
      actor,
      action: "pre_restore_backup_create",
      notes: `Backup otomatis sebelum restore dari ${requestedFilename}.`,
    });

    const extractedBackup = await extractBackupDatabaseToTemp(backup, tempDir);
    const activeDbPath = getDbPath();
    await closeDb();
    fs.copyFileSync(extractedBackup.dbPath, activeDbPath);
    removeSqliteRuntimeSidecars(activeDbPath);

    await runMigrations();
    const restoredDb = await getDb();
    const activeValidation = await getActiveDbValidation(restoredDb);

    const summary = {
      mode: "executed_guarded",
      restored: true,
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
      actor,
      note: "Database aktif dioverwrite dari backup setelah backup otomatis dibuat, checksum/integrity valid, dan keyword konfirmasi valid.",
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
      description: "Restore database lokal guarded berhasil dijalankan setelah validasi backup",
      metadata: summary,
    });

    return success(res, "Restore database lokal guarded berhasil dijalankan. Refresh aplikasi dan login ulang bila diperlukan.", {
      id: result.lastID,
      ...summary,
    });
  } catch (error) {
    return next(error);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

router.post("/restore-plan", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const requestedFilename = normalizeBackupFilename(req.body?.filename || req.body?.backupFileName || "");
    const backup = requestedFilename
      ? await db.get("SELECT * FROM backup_logs WHERE filename = ? ORDER BY id DESC LIMIT 1", [requestedFilename])
      : await db.get("SELECT * FROM backup_logs ORDER BY id DESC LIMIT 1");

    const activeDbExists = fs.existsSync(getDbPath());
    const preview = backup ? await getBackupPreview(backup).catch((error) => ({
      backup: enrichBackupLog(backup),
      validationError: error.message,
      validForRestore: false,
    })) : null;

    const summary = {
      mode: "preview_only",
      destructiveAllowed: false,
      requiredConfirmKeyword: RESTORE_CONFIRM_KEYWORD,
      backupFound: Boolean(backup),
      backupFileExists: Boolean(preview?.backup?.fileExists),
      activeDbExists,
      validForRestore: Boolean(preview?.validForRestore),
      selectedBackup: preview?.backup ? {
        id: preview.backup.id,
        filename: preview.backup.filename,
        path: preview.backup.path,
        sizeBytes: preview.backup.size_bytes,
        createdAt: preview.backup.created_at,
        status: preview.backup.status,
        backupType: preview.backup.backupType,
        manifestStatus: preview.backup.manifestStatus,
      } : null,
      manifest: preview?.manifest || preview?.backup?.manifest || null,
      validation: preview?.validation || null,
      validationError: preview?.validationError || null,
      blockedActions: [
        "Tidak overwrite database aktif.",
        "Tidak stop backend otomatis.",
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
        "Jangan copy file database lokal aktif saat backend berjalan.",
        "Gunakan restore guarded dari UI/backend agar sistem membuat pre-restore backup otomatis.",
        "Setelah restore, refresh aplikasi dan cek /health serta /api/maintenance/status.",
      ],
    };

    const result = await db.run(
      `
        INSERT INTO restore_logs (filename, backup_path, plan_status, destructive_allowed, summary_json, actor)
        VALUES (?, ?, 'preview_only', 0, ?, ?)
      `,
      [backup?.filename || requestedFilename || null, backup?.path || null, JSON.stringify(summary), req.localAuth.user.username]
    );

    await createAuditLog({
      module: "maintenance",
      action: "restore_plan_preview",
      entityType: "restore_log",
      entityId: result.lastID,
      actor: req.localAuth.user.username,
      description: "Restore plan database lokal dibuat sebagai preview-only dengan validasi backup",
      metadata: summary,
    });

    return success(res, "Restore plan dibuat sebagai preview-only. Tidak ada data yang diubah.", {
      id: result.lastID,
      ...summary,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/restore-logs", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all("SELECT * FROM restore_logs ORDER BY id DESC LIMIT 50");
    return success(res, "Daftar restore plan database lokal berhasil dimuat", rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/backups", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all("SELECT * FROM backup_logs ORDER BY id DESC LIMIT 100");
    return success(res, "Daftar backup database lokal berhasil dimuat", enrichBackupLogs(rows));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
