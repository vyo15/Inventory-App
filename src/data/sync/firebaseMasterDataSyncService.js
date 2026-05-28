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
import { recordSyncConflict } from "./syncConflictService";

export { createSyncConflict } from "./syncConflictService";
import { isValidCustomerCodeFormat } from "../../services/MasterData/customersService";

export const FIREBASE_MASTER_DATA_SYNC_CONFIRMATION =
  "SYNC MASTER DATA PILOT TO FIREBASE";

const FIREBASE_COLLECTION_BY_LOCAL_TABLE = Object.freeze({
  [LOCAL_DB_TABLES.CATEGORIES]: "categories",
  [LOCAL_DB_TABLES.CUSTOMERS]: "customers",
});

const UNSUPPORTED_FIREBASE_SYNC_REASON = Object.freeze({
  [LOCAL_DB_TABLES.SUPPLIERS]:
    "Supplier sync ke Firebase belum diaktifkan karena write flow supplier masih guarded di SupplierPurchases dan terkait raw material/purchase linkage.",
});

const LOCAL_ONLY_FIELDS = new Set([
  "id",
  "_deleted",
  "deletedAt",
  "localUpdatedAt",
  "lastSyncedAt",
  "syncError",
  "syncStatus",
]);

const nowIso = () => new Date().toISOString();

const getFirebaseCollectionName = (collectionName) =>
  FIREBASE_COLLECTION_BY_LOCAL_TABLE[collectionName] || null;

const isUnsupportedCollection = (collectionName) =>
  Boolean(UNSUPPORTED_FIREBASE_SYNC_REASON[collectionName]);

const stripLocalOnlyFields = (payload = {}) =>
  Object.fromEntries(
    Object.entries(payload || {}).filter(
      ([fieldName, value]) => !LOCAL_ONLY_FIELDS.has(fieldName) && value !== undefined
    )
  );

const buildFirestorePayload = ({ collectionName, documentId, operation, payload = {} }) => {
  const normalized = stripLocalOnlyFields(payload);

  if (operation === LOCAL_SYNC_OPERATIONS.DELETE) {
    return normalized;
  }

  if (collectionName === LOCAL_DB_TABLES.CUSTOMERS) {
    const resolvedCode = normalized.code || normalized.customerCode || documentId;
    if (!isValidCustomerCodeFormat(resolvedCode)) {
      throw new Error(
        "Customer offline sync wajib memakai kode customer valid CUS-DDMMYYYY-001 sebagai document ID."
      );
    }

    normalized.code = resolvedCode;
    normalized.customerCode = resolvedCode;
  }

  return {
    ...normalized,
    updatedAt: serverTimestamp(),
    lastSyncedAt: serverTimestamp(),
    syncStatus: LOCAL_SYNC_STATUSES.SYNCED,
  };
};

const markLocalRecordSynced = async ({ collectionName, documentId, deleted = false }) => {
  const dbInstance = getImsLocalDb();
  const existing = await dbInstance.table(collectionName).get(documentId);

  if (!existing) return null;

  const timestamp = nowIso();
  const nextRecord = {
    ...existing,
    syncStatus: LOCAL_SYNC_STATUSES.SYNCED,
    lastSyncedAt: timestamp,
    updatedAt: existing.updatedAt || timestamp,
    ...(deleted ? { _deleted: true, deletedAt: existing.deletedAt || timestamp } : {}),
  };

  await dbInstance.table(collectionName).put(nextRecord);
  return nextRecord;
};

