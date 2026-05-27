const LOCAL_DB_SCHEMA_VERSION = 1;

export const LOCAL_DB_NAME = "ims_bunga_flanel_offline";
export const LOCAL_DB_APP_NAME = "IMS Bunga Flanel";
export const LOCAL_DB_BACKUP_TYPE = "offline-local-db-backup";

export const LOCAL_SYNC_STATUSES = Object.freeze({
  PENDING: "pending",
  SYNCING: "syncing",
  SYNCED: "synced",
  FAILED: "failed",
  CONFLICT: "conflict",
});

export const LOCAL_SYNC_OPERATIONS = Object.freeze({
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
});


export const LOCAL_DB_MODES = Object.freeze({
  FIREBASE_PRIMARY: "firebase_primary",
  OFFLINE_LOCAL: "offline_local",
  HYBRID_SYNC: "hybrid_sync",
});

export const LOCAL_DB_META_KEYS = Object.freeze({
  SCHEMA_VERSION: "localDbSchemaVersion",
  MODE: "localDbMode",
  FOUNDATION_INITIALIZED_AT: "foundationInitializedAt",
  FOUNDATION_UPDATED_AT: "foundationUpdatedAt",
  LAST_BACKUP_EXPORTED_AT: "lastBackupExportedAt",
  LAST_BACKUP_IMPORTED_AT: "lastBackupImportedAt",
});

export const LOCAL_DB_TABLES = Object.freeze({
  APP_META: "app_meta",
  LOCAL_PROFILES: "local_profiles",
  SYNC_QUEUE: "sync_queue",
  SYNC_CONFLICTS: "sync_conflicts",
  AUDIT_LOGS: "audit_logs",
  CATEGORIES: "categories",
  CUSTOMERS: "customers",
  SUPPLIERS: "suppliers",
});

export const LOCAL_DB_FOUNDATION_TABLES = Object.freeze([
  LOCAL_DB_TABLES.APP_META,
  LOCAL_DB_TABLES.LOCAL_PROFILES,
  LOCAL_DB_TABLES.SYNC_QUEUE,
  LOCAL_DB_TABLES.SYNC_CONFLICTS,
  LOCAL_DB_TABLES.AUDIT_LOGS,
  LOCAL_DB_TABLES.CATEGORIES,
  LOCAL_DB_TABLES.CUSTOMERS,
  LOCAL_DB_TABLES.SUPPLIERS,
]);

export const LOCAL_DB_BACKUP_TABLE_ALLOWLIST = LOCAL_DB_FOUNDATION_TABLES;

export const LOCAL_SYNC_COLLECTIONS = Object.freeze([
  LOCAL_DB_TABLES.CATEGORIES,
  LOCAL_DB_TABLES.CUSTOMERS,
  LOCAL_DB_TABLES.SUPPLIERS,
]);


export const LOCAL_DB_SCHEMA = Object.freeze({
  version: LOCAL_DB_SCHEMA_VERSION,
  stores: Object.freeze({
    [LOCAL_DB_TABLES.APP_META]: "key, updatedAt",
    [LOCAL_DB_TABLES.LOCAL_PROFILES]: "uid, email, role, status, updatedAt",
    [LOCAL_DB_TABLES.SYNC_QUEUE]:
      "id, collectionName, documentId, operation, syncStatus, localUpdatedAt, updatedAt",
    [LOCAL_DB_TABLES.SYNC_CONFLICTS]:
      "id, collectionName, documentId, conflictType, detectedAt, resolvedAt",
    [LOCAL_DB_TABLES.AUDIT_LOGS]: "id, module, action, referenceId, createdAt",
    [LOCAL_DB_TABLES.CATEGORIES]: "id, name, type, syncStatus, updatedAt",
    [LOCAL_DB_TABLES.CUSTOMERS]: "id, name, phone, syncStatus, updatedAt",
    [LOCAL_DB_TABLES.SUPPLIERS]: "id, name, phone, syncStatus, updatedAt",
  }),
});

export const getLocalDbTableNames = () => [...LOCAL_DB_FOUNDATION_TABLES];

export const isLocalDbFoundationTable = (tableName) =>
  LOCAL_DB_FOUNDATION_TABLES.includes(tableName);

export { LOCAL_DB_SCHEMA_VERSION };
