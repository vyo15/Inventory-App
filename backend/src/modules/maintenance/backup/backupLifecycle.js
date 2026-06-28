const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const env = require("../../../config/env");
const { getDb, runInTransaction, runSerializedDbOperation } = require("../../../db/connection");
const { createAuditLog } = require("../../../utils/auditLog");
const logger = require("../../../utils/logger");
const {
  BACKUP_LIFECYCLE_INTERVAL_MS,
  BACKUP_FILE_SUFFIX,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  DAILY_RETENTION_DAYS,
  LEGACY_BACKUP_FILE_SUFFIX,
  MONTHLY_RETENTION_COUNT,
  SQLITE_PACKAGE_CHECKSUM_FILE,
  SQLITE_PACKAGE_DATABASE_FILE,
  SQLITE_PACKAGE_MANIFEST_FILE,
  SQLITE_PACKAGE_README_FILE,
  ZIP_COMPRESSION_DEFLATE,
} = require("./backupConstants");
const {
  assertSufficientDiskSpace,
  ensureDir,
  getBackupCreatedAt,
  getBackupTypeDir,
  getMonthKey,
  getUniquePackagePath,
  isVerifiedBackup,
  safeCompactTimestamp,
} = require("./backupPath");
const {
  assertZip32EntrySize,
  buildReadme,
  createBackupPackage,
  sha256File,
} = require("./backupPackage");
const { createOfficialSqliteBackup } = require("./backupCreate");
const { enrichBackupLog, enrichBackupLogs, extractBackupDatabaseToTemp, getBackupPreview } = require("./backupValidation");

let backupLifecyclePromise = null;
let backupLifecycleTimer = null;
const backupLifecycleRuntime = {
  schedulerActive: false,
  intervalMs: BACKUP_LIFECYCLE_INTERVAL_MS,
  schedulerStartedAt: null,
  nextRunAt: null,
  running: false,
  lastTrigger: null,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastHealthyAt: null,
  lastError: null,
  lastSummary: null,
  skippedRuns: 0,
};

const ensureDailyBackupForTodayUnsafe = async ({ actor = "system", referenceDate = new Date() } = {}) => {
  const db = await getDb();
  const today = safeCompactTimestamp(referenceDate).slice(0, 8);
  const existingRows = await db.all(
    "SELECT * FROM backup_logs WHERE status != 'retention_deleted' AND (filename LIKE ? OR filename LIKE ?) ORDER BY id DESC",
    [`IMS-BF-BACKUP-${today}-%-daily${BACKUP_FILE_SUFFIX}`, `IMS-BF-BACKUP-${today}-%-daily${LEGACY_BACKUP_FILE_SUFFIX}`]
  );
  const existing = enrichBackupLogs(existingRows).find((backup) => backup.fileExists && isVerifiedBackup(backup));
  if (existing) return { created: false, existing };

  const backup = await createOfficialSqliteBackup(db, {
    type: "daily",
    actor,
    action: "backup_daily_auto_create",
    notes: "Backup harian otomatis IMS. Maksimal satu backup verified per hari.",
  });
  return { created: true, backup };
};

const ensureDailyBackupForToday = (options = {}) => runSerializedDbOperation(
  () => ensureDailyBackupForTodayUnsafe(options),
);