const writeManualSyncAuditLog = async ({
  queueItem,
  status,
  errorMessage = "",
  firebaseCollection = "",
} = {}) => {
  if (!queueItem?.id) return null;

  const timestamp = nowIso();
  const auditLog = {
    id: `local-sync-${queueItem.id}-${Date.now()}`,
    module: "local_db_sync",
    action: `firebase_${status}`,
    referenceId: `${queueItem.collectionName}:${queueItem.documentId}`,
    createdAt: timestamp,
    metadata: {
      queueItemId: queueItem.id,
      collectionName: queueItem.collectionName,
      documentId: queueItem.documentId,
      operation: queueItem.operation,
      firebaseCollection,
      status,
      errorMessage,
    },
  };

  await getImsLocalDb().table(LOCAL_DB_TABLES.AUDIT_LOGS).put(auditLog);
  return auditLog;
};

const resolvePendingItems = async ({ collectionName = null, limit = 25 } = {}) => {
  const items = await listPendingSyncQueueItems({ collectionName });

  return items
    .filter((item) => {
      if (collectionName && item.collectionName !== collectionName) return false;
      return getFirebaseCollectionName(item.collectionName) || isUnsupportedCollection(item.collectionName);
    })
    .slice(0, Math.max(1, Number(limit || 25)));
};

const syncOneQueueItem = async (
  queueItem,
  {
    allowDeletes = false,
    allowOverwriteExistingCreate = false,
  } = {}
) => {
  const { collectionName, documentId, operation, payload = {} } = queueItem;

  if (isUnsupportedCollection(collectionName)) {
    throw new Error(UNSUPPORTED_FIREBASE_SYNC_REASON[collectionName]);
  }

  const firebaseCollection = getFirebaseCollectionName(collectionName);
  if (!firebaseCollection) {
    throw new Error(`Collection ${collectionName} belum punya mapping Firebase manual sync.`);
  }

  if (operation === LOCAL_SYNC_OPERATIONS.DELETE && !allowDeletes) {
    throw new Error(
      "Sync delete ke Firebase belum diaktifkan secara default. Jalankan manual sync dengan allowDeletes=true hanya setelah backup dan review impact."
    );
  }

  const firestoreRef = doc(db, firebaseCollection, documentId);
  const remoteSnapshot = await getDoc(firestoreRef);

  if (
    operation === LOCAL_SYNC_OPERATIONS.CREATE &&
    remoteSnapshot.exists() &&
    !allowOverwriteExistingCreate
  ) {
    const conflict = await recordSyncConflict({
      collectionName,
      documentId,
      conflictType: "create_remote_exists",
      localPayload: payload,
      remotePayload: {
        id: remoteSnapshot.id,
        ...remoteSnapshot.data(),
      },
      queueItemId: queueItem.id,
      reason:
        "CREATE lokal menemukan dokumen Firebase dengan ID yang sama. Manual review diperlukan sebelum overwrite.",
    });

    await updateSyncQueueItemStatus(queueItem.id, {
      status: LOCAL_SYNC_STATUSES.CONFLICT,
      errorMessage: "Conflict: remote document already exists.",
      metadataPatch: {
        conflictId: conflict.id,
      },
    });
    await writeManualSyncAuditLog({
      queueItem,
      status: LOCAL_SYNC_STATUSES.CONFLICT,
      errorMessage: "Conflict: remote document already exists.",
      firebaseCollection,
    });

    return {
      queueItemId: queueItem.id,
      collectionName,
      documentId,
      status: LOCAL_SYNC_STATUSES.CONFLICT,
      conflictId: conflict.id,
    };
  }

  await updateSyncQueueItemStatus(queueItem.id, {
    status: LOCAL_SYNC_STATUSES.SYNCING,
    errorMessage: "",
  });

  if (operation === LOCAL_SYNC_OPERATIONS.DELETE) {
    await deleteDoc(firestoreRef);
    await markLocalRecordSynced({ collectionName, documentId, deleted: true });
  } else if (
    operation === LOCAL_SYNC_OPERATIONS.CREATE ||
    operation === LOCAL_SYNC_OPERATIONS.UPDATE
  ) {
    const firestorePayload = buildFirestorePayload({
      collectionName,
      documentId,
      operation,
      payload,
    });
    await setDoc(firestoreRef, firestorePayload, { merge: true });
    await markLocalRecordSynced({ collectionName, documentId });
  } else {
    throw new Error(`Operation ${operation} belum didukung oleh Firebase master data sync.`);
  }

  await updateSyncQueueItemStatus(queueItem.id, {
    status: LOCAL_SYNC_STATUSES.SYNCED,
    errorMessage: "",
    metadataPatch: {
      syncedAt: nowIso(),
      firebaseCollection,
    },
  });
  await writeManualSyncAuditLog({
    queueItem,
    status: LOCAL_SYNC_STATUSES.SYNCED,
    firebaseCollection,
  });

  return {
    queueItemId: queueItem.id,
    collectionName,
    documentId,
    operation,
    status: LOCAL_SYNC_STATUSES.SYNCED,
  };
};

