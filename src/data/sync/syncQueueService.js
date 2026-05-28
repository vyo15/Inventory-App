import { getImsLocalDb } from "../local/imsLocalDb";
import {
  LOCAL_DB_TABLES,
  LOCAL_SYNC_COLLECTIONS,
  LOCAL_SYNC_OPERATIONS,
  LOCAL_SYNC_STATUSES,
} from "../local/localDbSchema";

const nowIso = () => new Date().toISOString();

const clonePayload = (payload = null) => JSON.parse(JSON.stringify(payload || null));

const createQueueId = ({ collectionName, documentId, operation }) => {
  const timestamp = Date.now();
  const randomSuffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);

  return `sync-${collectionName}-${operation}-${documentId}-${timestamp}-${randomSuffix}`;
};

const assertAllowedCollection = (collectionName) => {
  if (!LOCAL_SYNC_COLLECTIONS.includes(collectionName)) {
    throw new Error(
      `Collection ${collectionName || "kosong"} belum diizinkan masuk sync_queue offline pilot.`
    );
  }
};

const assertAllowedOperation = (operation) => {
  if (!Object.values(LOCAL_SYNC_OPERATIONS).includes(operation)) {
    throw new Error(`Operation sync ${operation || "kosong"} tidak valid.`);
  }
};

const normalizeQueueStatus = (status = LOCAL_SYNC_STATUSES.PENDING) =>
  Object.values(LOCAL_SYNC_STATUSES).includes(status)
    ? status
    : LOCAL_SYNC_STATUSES.PENDING;

export const isAllowedSyncCollection = (collectionName) =>
  LOCAL_SYNC_COLLECTIONS.includes(collectionName);

export const enqueueSyncOperation = async ({
  collectionName,
  documentId,
  operation,
  payload = null,
  baseVersion = null,
  metadata = {},
  now = nowIso(),
} = {}) => {
  assertAllowedCollection(collectionName);
  assertAllowedOperation(operation);

  if (!documentId) {
    throw new Error("documentId wajib diisi untuk sync_queue.");
  }

  const db = getImsLocalDb();
  const queueItem = {
    id: createQueueId({ collectionName, documentId, operation }),
    collectionName,
    documentId,
    operation,
    payload: clonePayload(payload),
    baseVersion,
    metadata: clonePayload(metadata) || {},
    syncStatus: LOCAL_SYNC_STATUSES.PENDING,
    retryCount: 0,
    errorMessage: "",
    localUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await db.table(LOCAL_DB_TABLES.SYNC_QUEUE).put(queueItem);
  return queueItem;
};

export const listSyncQueueItems = async ({
  status = null,
  collectionName = null,
  includeSynced = true,
} = {}) => {
  const db = getImsLocalDb();
  const rows = await db.table(LOCAL_DB_TABLES.SYNC_QUEUE).toArray();

  return rows
    .filter((row) => {
      if (status && row.syncStatus !== status) return false;
      if (collectionName && row.collectionName !== collectionName) return false;
      if (!includeSynced && row.syncStatus === LOCAL_SYNC_STATUSES.SYNCED) return false;
      return true;
    })
    .sort((first, second) =>
      String(first.createdAt || "").localeCompare(String(second.createdAt || ""))
    );
};

export const listPendingSyncQueueItems = (options = {}) =>
  listSyncQueueItems({
    ...options,
    status: LOCAL_SYNC_STATUSES.PENDING,
  });


export const getSyncQueueItemById = async (queueId) => {
  if (!queueId) return null;

  const db = getImsLocalDb();
  return db.table(LOCAL_DB_TABLES.SYNC_QUEUE).get(queueId);
};

export const getSyncQueueSummary = async () => {
  const rows = await listSyncQueueItems();
  const summary = {
    total: rows.length,
    byStatus: {},
    byCollection: {},
  };

  rows.forEach((row) => {
    const status = normalizeQueueStatus(row.syncStatus);
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    summary.byCollection[row.collectionName] =
      (summary.byCollection[row.collectionName] || 0) + 1;
  });

  return summary;
};

export const updateSyncQueueItemStatus = async (
  queueId,
  {
    status,
    errorMessage = "",
    metadataPatch = {},
  } = {}
) => {
  if (!queueId) {
    throw new Error("queueId wajib diisi untuk update status sync_queue.");
  }

  const db = getImsLocalDb();
  const existing = await db.table(LOCAL_DB_TABLES.SYNC_QUEUE).get(queueId);

  if (!existing) {
    throw new Error("Item sync_queue tidak ditemukan.");
  }

  const nextStatus = normalizeQueueStatus(status || existing.syncStatus);
  const timestamp = nowIso();
  const record = {
    ...existing,
    syncStatus: nextStatus,
    retryCount:
      nextStatus === LOCAL_SYNC_STATUSES.FAILED
        ? Number(existing.retryCount || 0) + 1
        : Number(existing.retryCount || 0),
    errorMessage,
    metadata: {
      ...(existing.metadata || {}),
      ...metadataPatch,
    },
    updatedAt: timestamp,
  };

  await db.table(LOCAL_DB_TABLES.SYNC_QUEUE).put(record);
  return record;
};

export const removeSyncQueueItem = async (queueId) => {
  if (!queueId) {
    throw new Error("queueId wajib diisi untuk menghapus item sync_queue.");
  }

  const db = getImsLocalDb();
  await db.table(LOCAL_DB_TABLES.SYNC_QUEUE).delete(queueId);
  return { id: queueId, deleted: true };
};
