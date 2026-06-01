const express = require("express");
const fs = require("fs");
const path = require("path");
const { getDb, getDbPath } = require("../../db/connection");
const env = require("../../config/env");
const { createAuditLog } = require("../../utils/auditLog");
const { success } = require("../../utils/response");

const router = express.Router();

const safeTimestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

router.get("/status", async (req, res, next) => {
  try {
    const db = await getDb();
    const [schemaVersion, customerCount, categoryCount, auditCount, backupCount, restorePlanCount, migrationStatusCount] = await Promise.all([
      db.get("SELECT value FROM schema_meta WHERE key = 'schema_version'"),
      db.get("SELECT COUNT(*) AS count FROM customers WHERE status != 'deleted'"),
      db.get("SELECT COUNT(*) AS count FROM categories WHERE status != 'deleted'"),
      db.get("SELECT COUNT(*) AS count FROM audit_logs"),
      db.get("SELECT COUNT(*) AS count FROM backup_logs"),
      db.get("SELECT COUNT(*) AS count FROM restore_logs"),
      db.get("SELECT COUNT(*) AS count FROM module_migration_status"),
    ]);

    return success(res, "Status SQLite sidecar berhasil dimuat", {
      dbPath: getDbPath(),
      backupDir: env.backupDir,
      schemaVersion: schemaVersion?.value || "unknown",
      customerCount: customerCount?.count || 0,
      categoryCount: categoryCount?.count || 0,
      auditCount: auditCount?.count || 0,
      backupCount: backupCount?.count || 0,
      restorePlanCount: restorePlanCount?.count || 0,
      migrationStatusCount: migrationStatusCount?.count || 0,
      restoreMode: "preview_only",
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/backup", async (req, res, next) => {
  try {
    const db = await getDb();
    fs.mkdirSync(env.backupDir, { recursive: true });

    const filename = `ims-sqlite-sidecar-backup-${safeTimestamp()}.sqlite`;
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
      action: "backup_create",
      entityType: "backup_log",
      entityId: result.lastID,
      description: "Backup SQLite sidecar berhasil dibuat",
      metadata: { filename, backupPath, sizeBytes: stat.size },
    });

    return success(res, "Backup database SQLite sidecar berhasil dibuat", {
      id: result.lastID,
      filename,
      path: backupPath,
      sizeBytes: stat.size,
    });
  } catch (error) {
    return next(error);
  }
});


router.post("/restore-plan", async (req, res, next) => {
  try {
    const db = await getDb();
    const requestedFilename = String(req.body?.filename || "").trim();
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
        "Tidak menjalankan restore destructive tanpa flow guard terpisah.",
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
        INSERT INTO restore_logs (filename, backup_path, plan_status, destructive_allowed, summary_json)
        VALUES (?, ?, 'preview_only', 0, ?)
      `,
      [backup?.filename || requestedFilename || null, backup?.path || null, JSON.stringify(summary)]
    );

    await createAuditLog({
      module: "maintenance",
      action: "restore_plan_preview",
      entityType: "restore_log",
      entityId: result.lastID,
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

router.get("/restore-logs", async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all("SELECT * FROM restore_logs ORDER BY id DESC LIMIT 50");
    return success(res, "Daftar restore plan SQLite berhasil dimuat", rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/backups", async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all("SELECT * FROM backup_logs ORDER BY id DESC LIMIT 100");
    return success(res, "Daftar backup SQLite sidecar berhasil dimuat", rows);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
