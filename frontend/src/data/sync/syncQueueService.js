import { getImsLocalDb } from "../local/imsLocalDb";
import {
  LOCAL_DB_TABLES,
  LOCAL_SYNC_COLLECTIONS,
  LOCAL_SYNC_OPERATIONS,
  LOCAL_SYNC_STATUSES,
} from "../local/localDbSchema";
import { assertNoSensitiveLocalDbPayload } from "../local/localDbSecurityPolicy";

export const SYNC_QUEUE_RETRY_FAILED_CONFIRMATION = "RETRY FAILED OFFLINE QUEUE";
export const SYNC_QUEUE_CLEAR_FAILED_CONFIRMATION = "CLEAR FAILED OFFLINE QUEUE";

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

const filterQueueRows = (
  rows = [],
  { status = null, collectionName = null, queueIds = null, includeSynced = true } = {},
) => {
  const queueIdSet = Array.isArray(queueIds) && queueIds.length
    ? new Set(queueIds.map(String))
    : null;

  return rows.filter((row) => {
    if (status && row.syncStatus !== status) return false;
    if (collectionName && row.collectionName !== collectionName) return false;
    if (queueIdSet && !queueIdSet.has(String(row.id))) return false;
    if (!includeSynced && row.syncStatus === LOCAL_SYNC_STATUSES.SYNCED) return false;
    return true;
  });
};

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
  assertNoSensitiveLocalDbPayload(payload, "sync_queue payload");
  assertNoSensitiveLocalDbPayload(metadata, "sync_queue metadata");

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
  queueIds = null,
  includeSynced = true,
} = {}) => {
  const db = getImsLocalDb();
  const rows = await db.table(LOCAL_DB_TABLES.SYNC_QUEUE).toArray();

  return filterQueueRows(rows, { status, collectionName, queueIds, includeSynced })
    .sort((first, second) =>
      String(first.createdAt || "").localeCompare(String(second.createdAt || ""))
    );
};

export const listPendingSyncQueueItems = (options = {}) =>
  listSyncQueueItems({
    ...options,
    status: LOCAL_SYNC_STATUSES.PENDING,
  });

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

export const getPendingSyncQueueCount = async () => {
  const summary = await getSyncQueueSummary();
  return Number(summary.byStatus[LOCAL_SYNC_STATUSES.PENDING] || 0);
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

export const getSyncQueueItemById = async (queueId) => {
  if (!queueId) return null;
  const db = getImsLocalDb();
  return db.table(LOCAL_DB_TABLES.SYNC_QUEUE).get(queueId);
};

// =====================================================
// SECTION: Sync Queue Admin Guard — AKTIF / OFFLINE ONLY / BATCH 45
// Fungsi:
// - Retry/clear hanya untuk queue local yang gagal, dengan keyword guard.
// - Tidak melakukan push otomatis ke Firebase dan tidak membuka collection di luar LOCAL_SYNC_COLLECTIONS.
// =====================================================
export const retryFailedSyncQueueItems = async ({
  collectionName = null,
  queueIds = null,
  confirmation = "",
} = {}) => {
  if (confirmation !== SYNC_QUEUE_RETRY_FAILED_CONFIRMATION) {
    throw new Error(
      `Untuk retry failed queue, isi confirmation: ${SYNC_QUEUE_RETRY_FAILED_CONFIRMATION}`
    );
  }

  if (collectionName) assertAllowedCollection(collectionName);

  const db = getImsLocalDb();
  const rows = await listSyncQueueItems({
    status: LOCAL_SYNC_STATUSES.FAILED,
    collectionName,
    queueIds,
    includeSynced: false,
  });
  const timestamp = nowIso();

  await db.transaction("rw", db.table(LOCAL_DB_TABLES.SYNC_QUEUE), async () => {
    for (const row of rows) {
      await db.table(LOCAL_DB_TABLES.SYNC_QUEUE).put({
        ...row,
        syncStatus: LOCAL_SYNC_STATUSES.PENDING,
        errorMessage: "",
        metadata: {
          ...(row.metadata || {}),
          adminRetriedAt: timestamp,
          adminRetriedFromStatus: row.syncStatus,
        },
        updatedAt: timestamp,
      });
    }
  });

  return {
    retried: rows.length,
    queueIds: rows.map((row) => row.id),
    collectionName: collectionName || "all_allowed_collections",
    retriedAt: timestamp,
  };
};

export const clearFailedSyncQueueItems = async ({
  collectionName = null,
  queueIds = null,
  confirmation = "",
} = {}) => {
  if (confirmation !== SYNC_QUEUE_CLEAR_FAILED_CONFIRMATION) {
    throw new Error(
      `Untuk clear failed queue, isi confirmation: ${SYNC_QUEUE_CLEAR_FAILED_CONFIRMATION}`
    );
  }

  if (collectionName) assertAllowedCollection(collectionName);

  const db = getImsLocalDb();
  const rows = await listSyncQueueItems({
    status: LOCAL_SYNC_STATUSES.FAILED,
    collectionName,
    queueIds,
    includeSynced: false,
  });
  const timestamp = nowIso();
  const auditId = `sync-queue-clear-failed-${Date.now()}`;

  await db.transaction("rw", db.table(LOCAL_DB_TABLES.SYNC_QUEUE), db.table(LOCAL_DB_TABLES.AUDIT_LOGS), async () => {
    for (const row of rows) {
      await db.table(LOCAL_DB_TABLES.SYNC_QUEUE).delete(row.id);
    }

    await db.table(LOCAL_DB_TABLES.AUDIT_LOGS).put({
      id: auditId,
      module: "offline_sync_queue",
      action: "clear_failed_queue",
      referenceId: auditId,
      createdAt: timestamp,
      metadata: {
        collectionName: collectionName || "all_allowed_collections",
        queueIds: rows.map((row) => row.id),
        count: rows.length,
        scope: "local_indexeddb_only",
      },
    });
  });

  return {
    cleared: rows.length,
    queueIds: rows.map((row) => row.id),
    collectionName: collectionName || "all_allowed_collections",
    clearedAt: timestamp,
    auditId,
  };
};
