import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../../firebase";
import { getImsLocalDb } from "../local/imsLocalDb";
import {
  LOCAL_DB_TABLES,
  LOCAL_SYNC_OPERATIONS,
  LOCAL_SYNC_STATUSES,
} from "../local/localDbSchema";
import {
  listPendingSyncQueueItems,
  updateSyncQueueItemStatus,
} from "./syncQueueService";
import { createSyncConflict } from "./syncConflictService";

export const MASTER_DATA_SYNC_CONFIRMATION = "SYNC MASTER DATA PILOT TO FIREBASE";

const FIREBASE_COLLECTION_BY_LOCAL_COLLECTION = Object.freeze({
  [LOCAL_DB_TABLES.CATEGORIES]: "categories",
  [LOCAL_DB_TABLES.CUSTOMERS]: "customers",
});

const SYNC_BLOCKED_COLLECTION_REASON = Object.freeze({
  [LOCAL_DB_TABLES.SUPPLIERS]:
    "Supplier sync ke Firebase belum diaktifkan karena flow supplier masih guarded di SupplierPurchases dan terkait raw material/purchase linkage.",
});

const nowIso = () => new Date().toISOString();

const clonePayload = (payload = null) => JSON.parse(JSON.stringify(payload || null));

const sanitizeFirestorePayload = (payload = {}) => {
  const cloned = clonePayload(payload) || {};
  [
    "_deleted",
    "syncStatus",
    "localUpdatedAt",
    "lastSyncedAt",
    "remoteUpdatedAt",
    "deletedAt",
    "deletedBy",
  ].forEach((fieldName) => {
    delete cloned[fieldName];
  });

  return cloned;
};

const getFirebaseCollectionName = (collectionName) =>
  FIREBASE_COLLECTION_BY_LOCAL_COLLECTION[collectionName] || null;

const getBlockedReason = (queueItem) => {
  if (SYNC_BLOCKED_COLLECTION_REASON[queueItem.collectionName]) {
    return SYNC_BLOCKED_COLLECTION_REASON[queueItem.collectionName];
  }

  if (!getFirebaseCollectionName(queueItem.collectionName)) {
    return `Collection ${queueItem.collectionName} belum masuk allowlist manual Firebase sync.`;
  }

  return "";
};

const buildPreviewRows = (queueItems = []) =>
  queueItems.map((item) => {
    const blockedReason = getBlockedReason(item);
    return {
      queueId: item.id,
      collectionName: item.collectionName,
      documentId: item.documentId,
      operation: item.operation,
      syncStatus: item.syncStatus,
      canSync:
        !blockedReason &&
        [
          LOCAL_SYNC_OPERATIONS.CREATE,
          LOCAL_SYNC_OPERATIONS.UPDATE,
          LOCAL_SYNC_OPERATIONS.DELETE,
        ].includes(item.operation),
      blockedReason,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      retryCount: item.retryCount || 0,
      errorMessage: item.errorMessage || "",
    };
  });

const summarizePreviewRows = (rows = []) => {
  const summary = {
    total: rows.length,
    syncable: 0,
    blocked: 0,
    deletes: 0,
    byCollection: {},
    byOperation: {},
  };

  rows.forEach((row) => {
    if (row.canSync) summary.syncable += 1;
    if (!row.canSync) summary.blocked += 1;
    if (row.operation === LOCAL_SYNC_OPERATIONS.DELETE) summary.deletes += 1;
    summary.byCollection[row.collectionName] =
      (summary.byCollection[row.collectionName] || 0) + 1;
    summary.byOperation[row.operation] = (summary.byOperation[row.operation] || 0) + 1;
  });

  return summary;
};

export const previewFirebaseMasterDataSync = async ({ limit = 50 } = {}) => {
  const queueItems = (await listPendingSyncQueueItems()).slice(0, limit);
  const rows = buildPreviewRows(queueItems);

  return {
    mode: "manual_master_data_sync_preview",
    allowedCollections: Object.keys(FIREBASE_COLLECTION_BY_LOCAL_COLLECTION),
    blockedCollections: Object.keys(SYNC_BLOCKED_COLLECTION_REASON),
    rows,
    summary: summarizePreviewRows(rows),
  };
};

