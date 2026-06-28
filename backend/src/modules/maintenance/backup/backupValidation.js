const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const env = require("../../../config/env");
const {
  LEGACY_BACKUP_FORMAT,
  SQLITE_PACKAGE_DATABASE_FILE,
  SQLITE_PACKAGE_MANIFEST_FILE,
  SUPPORTED_BACKUP_FORMATS,
} = require("./backupConstants");
const {
  assertManagedBackupFile,
  assertManagedBackupRecord,
  assertSufficientDiskSpace,
  ensureDir,
  getBackupStorageClass,
  getManagedBackupRecordStatus,
  inspectManagedBackupPath,
  isSupportedBackupPackageName,
} = require("./backupPath");
const { readBackupPackageEntry, sha256File } = require("./backupPackage");

const BUSINESS_SUMMARY_TABLES = Object.freeze({
  products: "products",
  rawMaterials: "raw_materials",
  semiFinishedMaterials: "semi_finished_materials",
  suppliers: "suppliers",
  customers: "customers",
  purchases: "purchases",
  sales: "sales",
  returns: "returns",
  productionOrders: "production_orders",
  financeLedger: "money_movement_ledger",
});

const openSqliteReadOnly = async (filename) => open({
  filename,
  driver: sqlite3.Database,
  mode: sqlite3.OPEN_READONLY,
});

const getSchemaVersion = async (db) => {
  const row = await db.get("SELECT value FROM schema_meta WHERE key = 'schema_version'").catch(() => null);
  return row?.value || "unknown";
};

const getExistingTableNames = async (db) => {
  const tables = await db.all(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).catch(() => []);

  return new Set(tables.map((table) => String(table.name || "")).filter(Boolean));
};

const getTableCounts = async (db) => {
  const tableNames = await getExistingTableNames(db);
  const counts = {};

  for (const tableName of tableNames) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) continue;
    const row = await db.get(`SELECT COUNT(*) AS count FROM ${tableName}`).catch(() => null);
    counts[tableName] = Number(row?.count || 0);
  }
  return counts;
};

const getBackupAccountSummary = async (db, existingTableNames = null) => {
  const tableNames = existingTableNames || await getExistingTableNames(db);
  const usersTableExists = tableNames.has("users");

  if (!usersTableExists) {
    return {
      usersTableExists: false,
      inspectionAvailable: true,
      totalUsers: 0,
      activeUsers: 0,
      administratorUsers: 0,
      activeAdministrators: 0,
      inactiveAdministrators: 0,
      setupRequiredAfterRestore: true,
    };
  }

  const row = await db.get(`
    SELECT
      COUNT(*) AS total_users,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_users,
      SUM(CASE WHEN role = 'administrator' THEN 1 ELSE 0 END) AS administrator_users,
      SUM(CASE WHEN role = 'administrator' AND status = 'active' THEN 1 ELSE 0 END) AS active_administrators,
      SUM(CASE WHEN role = 'administrator' AND status <> 'active' THEN 1 ELSE 0 END) AS inactive_administrators
    FROM users
  `).catch(() => null);

  if (!row) {
    return {
      usersTableExists: true,
      inspectionAvailable: false,
      totalUsers: 0,
      activeUsers: 0,
      administratorUsers: 0,
      activeAdministrators: 0,
      inactiveAdministrators: 0,
      setupRequiredAfterRestore: true,
    };
  }

  const activeAdministrators = Number(row.active_administrators || 0);
  return {
    usersTableExists: true,
    inspectionAvailable: true,
    totalUsers: Number(row.total_users || 0),
    activeUsers: Number(row.active_users || 0),
    administratorUsers: Number(row.administrator_users || 0),
    activeAdministrators,
    inactiveAdministrators: Number(row.inactive_administrators || 0),
    setupRequiredAfterRestore: activeAdministrators < 1,
  };
};

const getBackupBusinessSummary = async (db, existingTableNames = null) => {
  const tableNames = existingTableNames || await getExistingTableNames(db);
  const summary = {};

  for (const [summaryKey, tableName] of Object.entries(BUSINESS_SUMMARY_TABLES)) {
    if (!tableNames.has(tableName)) {
      summary[summaryKey] = 0;
      continue;
    }
    const row = await db.get(`SELECT COUNT(*) AS count FROM ${tableName}`).catch(() => null);
    summary[summaryKey] = Number(row?.count || 0);
  }

  return summary;
};

