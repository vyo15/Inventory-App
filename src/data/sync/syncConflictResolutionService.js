import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../../firebase";
import { isValidCustomerCodeFormat } from "../../services/MasterData/customersService";
import { getImsLocalDb } from "../local/imsLocalDb";
import {
  LOCAL_DB_TABLES,
  LOCAL_SYNC_OPERATIONS,
  LOCAL_SYNC_STATUSES,
} from "../local/localDbSchema";
import {
  getSyncConflictById,
  updateSyncConflictResolution,
} from "./syncConflictService";
import {
  getSyncQueueItemById,
  updateSyncQueueItemStatus,
} from "./syncQueueService";

export const MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION =
  "RESOLVE MASTER DATA CONFLICT";

export const CONFLICT_RESOLUTION_MODES = Object.freeze({
  LOCAL_WINS: "local_wins",
  REMOTE_WINS: "remote_wins",
  MARK_SKIPPED: "mark_skipped",
});

const FIREBASE_COLLECTION_BY_LOCAL_TABLE = Object.freeze({
  [LOCAL_DB_TABLES.CATEGORIES]: "categories",
  [LOCAL_DB_TABLES.CUSTOMERS]: "customers",
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

const clonePayload = (payload = null) => JSON.parse(JSON.stringify(payload || null));

const stripLocalOnlyFields = (payload = {}) =>
  Object.fromEntries(
    Object.entries(payload || {}).filter(
      ([fieldName, value]) => !LOCAL_ONLY_FIELDS.has(fieldName) && value !== undefined
    )
  );

const assertConfirmation = (confirmation) => {
  if (confirmation !== MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION) {
    throw new Error(
      `Resolve conflict membutuhkan confirmation: ${MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION}`
    );
  }
};

const assertAllowedConflictCollection = (collectionName) => {
  if (!FIREBASE_COLLECTION_BY_LOCAL_TABLE[collectionName]) {
    throw new Error(
      `Conflict collection ${collectionName || "kosong"} belum diizinkan untuk resolver master data pilot.`
    );
  }
};

const normalizeResolutionMode = (resolutionMode) => {
  const values = Object.values(CONFLICT_RESOLUTION_MODES);
  return values.includes(resolutionMode)
    ? resolutionMode
    : CONFLICT_RESOLUTION_MODES.MARK_SKIPPED;
};

const buildFirestorePayload = ({ collectionName, documentId, payload = {} }) => {
  const normalized = stripLocalOnlyFields(payload);

  if (collectionName === LOCAL_DB_TABLES.CUSTOMERS) {
    const resolvedCode = normalized.code || normalized.customerCode || documentId;
    if (!isValidCustomerCodeFormat(resolvedCode)) {
      throw new Error(
        "Customer conflict local_wins wajib memakai kode customer valid CUS-DDMMYYYY-001 sebagai document ID."
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

const writeConflictResolutionAuditLog = async ({
  conflict,
  resolution,
  resolutionNote = "",
} = {}) => {
  const timestamp = nowIso();
  const auditLog = {
    id: `local-conflict-resolution-${conflict.id}-${Date.now()}`,
    module: "local_db_sync_conflict",
    action: `resolve_${resolution}`,
    referenceId: `${conflict.collectionName}:${conflict.documentId}`,
    createdAt: timestamp,
    metadata: {
      conflictId: conflict.id,
      queueItemId: conflict.queueItemId || "",
      collectionName: conflict.collectionName,
      documentId: conflict.documentId,
      conflictType: conflict.conflictType,
      resolution,
      resolutionNote,
    },
  };

  await getImsLocalDb().table(LOCAL_DB_TABLES.AUDIT_LOGS).put(auditLog);
  return auditLog;
};

const markQueueResolved = async ({ queueItem, resolution }) => {
  if (!queueItem?.id) return null;

  const status =
    resolution === CONFLICT_RESOLUTION_MODES.MARK_SKIPPED
      ? LOCAL_SYNC_STATUSES.FAILED
      : LOCAL_SYNC_STATUSES.SYNCED;

  return updateSyncQueueItemStatus(queueItem.id, {
    status,
    errorMessage:
      resolution === CONFLICT_RESOLUTION_MODES.MARK_SKIPPED
        ? "Conflict ditandai skipped/manual review."
        : "",
    metadataPatch: {
      conflictResolution: resolution,
      conflictResolvedAt: nowIso(),
    },
  });
};

const applyLocalWins = async ({ conflict, queueItem }) => {
  if (queueItem?.operation === LOCAL_SYNC_OPERATIONS.DELETE) {
    throw new Error("Conflict delete tidak di-resolve otomatis. Gunakan mark_skipped lalu review manual.");
  }

  const firebaseCollection = FIREBASE_COLLECTION_BY_LOCAL_TABLE[conflict.collectionName];
  const payload = queueItem?.payload || conflict.localPayload || {};
  const firestorePayload = buildFirestorePayload({
    collectionName: conflict.collectionName,
    documentId: conflict.documentId,
    payload,
  });

  await setDoc(doc(db, firebaseCollection, conflict.documentId), firestorePayload, {
    merge: true,
  });

  const timestamp = nowIso();
  await getImsLocalDb().table(conflict.collectionName).put({
    ...clonePayload(payload),
    id: conflict.documentId,
    syncStatus: LOCAL_SYNC_STATUSES.SYNCED,
    lastSyncedAt: timestamp,
    updatedAt: payload.updatedAt || timestamp,
    _deleted: false,
  });
};

const applyRemoteWins = async ({ conflict }) => {
  const remotePayload = conflict.remotePayload || {};
  const timestamp = nowIso();

  await getImsLocalDb().table(conflict.collectionName).put({
    ...clonePayload(remotePayload),
    id: conflict.documentId,
    syncStatus: LOCAL_SYNC_STATUSES.SYNCED,
    lastSyncedAt: timestamp,
    localUpdatedAt: timestamp,
    _deleted: false,
  });
};

export const resolveMasterDataSyncConflict = async ({
  conflictId,
  resolutionMode = CONFLICT_RESOLUTION_MODES.MARK_SKIPPED,
  confirmation = "",
  resolutionNote = "",
} = {}) => {
  assertConfirmation(confirmation);

  const conflict = await getSyncConflictById(conflictId);
  if (!conflict) {
    throw new Error("Conflict tidak ditemukan.");
  }

  if (conflict.resolvedAt) {
    return {
      resolved: false,
      skipped: true,
      reason: "already_resolved",
      conflict,
    };
  }

  assertAllowedConflictCollection(conflict.collectionName);

  const queueItem = conflict.queueItemId
    ? await getSyncQueueItemById(conflict.queueItemId)
    : null;
  const resolution = normalizeResolutionMode(resolutionMode);

  if (resolution === CONFLICT_RESOLUTION_MODES.LOCAL_WINS) {
    await applyLocalWins({ conflict, queueItem });
  }

  if (resolution === CONFLICT_RESOLUTION_MODES.REMOTE_WINS) {
    if (queueItem?.operation === LOCAL_SYNC_OPERATIONS.DELETE) {
      throw new Error("Conflict delete tidak di-resolve otomatis. Gunakan mark_skipped lalu review manual.");
    }
    await applyRemoteWins({ conflict });
  }

  await markQueueResolved({ queueItem, resolution });
  const resolvedConflict = await updateSyncConflictResolution(conflict.id, {
    resolution,
    resolutionNote,
    metadataPatch: {
      queueItemFound: Boolean(queueItem),
    },
  });
  await writeConflictResolutionAuditLog({
    conflict,
    resolution,
    resolutionNote,
  });

  return {
    resolved: true,
    resolution,
    conflict: resolvedConflict,
  };
};