const markLocalRecordSynced = async ({ collectionName, documentId, timestamp }) => {
  const dbLocal = getImsLocalDb();
  const table = dbLocal.table(collectionName);
  const current = await table.get(documentId);

  if (!current) return null;

  const nextRecord = {
    ...current,
    syncStatus: LOCAL_SYNC_STATUSES.SYNCED,
    lastSyncedAt: timestamp,
    updatedAt: current.updatedAt || timestamp,
  };

  await table.put(nextRecord);
  return nextRecord;
};

const writeQueueAuditLog = async ({ queueItem, status, message = "", timestamp }) => {
  const dbLocal = getImsLocalDb();
  await dbLocal.table(LOCAL_DB_TABLES.AUDIT_LOGS).put({
    id: `local-db-sync-${queueItem.id}-${status}`,
    module: "local_db_sync",
    action: status,
    referenceId: `${queueItem.collectionName}:${queueItem.documentId}`,
    createdAt: timestamp,
    metadata: {
      queueId: queueItem.id,
      collectionName: queueItem.collectionName,
      documentId: queueItem.documentId,
      operation: queueItem.operation,
      message,
      scope: "master_data_pilot",
    },
  });
};

const syncSingleQueueItem = async (queueItem, { allowDeletes = false } = {}) => {
  const blockedReason = getBlockedReason(queueItem);
  const timestamp = nowIso();

  if (blockedReason) {
    const updatedQueue = await updateSyncQueueItemStatus(queueItem.id, {
      status: LOCAL_SYNC_STATUSES.FAILED,
      errorMessage: blockedReason,
    });
    await writeQueueAuditLog({ queueItem, status: LOCAL_SYNC_STATUSES.FAILED, message: blockedReason, timestamp });
    return { status: LOCAL_SYNC_STATUSES.FAILED, queueItem: updatedQueue, message: blockedReason };
  }

  if (queueItem.operation === LOCAL_SYNC_OPERATIONS.DELETE && !allowDeletes) {
    const message = "Delete Firebase diblokir. Ulangi manual sync dengan allowDeletes=true setelah review scope.";
    const updatedQueue = await updateSyncQueueItemStatus(queueItem.id, {
      status: LOCAL_SYNC_STATUSES.FAILED,
      errorMessage: message,
    });
    await writeQueueAuditLog({ queueItem, status: LOCAL_SYNC_STATUSES.FAILED, message, timestamp });
    return { status: LOCAL_SYNC_STATUSES.FAILED, queueItem: updatedQueue, message };
  }

  const collectionName = getFirebaseCollectionName(queueItem.collectionName);
  const documentRef = doc(db, collectionName, queueItem.documentId);
  const remoteSnapshot = await getDoc(documentRef);
  const remoteData = remoteSnapshot.exists()
    ? { id: remoteSnapshot.id, ...remoteSnapshot.data() }
    : null;

  if (queueItem.operation === LOCAL_SYNC_OPERATIONS.CREATE && remoteSnapshot.exists()) {
    const message = "Dokumen Firebase sudah ada. Sync create dihentikan agar tidak overwrite data remote.";
    await createSyncConflict({
      queueId: queueItem.id,
      collectionName: queueItem.collectionName,
      documentId: queueItem.documentId,
      conflictType: "remote_exists_on_create",
      localPayload: queueItem.payload,
      remotePayload: remoteData,
      message,
    });
    const updatedQueue = await updateSyncQueueItemStatus(queueItem.id, {
      status: LOCAL_SYNC_STATUSES.CONFLICT,
      errorMessage: message,
    });
    await writeQueueAuditLog({ queueItem, status: LOCAL_SYNC_STATUSES.CONFLICT, message, timestamp });
    return { status: LOCAL_SYNC_STATUSES.CONFLICT, queueItem: updatedQueue, message };
  }

  if (queueItem.operation === LOCAL_SYNC_OPERATIONS.UPDATE && !remoteSnapshot.exists()) {
    const message = "Dokumen Firebase tidak ditemukan saat sync update. Perlu review manual.";
    await createSyncConflict({
      queueId: queueItem.id,
      collectionName: queueItem.collectionName,
      documentId: queueItem.documentId,
      conflictType: "remote_missing_on_update",
      localPayload: queueItem.payload,
      remotePayload: null,
      message,
    });
    const updatedQueue = await updateSyncQueueItemStatus(queueItem.id, {
      status: LOCAL_SYNC_STATUSES.CONFLICT,
      errorMessage: message,
    });
    await writeQueueAuditLog({ queueItem, status: LOCAL_SYNC_STATUSES.CONFLICT, message, timestamp });
    return { status: LOCAL_SYNC_STATUSES.CONFLICT, queueItem: updatedQueue, message };
  }

  if (queueItem.operation === LOCAL_SYNC_OPERATIONS.DELETE) {
    if (remoteSnapshot.exists()) {
      await deleteDoc(documentRef);
    }
  } else {
    const firestorePayload = sanitizeFirestorePayload(queueItem.payload);
    await setDoc(
      documentRef,
      {
        ...firestorePayload,
        updatedAt: serverTimestamp(),
        ...(queueItem.operation === LOCAL_SYNC_OPERATIONS.CREATE
          ? { createdAt: firestorePayload.createdAt || serverTimestamp() }
          : {}),
      },
      { merge: queueItem.operation === LOCAL_SYNC_OPERATIONS.UPDATE }
    );
  }

  const updatedQueue = await updateSyncQueueItemStatus(queueItem.id, {
    status: LOCAL_SYNC_STATUSES.SYNCED,
    errorMessage: "",
    metadataPatch: {
      syncedAt: timestamp,
      firebaseCollection: collectionName,
      remoteDocumentId: queueItem.documentId,
    },
  });

  if (queueItem.operation !== LOCAL_SYNC_OPERATIONS.DELETE) {
    await markLocalRecordSynced({
      collectionName: queueItem.collectionName,
      documentId: queueItem.documentId,
      timestamp,
    });
  }

  await writeQueueAuditLog({ queueItem, status: LOCAL_SYNC_STATUSES.SYNCED, timestamp });
  return { status: LOCAL_SYNC_STATUSES.SYNCED, queueItem: updatedQueue, message: "synced" };
};