const getRestoreSafetySummary = ({ accountSummary = {}, businessSummary = {} } = {}) => {
  const accountGuardPassed = Boolean(
    accountSummary.usersTableExists
    && accountSummary.inspectionAvailable !== false
    && Number(accountSummary.activeAdministrators || 0) > 0
  );
  const businessRecordCount = Object.values(businessSummary)
    .reduce((total, value) => total + Number(value || 0), 0);
  const likelyEmptyDatabase = Number(accountSummary.totalUsers || 0) === 0 && businessRecordCount === 0;
  const messages = [];

  if (!accountSummary.usersTableExists) {
    messages.push("Backup tidak memiliki tabel user yang dapat dipakai untuk login.");
  } else if (accountSummary.inspectionAvailable === false) {
    messages.push("Data akun pada backup tidak dapat diperiksa dengan aman.");
  } else if (Number(accountSummary.activeAdministrators || 0) < 1) {
    messages.push("Backup tidak memiliki administrator aktif.");
    messages.push("Restore normal diblokir. Pilih backup lain yang memiliki administrator aktif.");
  }

  if (likelyEmptyDatabase) {
    messages.push("Backup tampak seperti database awal atau kosong.");
  }

  return {
    accountGuardPassed,
    likelyEmptyDatabase,
    severity: accountGuardPassed ? (likelyEmptyDatabase ? "warning" : "safe") : "blocked",
    messages,
  };
};

const validateSqliteFile = async (dbFilePath) => {
  const backupDb = await openSqliteReadOnly(dbFilePath);
  try {
    const integrityRows = await backupDb.all("PRAGMA integrity_check;");
    const foreignKeyRows = await backupDb.all("PRAGMA foreign_key_check;");
    const schemaVersion = await getSchemaVersion(backupDb);
    const existingTableNames = await getExistingTableNames(backupDb);
    const tables = await getTableCounts(backupDb);
    const accountSummary = await getBackupAccountSummary(backupDb, existingTableNames);
    const businessSummary = await getBackupBusinessSummary(backupDb, existingTableNames);
    const restoreSafety = getRestoreSafetySummary({ accountSummary, businessSummary });
    const integrityMessages = integrityRows.map((row) => row.integrity_check || Object.values(row)[0]).filter(Boolean);
    const integrityOk = integrityMessages.length === 1 && String(integrityMessages[0]).toLowerCase() === "ok";

    return {
      integrityCheck: integrityOk ? "ok" : integrityMessages.join("; ") || "unknown",
      foreignKeyCheck: foreignKeyRows.length ? `${foreignKeyRows.length} issue(s)` : "ok",
      foreignKeyIssues: foreignKeyRows,
      schemaVersion,
      tables,
      accountSummary,
      businessSummary,
      restoreSafety,
      valid: integrityOk && foreignKeyRows.length === 0,
    };
  } finally {
    await backupDb.close();
  }
};
const readBackupManifest = (backupPath) => {
  if (!backupPath) return null;
  const managedPath = assertManagedBackupFile(backupPath, {
    allowInternalTmp: true,
    mustExist: true,
    requireBackupArtifact: true,
  });
  const sidecarPath = `${managedPath}.manifest.json`;
  if (fs.existsSync(sidecarPath)) {
    return JSON.parse(fs.readFileSync(sidecarPath, "utf8"));
  }
  if (isSupportedBackupPackageName(managedPath)) {
    const manifestBuffer = readBackupPackageEntry(managedPath, SQLITE_PACKAGE_MANIFEST_FILE);
    return manifestBuffer ? JSON.parse(manifestBuffer.toString("utf8")) : null;
  }
  return null;
};

