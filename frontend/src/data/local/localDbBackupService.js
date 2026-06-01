import { getImsLocalDb } from "./imsLocalDb";
import {
  ensureLocalDbFoundationMeta,
  setLocalDbMeta,
} from "./localDbMeta";
import {
  LOCAL_DB_APP_NAME,
  LOCAL_DB_APP_VERSION,
  LOCAL_DB_BACKUP_TABLE_ALLOWLIST,
  LOCAL_DB_BACKUP_TYPE,
  LOCAL_DB_META_KEYS,
  LOCAL_DB_SCHEMA_VERSION,
} from "./localDbSchema";
import { getRepositoryModeStatus } from "../repositories/repositoryModeService";
import { sanitizeLocalDbBackupRows } from "./localDbSecurityPolicy";
import {
  createLocalDbBackupSummary,
  validateLocalDbBackupPayload,
} from "./localDbBackupValidator";

export const LOCAL_DB_BACKUP_RESTORE_CONFIRMATION = "RESTORE LOCAL DB BACKUP";

const nowIso = () => new Date().toISOString();

const cloneRows = (rows = []) => JSON.parse(JSON.stringify(rows));
const cloneSafeRows = (rows = []) => sanitizeLocalDbBackupRows(cloneRows(rows));

const toSafeTableList = (tableNames = LOCAL_DB_BACKUP_TABLE_ALLOWLIST) => {
  const allowlist = new Set(LOCAL_DB_BACKUP_TABLE_ALLOWLIST);
  return [...new Set(tableNames)].filter((tableName) => allowlist.has(tableName));
};

const createRestoreAuditLog = ({ tableNames, recordCounts, restoredAt }) => ({
  id: `local-db-restore-${Date.now()}`,
  module: "local_db_backup",
  action: "restore",
  referenceId: `RESTORE-${restoredAt}`,
  createdAt: restoredAt,
  metadata: {
    tableNames,
    recordCounts,
    scope: "local_indexeddb_backup_restore",
  },
});

export const createLocalDbBackupFilename = (date = new Date()) => {
  const stamp = date.toISOString().replace(/[:.]/g, "-");
  return `ims-bunga-flanel-local-db-backup-${stamp}.json`;
};

export const exportLocalDbBackup = async ({
  tableNames = LOCAL_DB_BACKUP_TABLE_ALLOWLIST,
} = {}) => {
  const db = getImsLocalDb();
  await ensureLocalDbFoundationMeta();

  const exportTables = toSafeTableList(tableNames);
  const tables = {};

  for (const tableName of exportTables) {
    tables[tableName] = cloneSafeRows(await db.table(tableName).toArray());
  }

  const exportedAt = nowIso();
  const repositoryStatus = await getRepositoryModeStatus();
  const backup = {
    app: LOCAL_DB_APP_NAME,
    appVersion: LOCAL_DB_APP_VERSION,
    type: LOCAL_DB_BACKUP_TYPE,
    schemaVersion: LOCAL_DB_SCHEMA_VERSION,
    sourceMode: repositoryStatus?.mode || "unknown",
    exportedAt,
    tableNames: exportTables,
    recordCounts: Object.fromEntries(
      exportTables.map((tableName) => [tableName, tables[tableName]?.length || 0])
    ),
    tables,
  };

  await setLocalDbMeta(LOCAL_DB_META_KEYS.LAST_BACKUP_EXPORTED_AT, exportedAt);

  return backup;
};

export const previewLocalDbBackupRestore = (payload) => {
  const validation = validateLocalDbBackupPayload(payload);

  return {
    ...validation,
    canRestore: validation.valid,
  };
};

export const dryRunLocalDbBackupRestore = (payload, { tableNames = null } = {}) => {
  const validation = validateLocalDbBackupPayload(payload);
  const backupTables = payload?.tables || {};
  const requestedTables = tableNames || Object.keys(backupTables);
  const restoreTables = toSafeTableList(requestedTables).filter((tableName) =>
    Object.prototype.hasOwnProperty.call(backupTables, tableName)
  );

  return {
    restored: false,
    dryRun: true,
    canRestore: validation.valid && restoreTables.length > 0,
    tableNames: restoreTables,
    recordCounts: Object.fromEntries(
      restoreTables.map((tableName) => [tableName, backupTables[tableName]?.length || 0])
    ),
    ...validation,
    warnings: restoreTables.length
      ? validation.warnings
      : [...validation.warnings, "Tidak ada table allowlist yang bisa direstore dari pilihan saat ini."],
  };
};

export const restoreLocalDbBackup = async (
  payload,
  {
    tableNames = null,
    clearExisting = true,
    dryRun = false,
  } = {}
) => {
  const validation = validateLocalDbBackupPayload(payload);
  if (!validation.valid || dryRun) {
    return {
      restored: false,
      dryRun,
      ...validation,
    };
  }

  const db = getImsLocalDb();
  const backupTables = payload.tables || {};
  const requestedTables = tableNames || Object.keys(backupTables);
  const restoreTables = toSafeTableList(requestedTables).filter((tableName) =>
    Object.prototype.hasOwnProperty.call(backupTables, tableName)
  );
  const restoredAt = nowIso();
  const recordCounts = Object.fromEntries(
    restoreTables.map((tableName) => [tableName, backupTables[tableName]?.length || 0])
  );

  if (!restoreTables.length) {
    return {
      restored: false,
      restoredAt,
      tableNames: [],
      recordCounts: {},
      summary: createLocalDbBackupSummary(payload),
      warnings: [...validation.warnings, "Tidak ada table foundation yang bisa direstore."],
    };
  }

  await db.transaction("rw", ...restoreTables.map((tableName) => db.table(tableName)), async () => {
    for (const tableName of restoreTables) {
      const table = db.table(tableName);
      if (clearExisting) {
        await table.clear();
      }
      await table.bulkPut(cloneSafeRows(backupTables[tableName]));
    }
  });

  await db.audit_logs.put(
    createRestoreAuditLog({
      tableNames: restoreTables,
      recordCounts,
      restoredAt,
    })
  );
  await setLocalDbMeta(LOCAL_DB_META_KEYS.LAST_BACKUP_IMPORTED_AT, restoredAt);
  await ensureLocalDbFoundationMeta();

  return {
    restored: true,
    restoredAt,
    tableNames: restoreTables,
    recordCounts,
    summary: createLocalDbBackupSummary(payload),
    warnings: validation.warnings,
  };
};

export const restoreLocalDbBackupWithGuard = async (
  payload,
  { confirmation = "", ...options } = {}
) => {
  if (confirmation !== LOCAL_DB_BACKUP_RESTORE_CONFIRMATION) {
    throw new Error(
      `Untuk restore Local DB, isi confirmation: ${LOCAL_DB_BACKUP_RESTORE_CONFIRMATION}`
    );
  }

  return restoreLocalDbBackup(payload, options);
};
