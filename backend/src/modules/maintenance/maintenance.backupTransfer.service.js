const fs = require("fs");
const path = require("path");
const { getDb, runInTransaction, runSerializedDbOperation } = require("../../db/connection");
const env = require("../../config/env");
const { createAuditLog } = require("../../utils/auditLog");
const {
  createOfficialSqliteBackup,
  getBackupPreview,
  getUniquePackagePath,
  assertSufficientDiskSpace,
  isSupportedBackupPackageName,
  normalizeBackupFilename,
  sanitizeImportedBackupFilename,
} = require("./backup");
const { createHttpError, decodeImportFilename } = require("./maintenance.shared");

const IMPORT_BACKUP_MAX_BYTES = 200 * 1024 * 1024;

const createBackup = async ({ type, actor = "system", notes } = {}) => {
  const db = await getDb();
  return createOfficialSqliteBackup(db, {
    type: type || "manual",
    actor,
    action: "backup_create",
    notes: notes || "Backup manual resmi dari UI IMS.",
  });
};

const getBackupDownload = async (filename) => {
  const requestedFilename = normalizeBackupFilename(filename || "");
  if (!requestedFilename) {
    throw createHttpError("Nama file backup wajib dipilih.", 400, "BACKUP_FILENAME_REQUIRED");
  }

  const db = await getDb();
  const backup = await db.get(
    "SELECT * FROM backup_logs WHERE filename = ? ORDER BY id DESC LIMIT 1",
    [requestedFilename]
  );

  if (!backup?.path || !fs.existsSync(backup.path)) {
    throw createHttpError("File backup tidak ditemukan atau belum terdaftar.", 404, "BACKUP_NOT_FOUND");
  }

  return {
    path: backup.path,
    filename: backup.filename,
  };
};

const importBackupFile = async ({ body, headers = {}, query = {}, actor = "system" } = {}) => (
  runSerializedDbOperation(async () => {
    let importedPath = "";
    try {
      const backupBuffer = Buffer.isBuffer(body) ? body : null;
      if (!backupBuffer?.length) {
        throw createHttpError("File backup wajib dipilih sebelum import.", 400, "BACKUP_IMPORT_EMPTY");
      }
      if (backupBuffer.length > IMPORT_BACKUP_MAX_BYTES) {
        throw createHttpError("File backup terlalu besar untuk import lokal.", 413, "BACKUP_IMPORT_TOO_LARGE");
      }

      const rawFilename = decodeImportFilename(headers["x-ims-backup-filename"] || query?.filename || "");
      const safeSourceName = sanitizeImportedBackupFilename(rawFilename);
      if (!safeSourceName || !isSupportedBackupPackageName(safeSourceName)) {
        throw createHttpError(
          "Format file backup tidak didukung. Gunakan File Backup IMS (.imsbackup) atau backup legacy .imsbak.zip.",
          400,
          "BACKUP_IMPORT_UNSUPPORTED_FORMAT",
        );
      }

      const importedDir = path.join(env.backupDir, "manual");
      fs.mkdirSync(importedDir, { recursive: true });
      assertSufficientDiskSpace({
        targetDir: importedDir,
        expectedWriteBytes: backupBuffer.length,
        operation: "Import file backup",
      });
      const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
      const uniqueBackup = getUniquePackagePath(importedDir, `IMPORT-${timestamp}-${safeSourceName}`);
      importedPath = uniqueBackup.path;
      fs.writeFileSync(importedPath, backupBuffer, { flag: "wx" });

      const importedBackup = {
        filename: uniqueBackup.filename,
        path: importedPath,
        size_bytes: backupBuffer.length,
        status: "imported",
      };
      const preview = await getBackupPreview(importedBackup);
      if (!preview.validForRestore) {
        throw createHttpError("File backup berhasil dibaca tetapi tidak valid untuk restore.", 400, "BACKUP_IMPORT_INVALID");
      }

      const manifest = preview.manifest || null;
      return await runInTransaction(async (db) => {
        const result = await db.run(
          `
            INSERT INTO backup_logs (filename, path, size_bytes, status)
            VALUES (?, ?, ?, 'verified')
          `,
          [uniqueBackup.filename, importedPath, backupBuffer.length],
        );

        const summary = {
          id: result.lastID,
          filename: uniqueBackup.filename,
          originalFilename: safeSourceName,
          path: importedPath,
          sizeBytes: backupBuffer.length,
          status: "verified",
          backupType: manifest?.backupType || "manual-import",
          storageClass: "manual",
          sourceBackupType: manifest?.backupType || null,
          manifest,
          validation: preview.validation,
          validForRestore: true,
        };

        await createAuditLog({
          module: "maintenance",
          action: "backup_import",
          entityType: "backup_log",
          entityId: result.lastID,
          actor,
          description: "File Backup IMS berhasil diimport dan diverifikasi untuk restore guarded",
          metadata: summary,
        });

        return summary;
      }, { label: "maintenance_backup_import_commit" });
    } catch (error) {
      if (importedPath) fs.rmSync(importedPath, { force: true });
      if (importedPath) fs.rmSync(`${importedPath}.manifest.json`, { force: true });
      throw error;
    }
  }, { label: "maintenance_backup_import" })
);


module.exports = {
  IMPORT_BACKUP_MAX_BYTES,
  createBackup,
  getBackupDownload,
  importBackupFile,
};
