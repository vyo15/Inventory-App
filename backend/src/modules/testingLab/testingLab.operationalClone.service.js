const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const env = require("../../config/env");
const { getDbPath } = require("../../db/connection");
const {
  assertSufficientDiskSpace,
  inspectManagedBackupPath,
  validateSqliteFile,
} = require("../maintenance/backup");
const { ensureDir, sqliteStringLiteral } = require("../maintenance/backup/backupPath");
const { createHttpError } = require("../maintenance/maintenance.shared");

const SOURCE_SNAPSHOT_FILENAME = "operational-source.sqlite";

const getPathIdentity = (candidatePath) => env.getRuntimePathIdentity(path.resolve(candidatePath));

const getOperationalSourcePath = () => path.resolve(
  env.operationalSourceDbPath || env.defaultDbPath,
);

const inspectOperationalSourcePath = () => {
  const sourcePath = getOperationalSourcePath();
  const activeSandboxPath = path.resolve(getDbPath());

  if (getPathIdentity(sourcePath) === getPathIdentity(activeSandboxPath)) {
    throw createHttpError(
      "Database sumber operasional tidak boleh sama dengan database sandbox aktif.",
      409,
      "TESTING_LAB_OPERATIONAL_SOURCE_EQUALS_SANDBOX",
    );
  }
  if (!fs.existsSync(sourcePath)) {
    throw createHttpError(
      "Database operasional sumber belum ditemukan. Jalankan mode operasional terlebih dahulu atau periksa path database.",
      404,
      "TESTING_LAB_OPERATIONAL_SOURCE_NOT_FOUND",
    );
  }

  const sourceLstat = fs.lstatSync(sourcePath);
  if (!sourceLstat.isFile() || sourceLstat.isSymbolicLink()) {
    throw createHttpError(
      "Database operasional sumber harus berupa file biasa dan bukan symlink.",
      409,
      "TESTING_LAB_OPERATIONAL_SOURCE_PATH_UNSAFE",
    );
  }
  if (env.isTestRuntime) {
    env.assertSafeTestRuntimePath(sourcePath, "database sumber operasional test");
  }

  return {
    sourcePath,
    activeSandboxPath,
    stat: fs.statSync(sourcePath),
  };
};

const getOperationalSourcePreview = async () => {
  const inspection = inspectOperationalSourcePath();
  const validation = await validateSqliteFile(inspection.sourcePath);
  return {
    available: true,
    filename: path.basename(inspection.sourcePath),
    directoryName: path.basename(path.dirname(inspection.sourcePath)),
    sizeBytes: inspection.stat.size,
    modifiedAt: inspection.stat.mtime.toISOString(),
    schemaVersion: validation.schemaVersion,
    integrityCheck: validation.integrityCheck,
    foreignKeyCheck: validation.foreignKeyCheck,
    valid: validation.valid,
    safeForClone: validation.valid && validation.restoreSafety?.accountGuardPassed === true,
    accountSummary: validation.accountSummary,
    businessSummary: validation.businessSummary,
    tableCounts: validation.tables,
    restoreSafety: validation.restoreSafety,
  };
};

const sanitizeSnapshotDatabase = async (snapshotPath) => {
  const db = await open({ filename: snapshotPath, driver: sqlite3.Database });
  try {
    await db.exec("PRAGMA foreign_keys = ON;");
    await db.exec("BEGIN IMMEDIATE TRANSACTION;");
    try {
      const sessionResult = await db.run("DELETE FROM local_user_sessions");
      const backupResult = await db.run("DELETE FROM backup_logs");
      const restoreResult = await db.run("DELETE FROM restore_logs");
      const settingsResult = await db.run("DELETE FROM app_settings WHERE key LIKE 'testing_lab.%'");
      const testingAuditResult = await db.run("DELETE FROM audit_logs WHERE module = 'testing_lab'");
      const operationalBackupAuditResult = await db.run(
        "DELETE FROM audit_logs WHERE module = 'maintenance' AND entity_type IN ('backup_log', 'restore_log')",
      );
      await db.exec("COMMIT;");
      return {
        revokedSessions: Number(sessionResult?.changes || 0),
        removedBackupLogs: Number(backupResult?.changes || 0),
        removedRestoreLogs: Number(restoreResult?.changes || 0),
        removedTestingSettings: Number(settingsResult?.changes || 0),
        removedTestingAuditRows: Number(testingAuditResult?.changes || 0),
        removedOperationalBackupAuditRows: Number(operationalBackupAuditResult?.changes || 0),
      };
    } catch (error) {
      await db.exec("ROLLBACK;").catch(() => {});
      throw error;
    }
  } finally {
    await db.close();
  }
};

