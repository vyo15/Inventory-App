import { getImsLocalDb } from "../local/imsLocalDb";
import {
  LOCAL_DB_TABLES,
  LOCAL_SYNC_STATUSES,
} from "../local/localDbSchema";
import { setLocalDbMeta } from "../local/localDbMeta";
import * as firebaseCategoriesAdapter from "../adapters/firebase/firebaseCategoriesAdapter";
import * as firebaseCustomersAdapter from "../adapters/firebase/firebaseCustomersAdapter";
import * as firebaseSuppliersAdapter from "../adapters/firebase/firebaseSuppliersAdapter";
import * as firebaseProductsSnapshotAdapter from "../adapters/firebase/firebaseProductsSnapshotAdapter";
import * as firebaseRawMaterialsSnapshotAdapter from "../adapters/firebase/firebaseRawMaterialsSnapshotAdapter";
import * as firebaseSemiFinishedMaterialsSnapshotAdapter from "../adapters/firebase/firebaseSemiFinishedMaterialsSnapshotAdapter";
import * as firebaseStockReadModelsAdapter from "../adapters/firebase/firebaseStockReadModelsAdapter";

export const FIREBASE_TO_LOCAL_MASTER_DATA_SYNC_CONFIRMATION =
  "PULL FIREBASE MASTER DATA TO LOCAL";

const FIREBASE_PULL_META_KEY = "lastFirebaseToLocalPullAt";

const PULL_COLLECTIONS = Object.freeze({
  [LOCAL_DB_TABLES.CATEGORIES]: Object.freeze({
    label: "Categories",
    tableName: LOCAL_DB_TABLES.CATEGORIES,
    listRemote: firebaseCategoriesAdapter.listCategories,
    getDisplayName: (record = {}) => record.name || record.categoryName || record.id || "-",
  }),
  [LOCAL_DB_TABLES.CUSTOMERS]: Object.freeze({
    label: "Customers",
    tableName: LOCAL_DB_TABLES.CUSTOMERS,
    listRemote: firebaseCustomersAdapter.listCustomers,
    getDisplayName: (record = {}) =>
      record.name || record.customerName || record.customerCode || record.code || record.id || "-",
  }),
  [LOCAL_DB_TABLES.SUPPLIERS]: Object.freeze({
    label: "Suppliers (read-only)",
    tableName: LOCAL_DB_TABLES.SUPPLIERS,
    listRemote: firebaseSuppliersAdapter.listSuppliers,
    scope: "supplier_read_only_snapshot",
    readOnlySnapshot: true,
    getDisplayName: (record = {}) =>
      record.name || record.supplierName || record.supplierCode || record.code || record.id || "-",
  }),
  [LOCAL_DB_TABLES.PRODUCTS]: Object.freeze({
    label: "Products (read-only)",
    tableName: LOCAL_DB_TABLES.PRODUCTS,
    listRemote: firebaseProductsSnapshotAdapter.listProductSnapshots,
    scope: "product_read_only_snapshot",
    readOnlySnapshot: true,
    getDisplayName: (record = {}) =>
      record.name || record.productName || record.productCode || record.code || record.id || "-",
  }),
  [LOCAL_DB_TABLES.RAW_MATERIALS]: Object.freeze({
    label: "Raw Materials (read-only)",
    tableName: LOCAL_DB_TABLES.RAW_MATERIALS,
    listRemote: firebaseRawMaterialsSnapshotAdapter.listRawMaterialSnapshots,
    scope: "raw_material_read_only_snapshot",
    readOnlySnapshot: true,
    getDisplayName: (record = {}) =>
      record.name || record.materialName || record.materialCode || record.code || record.id || "-",
  }),
  [LOCAL_DB_TABLES.SEMI_FINISHED_MATERIALS]: Object.freeze({
    label: "Semi Finished (read-only)",
    tableName: LOCAL_DB_TABLES.SEMI_FINISHED_MATERIALS,
    listRemote: firebaseSemiFinishedMaterialsSnapshotAdapter.listSemiFinishedMaterialSnapshots,
    scope: "semi_finished_read_only_snapshot",
    readOnlySnapshot: true,
    getDisplayName: (record = {}) =>
      record.name || record.itemName || record.itemCode || record.code || record.id || "-",
  }),
  [LOCAL_DB_TABLES.STOCK_SNAPSHOTS]: Object.freeze({
    label: "Stock Snapshot (read-only)",
    tableName: LOCAL_DB_TABLES.STOCK_SNAPSHOTS,
    listRemote: firebaseStockReadModelsAdapter.listStockReadModelSnapshots,
    scope: "stock_read_only_snapshot",
    readOnlySnapshot: true,
    defaultPullLimit: 1000,
    getDisplayName: (record = {}) =>
      record.name || record.displayReference || record.sourceId || record.readModelId || record.id || "-",
  }),
});