export const syncPendingMasterDataToFirebase = async ({
  confirmation = "",
  limit = 25,
  allowDeletes = false,
} = {}) => {
  if (confirmation !== MASTER_DATA_SYNC_CONFIRMATION) {
    throw new Error(`Untuk sync manual, isi confirmation: ${MASTER_DATA_SYNC_CONFIRMATION}`);
  }

  const queueItems = (await listPendingSyncQueueItems()).slice(0, limit);
  const result = {
    attempted: queueItems.length,
    synced: 0,
    failed: 0,
    conflict: 0,
    rows: [],
  };

  for (const queueItem of queueItems) {
    try {
      const rowResult = await syncSingleQueueItem(queueItem, { allowDeletes });
      result.rows.push({
        queueId: queueItem.id,
        collectionName: queueItem.collectionName,
        documentId: queueItem.documentId,
        operation: queueItem.operation,
        status: rowResult.status,
        message: rowResult.message,
      });

      if (rowResult.status === LOCAL_SYNC_STATUSES.SYNCED) result.synced += 1;
      else if (rowResult.status === LOCAL_SYNC_STATUSES.CONFLICT) result.conflict += 1;
      else result.failed += 1;
    } catch (error) {
      const message = error?.message || "Sync item gagal.";
      await updateSyncQueueItemStatus(queueItem.id, {
        status: LOCAL_SYNC_STATUSES.FAILED,
        errorMessage: message,
      });
      await writeQueueAuditLog({
        queueItem,
        status: LOCAL_SYNC_STATUSES.FAILED,
        message,
        timestamp: nowIso(),
      });
      result.failed += 1;
      result.rows.push({
        queueId: queueItem.id,
        collectionName: queueItem.collectionName,
        documentId: queueItem.documentId,
        operation: queueItem.operation,
        status: LOCAL_SYNC_STATUSES.FAILED,
        message,
      });
    }
  }

  return result;
};

// LEGACY-COMPAT: beberapa patch/dev panel lama pernah mengimpor helper ini dari service sync Firebase.
// Re-export ini mencegah white screen karena named export mismatch tanpa mengubah flow sync aktif.
export { createSyncConflict } from "./syncConflictService";
