import { getImsLocalDb } from "./imsLocalDb";
import {
  LOCAL_DB_META_KEYS,
  LOCAL_DB_MODES,
  LOCAL_DB_NAME,
  LOCAL_DB_SCHEMA_VERSION,
  getLocalDbTableNames,
} from "./localDbSchema";

const nowIso = () => new Date().toISOString();

export const getLocalDbMeta = async (key, fallbackValue = null) => {
  if (!key) return fallbackValue;

  const db = getImsLocalDb();
  const row = await db.app_meta.get(key);

  return row && Object.prototype.hasOwnProperty.call(row, "value")
    ? row.value
    : fallbackValue;
};

export const setLocalDbMeta = async (key, value) => {
  if (!key) {
    throw new Error("Local DB meta key wajib diisi.");
  }

  const db = getImsLocalDb();
  const row = {
    key,
    value,
    updatedAt: nowIso(),
  };

  await db.app_meta.put(row);
  return row;
};

export const ensureLocalDbFoundationMeta = async () => {
  const db = getImsLocalDb();
  const timestamp = nowIso();
  const existingInitializedAt = await getLocalDbMeta(
    LOCAL_DB_META_KEYS.FOUNDATION_INITIALIZED_AT,
    null
  );
  const existingMode = await getLocalDbMeta(
    LOCAL_DB_META_KEYS.MODE,
    LOCAL_DB_MODES.FIREBASE_PRIMARY
  );

  await db.transaction("rw", db.app_meta, async () => {
    await db.app_meta.bulkPut([
      {
        key: LOCAL_DB_META_KEYS.SCHEMA_VERSION,
        value: LOCAL_DB_SCHEMA_VERSION,
        updatedAt: timestamp,
      },
      {
        key: LOCAL_DB_META_KEYS.MODE,
        value: existingMode || LOCAL_DB_MODES.FIREBASE_PRIMARY,
        updatedAt: timestamp,
      },
      {
        key: LOCAL_DB_META_KEYS.FOUNDATION_INITIALIZED_AT,
        value: existingInitializedAt || timestamp,
        updatedAt: timestamp,
      },
      {
        key: LOCAL_DB_META_KEYS.FOUNDATION_UPDATED_AT,
        value: timestamp,
        updatedAt: timestamp,
      },
    ]);
  });

  return getOfflineDatabaseFoundationStatus();
};

export const getOfflineDatabaseFoundationStatus = async () => {
  const db = getImsLocalDb();
  const [
    schemaVersion,
    mode,
    initializedAt,
    updatedAt,
    lastBackupExportedAt,
    lastBackupImportedAt,
  ] = await Promise.all([
    getLocalDbMeta(LOCAL_DB_META_KEYS.SCHEMA_VERSION, null),
    getLocalDbMeta(LOCAL_DB_META_KEYS.MODE, LOCAL_DB_MODES.FIREBASE_PRIMARY),
    getLocalDbMeta(LOCAL_DB_META_KEYS.FOUNDATION_INITIALIZED_AT, null),
    getLocalDbMeta(LOCAL_DB_META_KEYS.FOUNDATION_UPDATED_AT, null),
    getLocalDbMeta(LOCAL_DB_META_KEYS.LAST_BACKUP_EXPORTED_AT, null),
    getLocalDbMeta(LOCAL_DB_META_KEYS.LAST_BACKUP_IMPORTED_AT, null),
  ]);

  return {
    ready: schemaVersion === LOCAL_DB_SCHEMA_VERSION,
    dbName: LOCAL_DB_NAME,
    schemaVersion,
    expectedSchemaVersion: LOCAL_DB_SCHEMA_VERSION,
    mode,
    tableNames: getLocalDbTableNames(),
    initializedAt,
    updatedAt,
    lastBackupExportedAt,
    lastBackupImportedAt,
    isOpen: db.isOpen(),
  };
};