const createMonthlyBackupFromDaily = async (db, sourceBackup, { actor = "system" } = {}) => {
  const enrichedSource = enrichBackupLog(sourceBackup);
  if (!enrichedSource?.fileExists || enrichedSource.backupType !== "daily" || !isVerifiedBackup(enrichedSource)) {
    throw new Error("Backup daily sumber monthly tidak tersedia atau belum verified.");
  }

  const sourceCreatedAt = getBackupCreatedAt(enrichedSource);
  if (!sourceCreatedAt) throw new Error("Tanggal backup daily sumber monthly tidak valid.");

  const tmpDir = path.join(env.backupDir, ".tmp", `monthly-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`);
  ensureDir(tmpDir);

  try {
    const sourceSizeBytes = Number(
      enrichedSource.manifest?.databaseSizeBytes
      || enrichedSource.size_bytes
      || fs.statSync(enrichedSource.path).size,
    );
    assertZip32EntrySize(sourceSizeBytes, "database sumber monthly");
    assertSufficientDiskSpace({
      targetDir: tmpDir,
      expectedWriteBytes: sourceSizeBytes,
      copyCount: 2,
      operation: "Pembuatan arsip monthly",
    });

    const extracted = await extractBackupDatabaseToTemp(enrichedSource, tmpDir);
    if (!extracted.validation?.valid) throw new Error("Backup daily sumber monthly gagal integrity check.");

    const baseManifest = extracted.manifest || enrichedSource.manifest || {};
    const schemaVersion = extracted.validation.schemaVersion || baseManifest.schemaVersion || "unknown";
    const timestamp = safeCompactTimestamp(sourceCreatedAt);
    const targetDir = getBackupTypeDir("monthly");
    const requestedFilename = `IMS-BF-BACKUP-${timestamp}-SV${schemaVersion}-monthly${BACKUP_FILE_SUFFIX}`;
    const uniquePackage = getUniquePackagePath(targetDir, requestedFilename);
    const tmpPackagePath = path.join(tmpDir, uniquePackage.filename);
    const dbStat = fs.statSync(extracted.dbPath);
    assertZip32EntrySize(dbStat.size, SQLITE_PACKAGE_DATABASE_FILE);
    assertSufficientDiskSpace({
      targetDir: tmpDir,
      expectedWriteBytes: dbStat.size,
      operation: "Packaging arsip monthly",
    });
    const databaseSha256 = await sha256File(extracted.dbPath);
    const promotedAt = new Date().toISOString();
    const manifest = {
      ...baseManifest,
      appName: "IMS Bunga Flanel",
      backupFormat: BACKUP_FORMAT,
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      backupType: "monthly",
      storageClass: "monthly",
      createdAt: sourceCreatedAt.toISOString(),
      promotedAt,
      promotedFrom: enrichedSource.filename,
      schemaVersion,
      databaseFile: SQLITE_PACKAGE_DATABASE_FILE,
      databaseSizeBytes: dbStat.size,
      checksumAlgorithm: "sha256",
      databaseSha256,
      checksumFile: SQLITE_PACKAGE_CHECKSUM_FILE,
      compression: "deflate",
      packageExtension: BACKUP_FILE_SUFFIX,
      integrityCheck: extracted.validation.integrityCheck,
      foreignKeyCheck: extracted.validation.foreignKeyCheck,
      createdBy: actor,
      notes: `Arsip bulanan otomatis dari backup daily terakhir bulan ${getMonthKey(sourceCreatedAt)}.`,
      tables: extracted.validation.tables,
    };

    createBackupPackage([
      { name: SQLITE_PACKAGE_DATABASE_FILE, data: fs.readFileSync(extracted.dbPath) },
      { name: SQLITE_PACKAGE_MANIFEST_FILE, data: JSON.stringify(manifest, null, 2) },
      { name: SQLITE_PACKAGE_CHECKSUM_FILE, data: `${databaseSha256}  ${SQLITE_PACKAGE_DATABASE_FILE}\n` },
      { name: SQLITE_PACKAGE_README_FILE, data: buildReadme(manifest) },
    ], tmpPackagePath, { compressionMethod: ZIP_COMPRESSION_DEFLATE });

    const packagePreview = await getBackupPreview({
      filename: uniquePackage.filename,
      path: tmpPackagePath,
      status: "verified",
    });
    if (!packagePreview.validForRestore) throw new Error("Paket monthly gagal diverifikasi ulang.");

    fs.renameSync(tmpPackagePath, uniquePackage.path);
    const packageStat = fs.statSync(uniquePackage.path);
    const result = await db.run(
      `INSERT INTO backup_logs (filename, path, size_bytes, status, created_at)
       VALUES (?, ?, ?, 'verified', ?)`,
      [uniquePackage.filename, uniquePackage.path, packageStat.size, sourceCreatedAt.toISOString()]
    );

    const summary = {
      id: result.lastID,
      filename: uniquePackage.filename,
      path: uniquePackage.path,
      sizeBytes: packageStat.size,
      status: "verified",
      backupType: "monthly",
      storageClass: "monthly",
      manifest,
    };

    await createAuditLog({
      module: "maintenance",
      action: "backup_monthly_promote",
      entityType: "backup_log",
      entityId: result.lastID,
      actor,
      description: "Backup monthly otomatis dibuat dari daily terakhir yang verified",
      metadata: {
        ...summary,
        sourceBackupId: enrichedSource.id,
        sourceBackupFilename: enrichedSource.filename,
      },
    });

    return summary;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};

const ensureMonthlyBackupsUnsafe = async ({ actor = "system", referenceDate = new Date() } = {}) => {
  const db = await getDb();
  const rows = await db.all(
    "SELECT * FROM backup_logs WHERE status IN ('verified', 'success') ORDER BY created_at DESC, id DESC"
  );
  const backups = enrichBackupLogs(rows).filter((backup) => backup.fileExists && isVerifiedBackup(backup));
  const currentMonth = getMonthKey(referenceDate);
  const existingMonths = new Set(
    backups.filter((backup) => backup.backupType === "monthly").map((backup) => getMonthKey(getBackupCreatedAt(backup))).filter(Boolean)
  );
  const latestDailyByMonth = new Map();

  for (const backup of backups) {
    if (backup.backupType !== "daily") continue;
    const createdAt = getBackupCreatedAt(backup);
    const monthKey = getMonthKey(createdAt);
    if (!createdAt || !monthKey || monthKey >= currentMonth) continue;
    const existing = latestDailyByMonth.get(monthKey);
    if (!existing || createdAt > existing.createdAt) latestDailyByMonth.set(monthKey, { backup, createdAt });
  }

  const candidates = [...latestDailyByMonth.entries()]
    .sort(([monthA], [monthB]) => monthB.localeCompare(monthA))
    .slice(0, MONTHLY_RETENTION_COUNT);
  const created = [];
  const errors = [];

  for (const [monthKey, candidate] of candidates) {
    if (existingMonths.has(monthKey)) continue;
    try {
      const monthly = await createMonthlyBackupFromDaily(db, candidate.backup, { actor });
      created.push(monthly);
      existingMonths.add(monthKey);
    } catch (error) {
      errors.push({
        monthKey,
        sourceBackupFilename: candidate.backup?.filename || null,
        message: error?.message || "Promosi monthly gagal.",
      });
    }
  }

  return { created, errors };
};

const ensureMonthlyBackups = (options = {}) => runSerializedDbOperation(
  () => ensureMonthlyBackupsUnsafe(options),
);

const removeBackupByRetention = async (db, backup, { actor = "system", reason } = {}) => {
  const trashDir = path.join(env.backupDir, ".tmp", "retention-trash");
  ensureDir(trashDir);
  const movedFiles = [];

  const moveToTrash = (sourcePath) => {
    if (!sourcePath || !fs.existsSync(sourcePath)) return;
    const trashPath = path.join(
      trashDir,
      `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${path.basename(sourcePath)}`,
    );
    fs.renameSync(sourcePath, trashPath);
    movedFiles.push({ sourcePath, trashPath });
  };

  try {
    moveToTrash(backup?.path);
    moveToTrash(backup?.path ? `${backup.path}.manifest.json` : "");

    await runInTransaction(async (transactionDb) => {
      if (backup?.id) {
        await transactionDb.run("UPDATE backup_logs SET status = 'retention_deleted' WHERE id = ?", [backup.id]);
      }

      await createAuditLog({
        module: "maintenance",
        action: "backup_retention_delete",
        entityType: "backup_log",
        entityId: backup?.id || backup?.filename,
        actor,
        description: "File backup dihapus otomatis sesuai kebijakan retensi",
        metadata: {
          filename: backup?.filename,
          path: backup?.path,
          backupType: backup?.backupType,
          storageClass: backup?.storageClass,
          createdAt: backup?.manifest?.createdAt || backup?.created_at,
          reason,
        },
      });
    }, { label: "maintenance_backup_retention_delete" });
  } catch (error) {
    for (const moved of [...movedFiles].reverse()) {
      if (fs.existsSync(moved.trashPath) && !fs.existsSync(moved.sourcePath)) {
        fs.renameSync(moved.trashPath, moved.sourcePath);
      }
    }
    throw error;
  }

  const cleanupErrors = [];
  for (const moved of movedFiles) {
    try {
      fs.rmSync(moved.trashPath, { force: true });
    } catch (error) {
      cleanupErrors.push({ path: moved.trashPath, message: error?.message || String(error) });
    }
  }
  if (cleanupErrors.length) {
    logger.warn("backup_retention_trash_cleanup_failed", {
      filename: backup?.filename,
      cleanupErrors,
    });
  }

  return {
    id: backup?.id,
    filename: backup?.filename,
    reason,
    cleanupPending: cleanupErrors.length > 0,
  };
};

const applyBackupRetentionUnsafe = async ({ actor = "system", referenceDate = new Date() } = {}) => {
  const db = await getDb();
  const rows = await db.all(
    "SELECT * FROM backup_logs WHERE status IN ('verified', 'success') ORDER BY created_at DESC, id DESC"
  );
  const backups = enrichBackupLogs(rows).filter((backup) => backup.fileExists && isVerifiedBackup(backup));
  const deleted = [];

  const monthlyByMonth = new Map();
  for (const backup of backups.filter((item) => item.backupType === "monthly")) {
    const monthKey = getMonthKey(getBackupCreatedAt(backup));
    if (!monthKey) continue;
    const list = monthlyByMonth.get(monthKey) || [];
    list.push(backup);
    monthlyByMonth.set(monthKey, list);
  }

  const monthlyKeys = [...monthlyByMonth.keys()].sort((a, b) => b.localeCompare(a));
  const keptMonthlyKeys = new Set(monthlyKeys.slice(0, MONTHLY_RETENTION_COUNT));

  for (const [monthKey, monthBackups] of monthlyByMonth.entries()) {
    monthBackups.sort((a, b) => (getBackupCreatedAt(b)?.getTime() || 0) - (getBackupCreatedAt(a)?.getTime() || 0));
    const keepFirst = keptMonthlyKeys.has(monthKey);
    for (let index = keepFirst ? 1 : 0; index < monthBackups.length; index += 1) {
      deleted.push(await removeBackupByRetention(db, monthBackups[index], {
        actor,
        reason: keepFirst ? "monthly_duplicate" : "monthly_retention_over_12",
      }));
    }
  }

  const verifiedMonthlyMonths = new Set(monthlyKeys);
  const retentionCutoff = referenceDate.getTime() - DAILY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  for (const backup of backups.filter((item) => item.backupType === "daily")) {
    const createdAt = getBackupCreatedAt(backup);
    if (!createdAt || createdAt.getTime() >= retentionCutoff) continue;
    const monthKey = getMonthKey(createdAt);
    if (!verifiedMonthlyMonths.has(monthKey)) continue;
    deleted.push(await removeBackupByRetention(db, backup, {
      actor,
      reason: `daily_older_than_${DAILY_RETENTION_DAYS}_days_monthly_available`,
    }));
  }

  return { deleted };
};

const applyBackupRetention = (options = {}) => runSerializedDbOperation(
  () => applyBackupRetentionUnsafe(options),
);

const getBackupLifecycleRuntimeStatus = () => ({
  ...backupLifecycleRuntime,
  lastSummary: backupLifecycleRuntime.lastSummary
    ? { ...backupLifecycleRuntime.lastSummary }
    : null,
});

const summarizeLifecycleResult = (result = {}) => ({
  dailyCreated: result.daily?.created === true,
  monthlyCreatedCount: Number(result.monthly?.created?.length || 0),
  retentionDeletedCount: Number(result.retention?.deleted?.length || 0),
  errorCount: Number(result.errors?.length || 0),
});

const runBackupLifecycleMaintenance = async ({
  actor = "system",
  referenceDate = new Date(),
  trigger = "manual",
} = {}) => {
  if (backupLifecyclePromise) return backupLifecyclePromise;

  const startedAt = new Date();
  backupLifecycleRuntime.running = true;
  backupLifecycleRuntime.lastTrigger = trigger;
  backupLifecycleRuntime.lastStartedAt = startedAt.toISOString();
  backupLifecycleRuntime.lastError = null;

  backupLifecyclePromise = (async () => {
    const errors = [];
    let monthly = { created: [], errors: [] };
    let retention = { deleted: [], errors: [] };
    let daily = { created: false, existing: null, error: null };

    try {
      monthly = await ensureMonthlyBackups({ actor, referenceDate });
      errors.push(...(monthly.errors || []).map((error) => ({ phase: "monthly", ...error })));
    } catch (error) {
      const phaseError = { phase: "monthly", message: error?.message || "Promosi monthly gagal." };
      monthly = { created: [], errors: [phaseError] };
      errors.push(phaseError);
    }

    try {
      retention = { ...(await applyBackupRetention({ actor, referenceDate })), errors: [] };
    } catch (error) {
      const phaseError = { phase: "retention", message: error?.message || "Cleanup retention gagal." };
      retention = { deleted: [], errors: [phaseError] };
      errors.push(phaseError);
    }

    try {
      daily = await ensureDailyBackupForToday({ actor, referenceDate });
    } catch (error) {
      const phaseError = { phase: "daily", message: error?.message || "Backup daily gagal." };
      daily = { created: false, existing: null, error: phaseError };
      errors.push(phaseError);
    }

    const result = { monthly, retention, daily, errors };
    const completedAt = new Date();
    backupLifecycleRuntime.lastCompletedAt = completedAt.toISOString();
    backupLifecycleRuntime.lastSummary = summarizeLifecycleResult(result);
    backupLifecycleRuntime.lastError = errors.length ? errors[0].message : null;
    if (!errors.length) backupLifecycleRuntime.lastHealthyAt = completedAt.toISOString();
    return result;
  })();

  try {
    return await backupLifecyclePromise;
  } catch (error) {
    backupLifecycleRuntime.lastCompletedAt = new Date().toISOString();
    backupLifecycleRuntime.lastError = error?.message || String(error);
    throw error;
  } finally {
    backupLifecycleRuntime.running = false;
    backupLifecyclePromise = null;
  }
};

const scheduleNextLifecycleRun = () => {
  backupLifecycleRuntime.nextRunAt = backupLifecycleRuntime.schedulerActive
    ? new Date(Date.now() + backupLifecycleRuntime.intervalMs).toISOString()
    : null;
};

const runScheduledBackupLifecycleMaintenance = async () => {
  if (backupLifecyclePromise) {
    backupLifecycleRuntime.skippedRuns += 1;
    scheduleNextLifecycleRun();
    logger.warn("backup_lifecycle_interval_skipped", { reason: "previous_run_still_active" });
    return;
  }

  try {
    const result = await runBackupLifecycleMaintenance({ actor: "system", trigger: "interval" });
    const summary = summarizeLifecycleResult(result);
    const logMethod = summary.errorCount > 0 ? logger.warn : logger.info;
    logMethod("backup_lifecycle_interval_completed", summary);
  } catch (error) {
    logger.warn("backup_lifecycle_interval_failed", { error });
  } finally {
    scheduleNextLifecycleRun();
  }
};

const startBackupLifecycleScheduler = ({ intervalMs = BACKUP_LIFECYCLE_INTERVAL_MS } = {}) => {
  if (backupLifecycleTimer) return getBackupLifecycleRuntimeStatus();
  const normalizedIntervalMs = Number(intervalMs);
  if (!Number.isInteger(normalizedIntervalMs) || normalizedIntervalMs < 10) {
    throw new Error("Interval lifecycle backup tidak valid.");
  }

  backupLifecycleRuntime.schedulerActive = true;
  backupLifecycleRuntime.intervalMs = normalizedIntervalMs;
  backupLifecycleRuntime.schedulerStartedAt = new Date().toISOString();
  scheduleNextLifecycleRun();
  backupLifecycleTimer = setInterval(() => {
    void runScheduledBackupLifecycleMaintenance();
  }, normalizedIntervalMs);
  backupLifecycleTimer.unref?.();

  logger.info("backup_lifecycle_scheduler_started", {
    intervalMs: normalizedIntervalMs,
    nextRunAt: backupLifecycleRuntime.nextRunAt,
  });
  return getBackupLifecycleRuntimeStatus();
};

const stopBackupLifecycleScheduler = () => {
  if (backupLifecycleTimer) clearInterval(backupLifecycleTimer);
  backupLifecycleTimer = null;
  backupLifecycleRuntime.schedulerActive = false;
  backupLifecycleRuntime.nextRunAt = null;
  logger.info("backup_lifecycle_scheduler_stopped");
  return getBackupLifecycleRuntimeStatus();
};

module.exports = {
  applyBackupRetention,
  createMonthlyBackupFromDaily,
  ensureDailyBackupForToday,
  ensureMonthlyBackups,
  getBackupLifecycleRuntimeStatus,
  runBackupLifecycleMaintenance,
  startBackupLifecycleScheduler,
  stopBackupLifecycleScheduler,
};