const nowIso = () => new Date().toISOString();

const cloneRecord = (record = null) => JSON.parse(JSON.stringify(record || null));

const normalizeCollectionName = (collectionName = LOCAL_DB_TABLES.CATEGORIES) => {
  if (PULL_COLLECTIONS[collectionName]) return collectionName;
  throw new Error(
    `Collection ${collectionName || "kosong"} belum diizinkan untuk Firebase → Offline. Saat ini hanya categories/customers write pilot serta supplier/product/raw/semi/stock snapshot read-only.`
  );
};

const isLocalRecordDirty = (record = null) => {
  if (!record) return false;
  return [
    LOCAL_SYNC_STATUSES.PENDING,
    LOCAL_SYNC_STATUSES.SYNCING,
    LOCAL_SYNC_STATUSES.CONFLICT,
    LOCAL_SYNC_STATUSES.FAILED,
  ].includes(record.syncStatus);
};

const normalizeRemoteForLocal = ({ remoteRecord = {}, collectionName, timestamp }) => {
  const cloned = cloneRecord(remoteRecord) || {};
  const config = PULL_COLLECTIONS[collectionName] || {};
  const scope = config.scope || (config.readOnlySnapshot ? "read_only_snapshot" : "master_data_pilot");

  return {
    ...cloned,
    id: cloned.id,
    _deleted: false,
    syncStatus: LOCAL_SYNC_STATUSES.SYNCED,
    source: "firebase_pull",
    readOnlySnapshot: Boolean(config.readOnlySnapshot),
    offlineMutationAllowed: !config.readOnlySnapshot,
    lastSyncedAt: timestamp,
    remoteUpdatedAt: cloned.updatedAt || timestamp,
    updatedAt: cloned.updatedAt || timestamp,
    localUpdatedAt: timestamp,
    syncMetadata: {
      ...(cloned.syncMetadata || {}),
      lastFirebasePullAt: timestamp,
      scope,
      collectionName,
      readOnlySnapshot: Boolean(config.readOnlySnapshot),
    },
  };
};

const buildPreviewRows = async ({ collectionName, maxResults = null }) => {
  const normalizedCollection = normalizeCollectionName(collectionName);
  const config = PULL_COLLECTIONS[normalizedCollection];
  const db = getImsLocalDb();
  const table = db.table(config.tableName);
  const remoteRows = await config.listRemote({
    maxResults: maxResults || config.defaultPullLimit || 1000,
  });
  const timestamp = nowIso();

  const rows = [];
  for (const remoteRecord of remoteRows || []) {
    const documentId = remoteRecord?.id;
    if (!documentId) {
      rows.push({
        collectionName: normalizedCollection,
        documentId: "-",
        displayName: config.getDisplayName(remoteRecord),
        action: "skip",
        canPull: false,
        blockedReason: "Record Firebase tidak memiliki ID dokumen.",
        remoteRecord,
        localRecord: null,
      });
      continue;
    }

    const localRecord = await table.get(documentId);
    const dirtyLocal = isLocalRecordDirty(localRecord);
    const action = !localRecord ? "create_local" : dirtyLocal ? "skip_dirty_local" : "update_local";
    rows.push({
      collectionName: normalizedCollection,
      documentId,
      displayName: config.getDisplayName(remoteRecord),
      action,
      canPull: !dirtyLocal,
      blockedReason: dirtyLocal
        ? "Local record punya perubahan pending/conflict. Sync Offline → Firebase dulu atau resolve conflict sebelum pull."
        : "",
      remoteRecord: normalizeRemoteForLocal({
        remoteRecord,
        collectionName: normalizedCollection,
        timestamp,
      }),
      localRecord: localRecord || null,
      localSyncStatus: localRecord?.syncStatus || "missing",
      remoteUpdatedAt: remoteRecord?.updatedAt || "",
    });
  }

  return rows;
};

