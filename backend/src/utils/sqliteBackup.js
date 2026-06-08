const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const env = require("../config/env");
const { getDb, getDbPath } = require("../db/connection");
const { createAuditLog } = require("./auditLog");

const BACKUP_FORMAT = "imsbackup";
const LEGACY_BACKUP_FORMAT = "imsbak";
const SUPPORTED_BACKUP_FORMATS = new Set([BACKUP_FORMAT, LEGACY_BACKUP_FORMAT]);
const BACKUP_FORMAT_VERSION = 2;
const BACKUP_FILE_SUFFIX = ".imsbackup";
const LEGACY_BACKUP_FILE_SUFFIX = ".imsbak.zip";
const SUPPORTED_BACKUP_FILE_SUFFIXES = [BACKUP_FILE_SUFFIX, LEGACY_BACKUP_FILE_SUFFIX];
const BACKUP_TYPES = new Set(["manual", "daily", "pre-update", "pre-restore", "pre-reset", "pre-import", "test"]);
const RESTORE_CONFIRM_KEYWORD = "RESTORE DATABASE";
const SQLITE_PACKAGE_DATABASE_FILE = "database.sqlite";
const SQLITE_PACKAGE_MANIFEST_FILE = "manifest.json";
const SQLITE_PACKAGE_CHECKSUM_FILE = "checksum.sha256";
const SQLITE_PACKAGE_README_FILE = "README_RESTORE.txt";
const ZIP_COMPRESSION_STORE = 0;
const ZIP_COMPRESSION_DEFLATE = 8;

const crcTable = (() => {
  const table = new Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const ensureDir = (dirPath) => fs.mkdirSync(dirPath, { recursive: true });

const safeCompactTimestamp = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const sqliteStringLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;

const normalizeBackupType = (value) => {
  const type = String(value || "manual").trim().toLowerCase();
  return BACKUP_TYPES.has(type) ? type : "manual";
};

const normalizeBackupFilename = (filename) => path.basename(String(filename || "").trim());

const sanitizeImportedBackupFilename = (filename) => {
  const baseName = normalizeBackupFilename(filename).replace(/[^A-Za-z0-9._() -]/g, "-");
  return baseName.replace(/\s+/g, " ").trim();
};

const isSupportedBackupPackageName = (filename = "") => {
  const normalized = String(filename || "").toLowerCase();
  return SUPPORTED_BACKUP_FILE_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
};

const getBackupTypeDir = (type) => {
  const backupType = normalizeBackupType(type);
  const targetDir = path.join(env.backupDir, backupType);
  ensureDir(targetDir);
  return targetDir;
};

const sha256File = (filePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);
  stream.on("data", (chunk) => hash.update(chunk));
  stream.on("error", reject);
  stream.on("end", () => resolve(hash.digest("hex")));
});

const getDosDateTime = (date = new Date()) => {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
};

const getZipEntryBuffers = (entry, compressionMethod) => {
  const dataBuffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data || ""), "utf8");
  const compressedBuffer = compressionMethod === ZIP_COMPRESSION_DEFLATE
    ? zlib.deflateRawSync(dataBuffer, { level: 9 })
    : dataBuffer;

  return {
    dataBuffer,
    compressedBuffer,
    crc: crc32(dataBuffer),
    uncompressedSize: dataBuffer.length,
    compressedSize: compressedBuffer.length,
  };
};

