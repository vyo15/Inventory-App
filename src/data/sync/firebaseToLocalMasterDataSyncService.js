import { getImsLocalDb } from "../local/imsLocalDb";
import {
  LOCAL_DB_TABLES,
  LOCAL_SYNC_STATUSES,
} from "../local/localDbSchema";
import { setLocalDbMeta } from "../local/localDbMeta";
import * as firebaseCategoriesAdapter from "../adapters/firebase/firebaseCategoriesAdapter";
import * as firebaseCustomersAdapter from "../adapters/firebase/firebaseCustomersAdapter";

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
});

const nowIso = () => new Date().toISOString();

const cloneRecord = (record = null) => JSON.parse(JSON.stringify(record || null));

const normalizeCollectionName = (collectionName = LOCAL_DB_TABLES.CATEGORIES) => {
  if (PULL_COLLECTIONS[collectionName]) return collectionName;
  throw new Error(
    `Collection ${collectionName || "kosong"} belum diizinkan untuk Firebase → Offline. Saat ini hanya categories/customers.`
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
  return {
    ...cloned,
    id: cloned.id,
    _deleted: false,
    syncStatus: LOCAL_SYNC_STATUSES.SYNCED,
    source: "firebase_pull",
    lastSyncedAt: timestamp,
    remoteUpdatedAt: cloned.updatedAt || timestamp,
    updatedAt: cloned.updatedAt || timestamp,
    localUpdatedAt: timestamp,
    syncMetadata: {
      ...(cloned.syncMetadata || {}),
      lastFirebasePullAt: timestamp,
      scope: "master_data_pilot",
      collectionName,
    },
  };
};

const buildPreviewRows = async ({ collectionName }) => {
  const normalizedCollection = normalizeCollectionName(collectionName);
  const config = PULL_COLLECTIONS[normalizedCollection];
  const db = getImsLocalDb();
  const table = db.table(config.tableName);
  const remoteRows = await config.listRemote();
  const timestamp = nowIso();

  const rows = [];
  for (const remoteRecord of remoteRows) {
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
      remoteRecord: normalizeRemoteForLocal({ remoteRecord, collectionName: normalizedCollection, timestamp }),
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
  const rows = await buildPreviewRows({ collectionName: normalizedCollection });
  const limitedRows = rows.slice(0, limit);

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
  await db.table(LOCAL_DB_TABLES.AUDIT_LOGS).put({
    id: `firebase-to-local-${collectionName}-${Date.now()}`,
    module: "local_db_sync",
    action: "firebase_to_local_pull",
    referenceId: collectionName,
    createdAt: timestamp,
    metadata: {
      scope: "master_data_pilot",
      collectionName,
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
  const preview = await previewFirebaseToLocalMasterDataSync({
    collectionName: normalizedCollection,
    limit,
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