export const previewFirebaseMasterDataSync = async ({
  collectionName = null,
  limit = 25,
} = {}) => {
  const pendingItems = await resolvePendingItems({ collectionName, limit });
  const summary = {
    total: pendingItems.length,
    byCollection: {},
    unsupported: {},
  };

  pendingItems.forEach((item) => {
    summary.byCollection[item.collectionName] =
      (summary.byCollection[item.collectionName] || 0) + 1;

    if (isUnsupportedCollection(item.collectionName)) {
      summary.unsupported[item.collectionName] =
        UNSUPPORTED_FIREBASE_SYNC_REASON[item.collectionName];
    }
  });

  return {
    canSync: pendingItems.length > 0,
    requiresConfirmation: FIREBASE_MASTER_DATA_SYNC_CONFIRMATION,
    items: pendingItems.map((item) => ({
      id: item.id,
      collectionName: item.collectionName,
      documentId: item.documentId,
      operation: item.operation,
      syncStatus: item.syncStatus,
      localUpdatedAt: item.localUpdatedAt,
      unsupportedReason: UNSUPPORTED_FIREBASE_SYNC_REASON[item.collectionName] || "",
    })),
    summary,
  };
};

export const syncPendingMasterDataToFirebase = async ({
  confirmation = "",
  collectionName = null,
  limit = 25,
  allowDeletes = false,
  allowOverwriteExistingCreate = false,
} = {}) => {
  if (confirmation !== FIREBASE_MASTER_DATA_SYNC_CONFIRMATION) {
    throw new Error(
      `Manual Firebase sync membutuhkan confirmation: ${FIREBASE_MASTER_DATA_SYNC_CONFIRMATION}`
    );
  }

  const pendingItems = await resolvePendingItems({ collectionName, limit });
  const results = [];

  for (const queueItem of pendingItems) {
    try {
      const result = await syncOneQueueItem(queueItem, {
        allowDeletes,
        allowOverwriteExistingCreate,
      });
      results.push(result);
    } catch (error) {
      const errorMessage = error?.message || "Firebase master data sync gagal.";
      await updateSyncQueueItemStatus(queueItem.id, {
        status: LOCAL_SYNC_STATUSES.FAILED,
        errorMessage,
      });
      await writeManualSyncAuditLog({
        queueItem,
        status: LOCAL_SYNC_STATUSES.FAILED,
        errorMessage,
      });
      results.push({
        queueItemId: queueItem.id,
        collectionName: queueItem.collectionName,
        documentId: queueItem.documentId,
        operation: queueItem.operation,
        status: LOCAL_SYNC_STATUSES.FAILED,
        errorMessage,
      });
    }
  }

  return {
    syncedAt: nowIso(),
    total: results.length,
    synced: results.filter((result) => result.status === LOCAL_SYNC_STATUSES.SYNCED).length,
    failed: results.filter((result) => result.status === LOCAL_SYNC_STATUSES.FAILED).length,
    conflict: results.filter((result) => result.status === LOCAL_SYNC_STATUSES.CONFLICT).length,
    results,
  };
};