const createBackupPackage = (entries, outputPath, options = {}) => {
  const compressionMethod = options.compressionMethod ?? ZIP_COMPRESSION_DEFLATE;
  if (![ZIP_COMPRESSION_STORE, ZIP_COMPRESSION_DEFLATE].includes(compressionMethod)) {
    throw new Error("Metode kompresi backup tidak didukung.");
  }

  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { dosTime, dosDate } = getDosDateTime();

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, "utf8");
    const { compressedBuffer, crc, uncompressedSize, compressedSize } = getZipEntryBuffers(entry, compressionMethod);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuffer, compressedBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressedSize, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + compressedBuffer.length;
  }

  const centralOffset = offset;
  const centralBuffer = Buffer.concat(centralParts);
  const endHeader = Buffer.alloc(22);
  endHeader.writeUInt32LE(0x06054b50, 0);
  endHeader.writeUInt16LE(0, 4);
  endHeader.writeUInt16LE(0, 6);
  endHeader.writeUInt16LE(entries.length, 8);
  endHeader.writeUInt16LE(entries.length, 10);
  endHeader.writeUInt32LE(centralBuffer.length, 12);
  endHeader.writeUInt32LE(centralOffset, 16);
  endHeader.writeUInt16LE(0, 20);

  fs.writeFileSync(outputPath, Buffer.concat([...localParts, centralBuffer, endHeader]));
};

const readBackupPackageEntry = (zipPath, targetName) => {
  const buffer = fs.readFileSync(zipPath);
  const minEndOffset = Math.max(0, buffer.length - 22 - 65535);
  let endOffset = -1;
  for (let index = buffer.length - 22; index >= minEndOffset; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      endOffset = index;
      break;
    }
  }
  if (endOffset < 0) throw new Error("Format backup tidak valid: EOCD package tidak ditemukan.");

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  let pointer = centralOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) throw new Error("Format backup tidak valid: central directory rusak.");
    const compression = buffer.readUInt16LE(pointer + 10);
    const expectedCrc = buffer.readUInt32LE(pointer + 16);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const uncompressedSize = buffer.readUInt32LE(pointer + 24);
    const fileNameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const entryName = buffer.slice(pointer + 46, pointer + 46 + fileNameLength).toString("utf8");

    if (entryName === targetName) {
      if (![ZIP_COMPRESSION_STORE, ZIP_COMPRESSION_DEFLATE].includes(compression)) {
        throw new Error("Format backup tidak didukung: metode kompresi package belum didukung.");
      }
      if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Format backup tidak valid: local header rusak.");
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressedBuffer = buffer.slice(dataOffset, dataOffset + compressedSize);
      const dataBuffer = compression === ZIP_COMPRESSION_DEFLATE
        ? zlib.inflateRawSync(compressedBuffer)
        : compressedBuffer;

      if (dataBuffer.length !== uncompressedSize) {
        throw new Error("Format backup tidak valid: ukuran entry tidak sesuai.");
      }
      if (crc32(dataBuffer) !== expectedCrc) {
        throw new Error("Format backup tidak valid: CRC entry tidak sesuai.");
      }
      return dataBuffer;
    }

    pointer += 46 + fileNameLength + extraLength + commentLength;
  }

  return null;
};

const openSqliteReadOnly = async (filename) => open({
  filename,
  driver: sqlite3.Database,
  mode: sqlite3.OPEN_READONLY,
});

const getSchemaVersion = async (db) => {
  const row = await db.get("SELECT value FROM schema_meta WHERE key = 'schema_version'").catch(() => null);
  return row?.value || "unknown";
};

const getTableCounts = async (db) => {
  const tables = await db.all(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).catch(() => []);

  const counts = {};
  for (const table of tables) {
    const tableName = String(table.name || "");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) continue;
    const row = await db.get(`SELECT COUNT(*) AS count FROM ${tableName}`).catch(() => null);
    counts[tableName] = row?.count || 0;
  }
  return counts;
};

const validateSqliteFile = async (dbFilePath) => {
  const backupDb = await openSqliteReadOnly(dbFilePath);
  try {
    const integrityRows = await backupDb.all("PRAGMA integrity_check;");
    const foreignKeyRows = await backupDb.all("PRAGMA foreign_key_check;");
    const schemaVersion = await getSchemaVersion(backupDb);
    const tables = await getTableCounts(backupDb);
    const integrityMessages = integrityRows.map((row) => row.integrity_check || Object.values(row)[0]).filter(Boolean);
    const integrityOk = integrityMessages.length === 1 && String(integrityMessages[0]).toLowerCase() === "ok";

    return {
      integrityCheck: integrityOk ? "ok" : integrityMessages.join("; ") || "unknown",
      foreignKeyCheck: foreignKeyRows.length ? `${foreignKeyRows.length} issue(s)` : "ok",
      foreignKeyIssues: foreignKeyRows,
      schemaVersion,
      tables,
      valid: integrityOk && foreignKeyRows.length === 0,
    };
  } finally {
    await backupDb.close();
  }
};

