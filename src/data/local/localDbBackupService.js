import { getImsLocalDb } from "./imsLocalDb";
import {
  ensureLocalDbFoundationMeta,
  setLocalDbMeta,
} from "./localDbMeta";
import {
  LOCAL_DB_APP_NAME,
  LOCAL_DB_BACKUP_TABLE_ALLOWLIST,
  LOCAL_DB_BACKUP_TYPE,
  LOCAL_DB_META_KEYS,
  LOCAL_DB_SCHEMA_VERSION,
} from "./localDbSchema";
import {
  createLocalDbBackupSummary,
  validateLocalDbBackupPayload,
} from "./localDbBackupValidator";

const nowIso = () => new Date().toISOString();

const cloneRows = (rows = []) => JSON.parse(JSON.stringify(rows));

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
    scope: "foundation",
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
    tables[tableName] = cloneRows(await db.table(tableName).toArray());
  }

  const exportedAt = nowIso();
  const backup = {
    app: LOCAL_DB_APP_NAME,
    type: LOCAL_DB_BACKUP_TYPE,
    schemaVersion: LOCAL_DB_SCHEMA_VERSION,
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
      await table.bulkPut(cloneRows(backupTables[tableName]));
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