const createSanitizedOperationalSnapshot = async () => {
  const inspection = inspectOperationalSourcePath();
  const sourceWalPath = `${inspection.sourcePath}-wal`;
  const sourceWalSize = fs.existsSync(sourceWalPath) ? fs.statSync(sourceWalPath).size : 0;
  const expectedLogicalBytes = inspection.stat.size + sourceWalSize;
  const tempDir = path.join(
    env.backupDir,
    ".tmp",
    `operational-clone-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
  );
  ensureDir(tempDir);
  inspectManagedBackupPath(tempDir, {
    allowDirectory: true,
    allowInternalTmp: true,
    mustExist: true,
  });
  const snapshotPath = path.join(tempDir, SOURCE_SNAPSHOT_FILENAME);

  try {
    assertSufficientDiskSpace({
      targetDir: tempDir,
      expectedWriteBytes: expectedLogicalBytes,
      copyCount: 3,
      operation: "Clone database operasional ke sandbox",
    });

    const sourceBefore = fs.statSync(inspection.sourcePath);
    const sourceDb = await open({
      filename: inspection.sourcePath,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READONLY,
    });
    try {
      await sourceDb.exec("PRAGMA busy_timeout = 5000;");
      await sourceDb.exec(`VACUUM INTO ${sqliteStringLiteral(snapshotPath)};`);
    } finally {
      await sourceDb.close();
    }

    const rawValidation = await validateSqliteFile(snapshotPath);
    if (!rawValidation.valid || rawValidation.restoreSafety?.accountGuardPassed !== true) {
      const error = createHttpError(
        "Snapshot operasional tidak lolos integrity, foreign-key, atau administrator guard.",
        409,
        "TESTING_LAB_OPERATIONAL_SNAPSHOT_INVALID",
      );
      error.validation = rawValidation;
      throw error;
    }

    const sanitization = await sanitizeSnapshotDatabase(snapshotPath);
    const sanitizedValidation = await validateSqliteFile(snapshotPath);
    if (!sanitizedValidation.valid || sanitizedValidation.restoreSafety?.accountGuardPassed !== true) {
      const error = createHttpError(
        "Snapshot operasional hasil sanitasi tidak aman digunakan sebagai baseline sandbox.",
        409,
        "TESTING_LAB_OPERATIONAL_SNAPSHOT_SANITIZE_FAILED",
      );
      error.validation = sanitizedValidation;
      throw error;
    }

    const sourceAfter = fs.statSync(inspection.sourcePath);
    return {
      snapshotPath,
      tempDir,
      source: {
        filename: path.basename(inspection.sourcePath),
        sizeBytes: sourceAfter.size,
        modifiedAt: sourceAfter.mtime.toISOString(),
        changedDuringSnapshot: sourceBefore.size !== sourceAfter.size
          || sourceBefore.mtimeMs !== sourceAfter.mtimeMs,
      },
      validation: sanitizedValidation,
      sanitization,
      cleanup: () => {
        inspectManagedBackupPath(tempDir, {
          allowDirectory: true,
          allowInternalTmp: true,
          mustExist: true,
        });
        fs.rmSync(tempDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    if (fs.existsSync(tempDir)) {
      inspectManagedBackupPath(tempDir, {
        allowDirectory: true,
        allowInternalTmp: true,
        mustExist: true,
      });
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    throw error;
  }
};

module.exports = {
  createSanitizedOperationalSnapshot,
  getOperationalSourcePath,
  getOperationalSourcePreview,
  inspectOperationalSourcePath,
  sanitizeSnapshotDatabase,
};
