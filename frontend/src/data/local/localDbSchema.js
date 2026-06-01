const LOCAL_DB_SCHEMA_VERSION = 4;

export const LOCAL_DB_NAME = "ims_bunga_flanel_offline";
export const LOCAL_DB_APP_NAME = "IMS Bunga Flanel";
export const LOCAL_DB_BACKUP_TYPE = "offline-local-db-backup";
export const LOCAL_DB_APP_VERSION = "offline-snapshot-v4";

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
  PRODUCTS: "products",
  RAW_MATERIALS: "raw_materials",
  SEMI_FINISHED_MATERIALS: "semi_finished_materials",
  STOCK_SNAPSHOTS: "stock_snapshots",
  PRODUCTION_PLANS: "production_plans",
  PRODUCTION_ORDERS: "production_orders",
  PRODUCTION_WORK_LOGS: "production_work_logs",
  PRODUCTION_BOMS: "production_boms",
  PRODUCTION_PAYROLLS: "production_payrolls",
  PRODUCTION_HPP_SNAPSHOTS: "production_hpp_snapshots",
  REPORT_SNAPSHOTS: "report_snapshots",
});

export const LOCAL_DB_FOUNDATION_TABLES = Object.freeze([
  LOCAL_DB_TABLES.APP_META,
  LOCAL_DB_TABLES.LOCAL_PROFILES,
  LOCAL_DB_TABLES.SYNC_QUEUE,
  LOCAL_DB_TABLES.SYNC_CONFLICTS,
  LOCAL_DB_TABLES.AUDIT_LOGS,
  LOCAL_DB_TABLES.CATEGORIES,
  LOCAL_DB_TABLES.CUSTOMERS,
]);

export const LOCAL_DB_READONLY_SNAPSHOT_TABLES = Object.freeze([
  LOCAL_DB_TABLES.SUPPLIERS,
  LOCAL_DB_TABLES.PRODUCTS,
  LOCAL_DB_TABLES.RAW_MATERIALS,
  LOCAL_DB_TABLES.SEMI_FINISHED_MATERIALS,
  LOCAL_DB_TABLES.STOCK_SNAPSHOTS,
]);

export const LOCAL_DB_PRODUCTION_SNAPSHOT_TABLES = Object.freeze([
  LOCAL_DB_TABLES.PRODUCTION_PLANS,
  LOCAL_DB_TABLES.PRODUCTION_ORDERS,
  LOCAL_DB_TABLES.PRODUCTION_WORK_LOGS,
  LOCAL_DB_TABLES.PRODUCTION_BOMS,
  LOCAL_DB_TABLES.PRODUCTION_PAYROLLS,
  LOCAL_DB_TABLES.PRODUCTION_HPP_SNAPSHOTS,
]);

export const LOCAL_DB_REPORT_SNAPSHOT_TABLES = Object.freeze([
  LOCAL_DB_TABLES.REPORT_SNAPSHOTS,
]);

export const LOCAL_DB_BACKUP_TABLE_ALLOWLIST = Object.freeze([
  ...LOCAL_DB_FOUNDATION_TABLES,
  ...LOCAL_DB_READONLY_SNAPSHOT_TABLES,
  ...LOCAL_DB_PRODUCTION_SNAPSHOT_TABLES,
  ...LOCAL_DB_REPORT_SNAPSHOT_TABLES,
]);

export const LOCAL_SYNC_COLLECTIONS = Object.freeze([
  LOCAL_DB_TABLES.CATEGORIES,
  LOCAL_DB_TABLES.CUSTOMERS,
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
    [LOCAL_DB_TABLES.PRODUCTS]: "id, code, productCode, name, syncStatus, updatedAt",
    [LOCAL_DB_TABLES.RAW_MATERIALS]:
      "id, code, materialCode, name, supplierId, syncStatus, updatedAt",
    [LOCAL_DB_TABLES.SEMI_FINISHED_MATERIALS]:
      "id, code, itemCode, name, category, flowerGroup, syncStatus, updatedAt",
    [LOCAL_DB_TABLES.STOCK_SNAPSHOTS]:
      "id, sourceType, sourceCollection, sourceId, stockStatus, hasStockIssue, syncStatus, updatedAt",
    [LOCAL_DB_TABLES.PRODUCTION_PLANS]:
      "id, planCode, title, status, syncStatus, updatedAt, localUpdatedAt",
    [LOCAL_DB_TABLES.PRODUCTION_ORDERS]:
      "id, orderNumber, productionOrderNumber, status, syncStatus, updatedAt, localUpdatedAt",
    [LOCAL_DB_TABLES.PRODUCTION_WORK_LOGS]:
      "id, workNumber, productionOrderId, status, syncStatus, updatedAt, localUpdatedAt",
    [LOCAL_DB_TABLES.PRODUCTION_BOMS]:
      "id, code, name, targetType, targetItemId, syncStatus, updatedAt, localUpdatedAt",
    [LOCAL_DB_TABLES.PRODUCTION_PAYROLLS]:
      "id, payrollNumber, workLogId, workNumber, status, paymentStatus, syncStatus, updatedAt, localUpdatedAt",
    [LOCAL_DB_TABLES.PRODUCTION_HPP_SNAPSHOTS]:
      "id, workLogId, workNumber, targetType, costStatus, syncStatus, updatedAt, localUpdatedAt",
    [LOCAL_DB_TABLES.REPORT_SNAPSHOTS]:
      "id, snapshotType, periodKey, source, syncStatus, updatedAt, localUpdatedAt",
  }),
});

export const getLocalDbTableNames = () => [...LOCAL_DB_BACKUP_TABLE_ALLOWLIST];

export const isLocalDbFoundationTable = (tableName) =>
  LOCAL_DB_FOUNDATION_TABLES.includes(tableName);

export const isLocalDbReadonlySnapshotTable = (tableName) =>
  LOCAL_DB_READONLY_SNAPSHOT_TABLES.includes(tableName);

export const isLocalDbProductionSnapshotTable = (tableName) =>
  LOCAL_DB_PRODUCTION_SNAPSHOT_TABLES.includes(tableName);

export const isLocalDbReportSnapshotTable = (tableName) =>
  LOCAL_DB_REPORT_SNAPSHOT_TABLES.includes(tableName);

export { LOCAL_DB_SCHEMA_VERSION };
