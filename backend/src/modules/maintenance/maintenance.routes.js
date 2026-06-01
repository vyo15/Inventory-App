const express = require("express");
const fs = require("fs");
const path = require("path");
const { closeDb, getDb, getDbPath } = require("../../db/connection");
const env = require("../../config/env");
const { createAuditLog } = require("../../utils/auditLog");
const { runMigrations } = require("../../db/migrate");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const { success } = require("../../utils/response");

const router = express.Router();

const RESTORE_CONFIRM_KEYWORD = "RESTORE SQLITE";

const safeTimestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

router.get("/status", async (req, res, next) => {
  try {
    const db = await getDb();
    const [schemaVersion, userCount, activeAdminCount, customerCount, categoryCount, supplierCount, auditCount, backupCount, restorePlanCount, migrationStatusCount] = await Promise.all([
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
    ]);

    return success(res, "Status SQLite sidecar berhasil dimuat", {
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
      migrationStatusCount: migrationStatusCount?.count || 0,
      restoreMode: "guarded_confirm_keyword",
      restoreConfirmKeyword: RESTORE_CONFIRM_KEYWORD,
    });
  } catch (error) {
    return next(error);
  }
});

const createBackupFile = async (db, { prefix = "ims-sqlite-sidecar-backup", actor = "system", action = "backup_create" } = {}) => {
  fs.mkdirSync(env.backupDir, { recursive: true });

  const filename = `${prefix}-${safeTimestamp()}.sqlite`;
  const backupPath = path.join(env.backupDir, filename);

  await db.exec("PRAGMA wal_checkpoint(FULL);");
  fs.copyFileSync(getDbPath(), backupPath);
  const stat = fs.statSync(backupPath);

  const result = await db.run(
    `
      INSERT INTO backup_logs (filename, path, size_bytes, status)
      VALUES (?, ?, ?, 'success')
    `,
    [filename, backupPath, stat.size]
  );

  await createAuditLog({
    module: "maintenance",
    action,
    entityType: "backup_log",
    entityId: result.lastID,
    actor,
    description: "Backup SQLite sidecar berhasil dibuat",
    metadata: { filename, backupPath, sizeBytes: stat.size },
  });

  return { id: result.lastID, filename, path: backupPath, sizeBytes: stat.size };
};

router.post("/backup", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const backup = await createBackupFile(db, {
      actor: req.localAuth.user.username,
      action: "backup_create",
    });

    return success(res, "Backup database SQLite sidecar berhasil dibuat", backup);
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

router.post("/restore-execute", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
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
    const requestedFilename = String(req.body?.filename || req.body?.backupFileName || "").trim();
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

    const actor = req.localAuth.user.username;
    const preRestoreBackup = await createBackupFile(db, {
      prefix: "ims-sqlite-sidecar-pre-restore-backup",
      actor,
      action: "pre_restore_backup_create",
    });

    const activeDbPath = getDbPath();
    await closeDb();
    fs.copyFileSync(backup.path, activeDbPath);
    removeSqliteRuntimeSidecars(activeDbPath);

    await runMigrations();
    const restoredDb = await getDb();

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
      preRestoreBackup,
      actor,
      note: "Database aktif dioverwrite dari backup setelah backup otomatis dibuat dan keyword konfirmasi valid.",
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
      description: "Restore SQLite guarded berhasil dijalankan",
      metadata: summary,
    });

    return success(res, "Restore SQLite guarded berhasil dijalankan", {
      id: result.lastID,
      ...summary,
    });
  } catch (error) {
    return next(error);
  }
});


router.post("/restore-plan", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const requestedFilename = String(req.body?.filename || req.body?.backupFileName || "").trim();
    const backup = requestedFilename
      ? await db.get("SELECT * FROM backup_logs WHERE filename = ? ORDER BY id DESC LIMIT 1", [requestedFilename])
      : await db.get("SELECT * FROM backup_logs ORDER BY id DESC LIMIT 1");

    const backupExists = backup?.path ? fs.existsSync(backup.path) : false;
    const activeDbExists = fs.existsSync(getDbPath());
    const summary = {
      mode: "preview_only",
      destructiveAllowed: false,
      backupFound: Boolean(backup),
      backupFileExists: backupExists,
      activeDbExists,
      selectedBackup: backup ? {
        id: backup.id,
        filename: backup.filename,
        path: backup.path,
        sizeBytes: backup.size_bytes,
        createdAt: backup.created_at,
      } : null,
      blockedActions: [
        "Tidak overwrite database aktif.",
        "Tidak stop backend otomatis.",
        "Tidak menghapus file SQLite aktif.",
        "Restore destructive hanya lewat /api/maintenance/restore-execute dengan session administrator lokal dan keyword konfirmasi.",
      ],
      manualSafeSteps: [
        "Buat backup terbaru terlebih dahulu.",
        "Stop backend dengan CTRL+C sebelum restore manual.",
        "Copy file backup ke data/ims-sqlite-sidecar.sqlite hanya setelah yakin.",
        "Jalankan backend dan cek /health serta /api/maintenance/status.",
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
      description: "Restore plan SQLite dibuat sebagai preview-only",
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
    return success(res, "Daftar restore plan SQLite berhasil dimuat", rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/backups", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all("SELECT * FROM backup_logs ORDER BY id DESC LIMIT 100");
    return success(res, "Daftar backup SQLite sidecar berhasil dimuat", rows);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
