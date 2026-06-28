const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const env = require("../../../config/env");
const { getDbPath, runSerializedDbOperation } = require("../../../db/connection");
const { createAuditLog } = require("../../../utils/auditLog");
const {
  BACKUP_FILE_SUFFIX,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  LEGACY_BACKUP_FILE_SUFFIX,
  SQLITE_PACKAGE_CHECKSUM_FILE,
  SQLITE_PACKAGE_DATABASE_FILE,
  SQLITE_PACKAGE_MANIFEST_FILE,
  SQLITE_PACKAGE_README_FILE,
  ZIP_COMPRESSION_DEFLATE,
} = require("./backupConstants");
const {
  assertSufficientDiskSpace,
  ensureDir,
  getBackupStorageClass,
  getBackupTypeDir,
  getUniquePackagePath,
  normalizeBackupType,
  safeCompactTimestamp,
  sqliteStringLiteral,
} = require("./backupPath");
const {
  assertZip32EntrySize,
  buildReadme,
  createBackupPackage,
  sha256File,
} = require("./backupPackage");
const { getBackupPreview, getSchemaVersion, validateSqliteFile } = require("./backupValidation");

const createOfficialSqliteBackupUnsafe = async (db, options = {}) => {
  const backupType = normalizeBackupType(options.type || options.backupType || "manual");
  const actor = options.actor || "system";
  const action = options.action || "backup_create";
  const createdAt = options.createdAt ? new Date(options.createdAt) : new Date();
  if (Number.isNaN(createdAt.getTime())) throw new Error("Tanggal backup tidak valid.");
  const schemaVersion = await getSchemaVersion(db);
  const timestamp = safeCompactTimestamp(createdAt);
  const targetDir = getBackupTypeDir(backupType);
  const tmpDir = path.join(env.backupDir, ".tmp", `${timestamp}-${backupType}-${crypto.randomBytes(4).toString("hex")}`);
  ensureDir(tmpDir);

  const requestedFilename = `IMS-BF-BACKUP-${timestamp}-SV${schemaVersion}-${backupType}${BACKUP_FILE_SUFFIX}`;
  const uniquePackage = getUniquePackagePath(targetDir, requestedFilename);
  const packageFilename = uniquePackage.filename;
  const packagePath = uniquePackage.path;
  const tmpPackagePath = path.join(tmpDir, packageFilename);
  const backupDbPath = path.join(tmpDir, SQLITE_PACKAGE_DATABASE_FILE);

  try {
    const sourceDbPath = getDbPath();
    const sourceDbStat = fs.statSync(sourceDbPath);
    const sourceWalPath = `${sourceDbPath}-wal`;
    const sourceWalSize = fs.existsSync(sourceWalPath) ? fs.statSync(sourceWalPath).size : 0;
    const estimatedLogicalSize = sourceDbStat.size + sourceWalSize;
    assertZip32EntrySize(estimatedLogicalSize, "database aktif dan WAL");
    assertSufficientDiskSpace({
      targetDir: tmpDir,
      expectedWriteBytes: estimatedLogicalSize,
      copyCount: 2,
      operation: "Pembuatan backup database",
    });

    await db.exec("PRAGMA wal_checkpoint(FULL);");
    await db.exec(`VACUUM INTO ${sqliteStringLiteral(backupDbPath)};`);

    const validation = await validateSqliteFile(backupDbPath);
    if (!validation.valid) {
      throw new Error(`Backup database lokal tidak valid: integrity=${validation.integrityCheck}; foreignKey=${validation.foreignKeyCheck}`);
    }

    const dbStat = fs.statSync(backupDbPath);
    assertZip32EntrySize(dbStat.size, SQLITE_PACKAGE_DATABASE_FILE);
    assertSufficientDiskSpace({
      targetDir: tmpDir,
      expectedWriteBytes: dbStat.size,
      operation: "Pembuatan paket backup",
    });
    const databaseSha256 = await sha256File(backupDbPath);
    const manifest = {
      appName: "IMS Bunga Flanel",
      backupFormat: BACKUP_FORMAT,
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      backupType,
      storageClass: getBackupStorageClass(backupType),
      createdAt: createdAt.toISOString(),
      schemaVersion: validation.schemaVersion || schemaVersion,
      databaseFile: SQLITE_PACKAGE_DATABASE_FILE,
      databaseSizeBytes: dbStat.size,
      checksumAlgorithm: "sha256",
      databaseSha256,
      checksumFile: SQLITE_PACKAGE_CHECKSUM_FILE,
      compression: "deflate",
      packageExtension: BACKUP_FILE_SUFFIX,
      legacyRestoreSupported: LEGACY_BACKUP_FILE_SUFFIX,
      integrityCheck: validation.integrityCheck,
      foreignKeyCheck: validation.foreignKeyCheck,
      createdBy: actor,
      sourceMachine: os.hostname(),
      sourceDbPath: getDbPath(),
      notes: options.notes || "Backup resmi dibuat dari layanan IMS.",
      tables: validation.tables,
    };

    createBackupPackage([
      { name: SQLITE_PACKAGE_DATABASE_FILE, data: fs.readFileSync(backupDbPath) },
      { name: SQLITE_PACKAGE_MANIFEST_FILE, data: JSON.stringify(manifest, null, 2) },
      { name: SQLITE_PACKAGE_CHECKSUM_FILE, data: `${databaseSha256}  ${SQLITE_PACKAGE_DATABASE_FILE}\n` },
      { name: SQLITE_PACKAGE_README_FILE, data: buildReadme(manifest) },
    ], tmpPackagePath, { compressionMethod: ZIP_COMPRESSION_DEFLATE });

    const packagePreview = await getBackupPreview({
      filename: packageFilename,
      path: tmpPackagePath,
      status: "verified",
    });
    if (!packagePreview.validForRestore) {
      throw new Error("Paket backup selesai dibuat tetapi gagal diverifikasi ulang.");
    }

    fs.renameSync(tmpPackagePath, packagePath);
    const packageStat = fs.statSync(packagePath);
    const result = await db.run(
      `
        INSERT INTO backup_logs (filename, path, size_bytes, status)
        VALUES (?, ?, ?, 'verified')
      `,
      [packageFilename, packagePath, packageStat.size]
    );

    await createAuditLog({
      module: "maintenance",
      action,
      entityType: "backup_log",
      entityId: result.lastID,
      actor,
      description: `Backup database lokal resmi (${backupType}) berhasil dibuat dan diverifikasi`,
      metadata: {
        filename: packageFilename,
        backupPath: packagePath,
        backupType,
        sizeBytes: packageStat.size,
        databaseSizeBytes: dbStat.size,
        schemaVersion: manifest.schemaVersion,
        integrityCheck: manifest.integrityCheck,
        foreignKeyCheck: manifest.foreignKeyCheck,
        checksumAlgorithm: manifest.checksumAlgorithm,
        databaseSha256: manifest.databaseSha256,
        backupFormat: manifest.backupFormat,
        backupFormatVersion: manifest.backupFormatVersion,
        compression: manifest.compression,
      },
    });

    return {
      id: result.lastID,
      filename: packageFilename,
      path: packagePath,
      sizeBytes: packageStat.size,
      status: "verified",
      backupType,
      manifest,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};

const createOfficialSqliteBackup = (db, options = {}) => runSerializedDbOperation(
  () => createOfficialSqliteBackupUnsafe(db, options),
);

module.exports = { createOfficialSqliteBackup, createOfficialSqliteBackupUnsafe };