const summarizeRows = (rows = []) => rows.reduce(
  (summary, row) => {
    summary.total += 1;
    if (row.canPull) summary.pullable += 1;
    if (!row.canPull) summary.blocked += 1;
    summary.byAction[row.action] = (summary.byAction[row.action] || 0) + 1;
    return summary;
  },
  { total: 0, pullable: 0, blocked: 0, byAction: {} }
);

export const getFirebaseToLocalSyncCollections = () =>
  Object.entries(PULL_COLLECTIONS).map(([value, config]) => ({
    value,
    label: config.label,
  }));

export const previewFirebaseToLocalMasterDataSync = async ({
  collectionName = LOCAL_DB_TABLES.CATEGORIES,
  limit = 100,
} = {}) => {
  const normalizedCollection = normalizeCollectionName(collectionName);
  const config = PULL_COLLECTIONS[normalizedCollection];
  const effectiveLimit = Math.max(Number(limit || 0), Number(config.defaultPullLimit || 0), 1);
  const rows = await buildPreviewRows({
    collectionName: normalizedCollection,
    maxResults: effectiveLimit,
  });
  const limitedRows = rows.slice(0, effectiveLimit);

  return {
    mode: "firebase_to_local_preview",
    collectionName: normalizedCollection,
    confirmation: FIREBASE_TO_LOCAL_MASTER_DATA_SYNC_CONFIRMATION,
    rows: limitedRows,
    summary: summarizeRows(rows),
    displayedRows: limitedRows.length,
  };
};

const writePullAuditLog = async ({ collectionName, summary, timestamp }) => {
  const db = getImsLocalDb();
  const config = PULL_COLLECTIONS[collectionName] || {};
  const scope = config.scope || (config.readOnlySnapshot ? "read_only_snapshot" : "master_data_pilot");

  await db.table(LOCAL_DB_TABLES.AUDIT_LOGS).put({
    id: `firebase-to-local-${collectionName}-${Date.now()}`,
    module: "local_db_sync",
    action: "firebase_to_local_pull",
    referenceId: collectionName,
    createdAt: timestamp,
    metadata: {
      scope,
      collectionName,
      readOnlySnapshot: Boolean(config.readOnlySnapshot),
      summary,
    },
  });
};

export const syncFirebaseMasterDataToLocal = async ({
  collectionName = LOCAL_DB_TABLES.CATEGORIES,
  confirmation = "",
  limit = 250,
} = {}) => {
  if (confirmation !== FIREBASE_TO_LOCAL_MASTER_DATA_SYNC_CONFIRMATION) {
    throw new Error(
      `Untuk ambil data Firebase ke Offline, isi confirmation: ${FIREBASE_TO_LOCAL_MASTER_DATA_SYNC_CONFIRMATION}`
    );
  }

  const normalizedCollection = normalizeCollectionName(collectionName);
  const config = PULL_COLLECTIONS[normalizedCollection];
  const effectiveLimit = Math.max(Number(limit || 0), Number(config.defaultPullLimit || 0), 1);
  const preview = await previewFirebaseToLocalMasterDataSync({
    collectionName: normalizedCollection,
    limit: effectiveLimit,
  });
  const timestamp = nowIso();
  const db = getImsLocalDb();
  const table = db.table(normalizedCollection);
  const rowsToPull = preview.rows.filter((row) => row.canPull);

  await db.transaction("rw", table, db.table(LOCAL_DB_TABLES.AUDIT_LOGS), db.table(LOCAL_DB_TABLES.APP_META), async () => {
    for (const row of rowsToPull) {
      await table.put({
        ...row.remoteRecord,
        lastSyncedAt: timestamp,
        localUpdatedAt: timestamp,
      });
    }

    const summary = {
      ...preview.summary,
      pulled: rowsToPull.length,
      skipped: preview.summary.total - rowsToPull.length,
    };
    await writePullAuditLog({ collectionName: normalizedCollection, summary, timestamp });
    await setLocalDbMeta(FIREBASE_PULL_META_KEY, timestamp);
  });

  return {
    collectionName: normalizedCollection,
    pulled: rowsToPull.length,
    skipped: preview.summary.total - rowsToPull.length,
    summary: {
      ...preview.summary,
      pulled: rowsToPull.length,
      skipped: preview.summary.total - rowsToPull.length,
    },
    rows: preview.rows.map((row) => ({
      collectionName: row.collectionName,
      documentId: row.documentId,
      displayName: row.displayName,
      action: row.action,
      status: row.canPull ? "pulled" : "skipped",
      blockedReason: row.blockedReason,
    })),
  };
};