const buildReadme = (manifest) => [
  "Backup IMS Bunga Flanel",
  "",
  `Tanggal backup: ${manifest.createdAt}`,
  `Jenis backup: ${manifest.backupType}`,
  `Schema version: ${manifest.schemaVersion}`,
  `Format backup: ${manifest.backupFormat} v${manifest.backupFormatVersion}`,
  `Kompresi: ${manifest.compression || "deflate"}`,
  "",
  "Restore hanya boleh dilakukan lewat UI resmi IMS.",
  "Jangan copy file database langsung ke folder data saat aplikasi aktif.",
  "Sebelum restore, aplikasi akan membuat pre-restore backup otomatis.",
  "",
].join("\n");

const createOfficialSqliteBackup = async (db, options = {}) => {
  const backupType = normalizeBackupType(options.type || options.backupType || "manual");
  const actor = options.actor || "system";
  const action = options.action || "backup_create";
  const createdAt = new Date();
  const schemaVersion = await getSchemaVersion(db);
  const timestamp = safeCompactTimestamp(createdAt);
  const targetDir = getBackupTypeDir(backupType);
  const tmpDir = path.join(env.backupDir, ".tmp", `${timestamp}-${backupType}-${crypto.randomBytes(4).toString("hex")}`);
  ensureDir(tmpDir);

  const packageFilename = `IMS-BF-BACKUP-${timestamp}-SV${schemaVersion}-${backupType}${BACKUP_FILE_SUFFIX}`;
  const packagePath = path.join(targetDir, packageFilename);
  const backupDbPath = path.join(tmpDir, SQLITE_PACKAGE_DATABASE_FILE);

  try {
    await db.exec("PRAGMA wal_checkpoint(FULL);");
    await db.exec(`VACUUM INTO ${sqliteStringLiteral(backupDbPath)};`);

    const validation = await validateSqliteFile(backupDbPath);
    if (!validation.valid) {
      throw new Error(`Backup database lokal tidak valid: integrity=${validation.integrityCheck}; foreignKey=${validation.foreignKeyCheck}`);
    }

    const dbStat = fs.statSync(backupDbPath);
    const databaseSha256 = await sha256File(backupDbPath);
    const manifest = {
      appName: "IMS Bunga Flanel",
      backupFormat: BACKUP_FORMAT,
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      backupType,
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
    ], packagePath, { compressionMethod: ZIP_COMPRESSION_DEFLATE });

    fs.writeFileSync(`${packagePath}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

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

const readBackupManifest = (backupPath) => {
  if (!backupPath) return null;
  const sidecarPath = `${backupPath}.manifest.json`;
  if (fs.existsSync(sidecarPath)) {
    return JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
  }
  if (isSupportedBackupPackageName(backupPath) && fs.existsSync(backupPath)) {
    const manifestBuffer = readBackupPackageEntry(backupPath, SQLITE_PACKAGE_MANIFEST_FILE);
    return manifestBuffer ? JSON.parse(manifestBuffer.toString("utf8")) : null;
  }
  return null;
};

const enrichBackupLog = (backup) => {
  if (!backup) return null;
  const fileExists = Boolean(backup.path && fs.existsSync(backup.path));
  let manifest = null;
  let manifestStatus = "missing";
  try {
    manifest = fileExists ? readBackupManifest(backup.path) : null;
    manifestStatus = manifest ? "available" : "missing";
  } catch (error) {
    manifestStatus = "invalid";
  }

  return {
    ...backup,
    fileExists,
    backupType: manifest?.backupType || (String(backup.filename || "").includes("pre-restore") ? "pre-restore" : "manual-import"),
    manifestStatus,
    manifest,
  };
};

const enrichBackupLogs = (rows = []) => rows.map(enrichBackupLog);

const extractBackupDatabaseToTemp = async (backup, tempDir) => {
  if (!backup?.path || !fs.existsSync(backup.path)) {
    throw new Error("File backup tidak ditemukan.");
  }

  ensureDir(tempDir);
  const extractedDbPath = path.join(tempDir, SQLITE_PACKAGE_DATABASE_FILE);
  const isPackage = isSupportedBackupPackageName(backup.filename || backup.path);

  if (!isPackage) {
    fs.copyFileSync(backup.path, extractedDbPath);
    const validation = await validateSqliteFile(extractedDbPath);
    return { dbPath: extractedDbPath, manifest: null, validation, compatibilityPackage: true };
  }

  const manifest = readBackupManifest(backup.path);
  if (!manifest || !SUPPORTED_BACKUP_FORMATS.has(manifest.backupFormat)) {
    throw new Error("Manifest backup IMS tidak valid atau tidak ditemukan.");
  }

  const databaseBuffer = readBackupPackageEntry(backup.path, SQLITE_PACKAGE_DATABASE_FILE);
  if (!databaseBuffer) throw new Error("File database tidak ditemukan di paket backup.");
  fs.writeFileSync(extractedDbPath, databaseBuffer);

  const checksum = await sha256File(extractedDbPath);
  if (manifest.databaseSha256 && checksum !== manifest.databaseSha256) {
    throw new Error("Checksum backup tidak sesuai. File backup kemungkinan rusak atau berubah.");
  }

  const validation = await validateSqliteFile(extractedDbPath);
  if (!validation.valid) {
    throw new Error(`Backup tidak lolos validasi: integrity=${validation.integrityCheck}; foreignKey=${validation.foreignKeyCheck}`);
  }

  return { dbPath: extractedDbPath, manifest, validation, compatibilityPackage: manifest.backupFormat === LEGACY_BACKUP_FORMAT };
};

const getBackupPreview = async (backup) => {
  const enriched = enrichBackupLog(backup);
  if (!enriched?.fileExists) {
    return { backup: enriched, validation: null, validForRestore: false };
  }

  const tempDir = path.join(env.backupDir, ".tmp", `preview-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
  try {
    const extracted = await extractBackupDatabaseToTemp(enriched, tempDir);
    return {
      backup: enriched,
      validation: extracted.validation,
      manifest: extracted.manifest || enriched.manifest,
      validForRestore: extracted.validation?.valid === true,
      compatibilityPackage: extracted.compatibilityPackage,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const ensureDailyBackupForToday = async () => {
  const db = await getDb();
  const today = safeCompactTimestamp(new Date()).slice(0, 8);
  const existing = await db.get(
    "SELECT id, filename FROM backup_logs WHERE (filename LIKE ? OR filename LIKE ?) ORDER BY id DESC LIMIT 1",
    [`IMS-BF-BACKUP-${today}-%-daily${BACKUP_FILE_SUFFIX}`, `IMS-BF-BACKUP-${today}-%-daily${LEGACY_BACKUP_FILE_SUFFIX}`]
  );
  if (existing) return { created: false, existing };

  const backup = await createOfficialSqliteBackup(db, {
    type: "daily",
    actor: "system",
    action: "backup_daily_auto_create",
    notes: "Backup harian otomatis saat layanan IMS start.",
  });
  return { created: true, backup };
};

module.exports = {
  BACKUP_FILE_SUFFIX,
  LEGACY_BACKUP_FILE_SUFFIX,
  RESTORE_CONFIRM_KEYWORD,
  SUPPORTED_BACKUP_FILE_SUFFIXES,
  createOfficialSqliteBackup,
  ensureDailyBackupForToday,
  enrichBackupLog,
  enrichBackupLogs,
  extractBackupDatabaseToTemp,
  getBackupPreview,
  isSupportedBackupPackageName,
  normalizeBackupFilename,
  readBackupManifest,
  sanitizeImportedBackupFilename,
  validateSqliteFile,
};