const enrichBackupLog = (backup, { allowInternalTmp = false } = {}) => {
  if (!backup) return null;
  const pathStatus = getManagedBackupRecordStatus(backup, {
    allowInternalTmp,
    mustExist: false,
  });
  const fileExists = pathStatus.managed && pathStatus.exists;
  let manifest = null;
  let manifestStatus = pathStatus.managed ? "missing" : "unmanaged";
  try {
    manifest = fileExists ? readBackupManifest(pathStatus.path) : null;
    if (pathStatus.managed) manifestStatus = manifest ? "available" : "missing";
  } catch {
    manifestStatus = "invalid";
  }

  return {
    ...backup,
    fileExists,
    managedPath: pathStatus.managed,
    pathErrorCode: pathStatus.errorCode,
    pathErrorMessage: pathStatus.errorMessage,
    backupType: manifest?.backupType || (String(backup.filename || "").includes("pre-restore") ? "pre-restore" : "manual-import"),
    storageClass: pathStatus.storageClass || getBackupStorageClass(manifest?.backupType || backup.backupType),
    manifestStatus,
    manifest,
  };
};

const enrichBackupLogs = (rows = []) => rows.map(enrichBackupLog);

const extractBackupDatabaseToTemp = async (backup, tempDir) => {
  const sourcePath = assertManagedBackupRecord(backup, {
    allowInternalTmp: true,
    mustExist: true,
  });

  ensureDir(tempDir);
  const extractedDbPath = path.join(tempDir, SQLITE_PACKAGE_DATABASE_FILE);
  const isPackage = isSupportedBackupPackageName(backup.filename || sourcePath);

  if (!isPackage) {
    const sourceStat = fs.statSync(sourcePath);
    assertSufficientDiskSpace({
      targetDir: tempDir,
      expectedWriteBytes: sourceStat.size,
      operation: "Ekstraksi backup legacy",
    });
    fs.copyFileSync(sourcePath, extractedDbPath);
    const validation = await validateSqliteFile(extractedDbPath);
    return { dbPath: extractedDbPath, manifest: null, validation, compatibilityPackage: true };
  }

  const manifest = readBackupManifest(sourcePath);
  if (!manifest || !SUPPORTED_BACKUP_FORMATS.has(manifest.backupFormat)) {
    throw new Error("Manifest backup IMS tidak valid atau tidak ditemukan.");
  }

  const fallbackPackageSize = fs.statSync(sourcePath).size;
  const expectedDatabaseSize = Number(manifest.databaseSizeBytes || fallbackPackageSize);
  assertSufficientDiskSpace({
    targetDir: tempDir,
    expectedWriteBytes: expectedDatabaseSize,
    operation: "Ekstraksi database dari paket backup",
  });

  const databaseBuffer = readBackupPackageEntry(sourcePath, SQLITE_PACKAGE_DATABASE_FILE);
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

const getBackupPreview = async (backup, { allowInternalTmp = false } = {}) => {
  const enriched = enrichBackupLog(backup, { allowInternalTmp });
  if (!enriched?.fileExists) {
    return { backup: enriched, validation: null, validForRestore: false, safeForRestore: false };
  }

  const tempDir = path.join(env.backupDir, ".tmp", `preview-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
  ensureDir(tempDir);
  inspectManagedBackupPath(tempDir, {
    allowDirectory: true,
    allowInternalTmp: true,
    mustExist: true,
  });
  try {
    const extracted = await extractBackupDatabaseToTemp(enriched, tempDir);
    const validForRestore = extracted.validation?.valid === true;
    const restoreSafety = extracted.validation?.restoreSafety || getRestoreSafetySummary();
    return {
      backup: enriched,
      validation: extracted.validation,
      manifest: extracted.manifest || enriched.manifest,
      accountSummary: extracted.validation?.accountSummary || null,
      businessSummary: extracted.validation?.businessSummary || null,
      restoreSafety,
      validForRestore,
      safeForRestore: validForRestore && restoreSafety.accountGuardPassed === true,
      compatibilityPackage: extracted.compatibilityPackage,
    };
  } finally {
    inspectManagedBackupPath(tempDir, {
      allowDirectory: true,
      allowInternalTmp: true,
      mustExist: true,
    });
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

module.exports = {
  enrichBackupLog,
  enrichBackupLogs,
  extractBackupDatabaseToTemp,
  getBackupAccountSummary,
  getBackupBusinessSummary,
  getBackupPreview,
  getRestoreSafetySummary,
  getSchemaVersion,
  getTableCounts,
  readBackupManifest,
  validateSqliteFile,
};
