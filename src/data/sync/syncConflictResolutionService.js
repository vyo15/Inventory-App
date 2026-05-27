import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../../firebase";
import { getImsLocalDb } from "../local/imsLocalDb";
import {
  LOCAL_DB_TABLES,
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

export const MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION = "RESOLVE MASTER DATA CONFLICT";

export const MASTER_DATA_CONFLICT_RESOLUTIONS = Object.freeze({
  LOCAL_WINS: "local_wins",
  REMOTE_WINS: "remote_wins",
  MARK_SKIPPED: "mark_skipped",
});

const RESOLVABLE_COLLECTIONS = Object.freeze([
  LOCAL_DB_TABLES.CATEGORIES,
  LOCAL_DB_TABLES.CUSTOMERS,
]);

const FIREBASE_COLLECTION_BY_LOCAL_COLLECTION = Object.freeze({
  [LOCAL_DB_TABLES.CATEGORIES]: "categories",
  [LOCAL_DB_TABLES.CUSTOMERS]: "customers",
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

const assertConfirmation = (confirmation = "") => {
  if (confirmation !== MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION) {
    throw new Error(
      `Resolusi konflik wajib memakai keyword: ${MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION}`
    );
  }
};

const assertResolvableConflict = (conflict) => {
  if (!conflict) {
    throw new Error("Konflik sync tidak ditemukan.");
  }

  if (conflict.resolvedAt) {
    throw new Error("Konflik sync ini sudah pernah diselesaikan.");
  }

  if (!RESOLVABLE_COLLECTIONS.includes(conflict.collectionName)) {
    throw new Error(
      `Resolusi konflik untuk ${conflict.collectionName || "collection kosong"} belum diizinkan.`
    );
  }
};

const normalizeResolution = (resolution) => {
  if (Object.values(MASTER_DATA_CONFLICT_RESOLUTIONS).includes(resolution)) {
    return resolution;
  }

  throw new Error("Mode resolusi konflik tidak valid.");
};

const writeConflictResolutionAudit = async ({ conflict, resolution, note, actorLabel }) => {
  const dbLocal = getImsLocalDb();
  const timestamp = nowIso();

  await dbLocal.table(LOCAL_DB_TABLES.AUDIT_LOGS).put({
    id: `local-conflict-resolution-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    module: "local_db_sync_conflict",
    action: resolution,
    referenceId: conflict.documentId,
    createdAt: timestamp,
    metadata: {
      conflictId: conflict.id,
      queueId: conflict.queueId || "",
      collectionName: conflict.collectionName,
      conflictType: conflict.conflictType,
      note,
      actorLabel,
      scope: "master_data_pilot",
    },
  });
};

const markQueueAfterResolution = async ({ queueId, resolution, message }) => {
  if (!queueId) return null;

  const queue = await getSyncQueueItemById(queueId);
  if (!queue) return null;

  const status = resolution === MASTER_DATA_CONFLICT_RESOLUTIONS.MARK_SKIPPED
    ? LOCAL_SYNC_STATUSES.FAILED
    : LOCAL_SYNC_STATUSES.SYNCED;

  return updateSyncQueueItemStatus(queueId, {
    status,
    errorMessage: resolution === MASTER_DATA_CONFLICT_RESOLUTIONS.MARK_SKIPPED ? message : "",
    metadataPatch: {
      resolvedConflictAt: nowIso(),
      conflictResolution: resolution,
    },
  });
};

const applyLocalWins = async (conflict) => {
  const firebaseCollection = FIREBASE_COLLECTION_BY_LOCAL_COLLECTION[conflict.collectionName];
  const payload = sanitizeFirestorePayload(conflict.localPayload || {});

  if (!firebaseCollection) {
    throw new Error(`Collection ${conflict.collectionName} belum punya mapping Firebase.`);
  }

  if (!Object.keys(payload).length) {
    throw new Error("Payload local kosong, tidak aman ditulis ke Firebase.");
  }

  await setDoc(
    doc(db, firebaseCollection, conflict.documentId),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { firebaseCollection, documentId: conflict.documentId };
};

const applyRemoteWins = async (conflict) => {
  const remotePayload = clonePayload(conflict.remotePayload);

  if (!remotePayload) {
    throw new Error("Payload remote kosong. Gunakan mark_skipped jika konflik hanya perlu ditandai selesai.");
  }

  const dbLocal = getImsLocalDb();
  const timestamp = nowIso();
  const record = {
    ...remotePayload,
    id: conflict.documentId,
    syncStatus: LOCAL_SYNC_STATUSES.SYNCED,
    remoteUpdatedAt: timestamp,
    lastSyncedAt: timestamp,
    localUpdatedAt: timestamp,
    _deleted: false,
  };

  await dbLocal.table(conflict.collectionName).put(record);
  return { localTable: conflict.collectionName, documentId: conflict.documentId };
};

export const resolveMasterDataSyncConflict = async (
  conflictId,
  {
    resolution,
    confirmation = "",
    note = "",
    actorLabel = "",
  } = {}
) => {
  assertConfirmation(confirmation);

  const nextResolution = normalizeResolution(resolution);
  const conflict = await getSyncConflictById(conflictId);
  assertResolvableConflict(conflict);

  if (
    conflict.conflictType?.includes("delete") &&
    nextResolution !== MASTER_DATA_CONFLICT_RESOLUTIONS.MARK_SKIPPED
  ) {
    throw new Error("Konflik delete tidak boleh di-resolve otomatis. Gunakan mark_skipped setelah review manual.");
  }

  let actionResult = null;
  if (nextResolution === MASTER_DATA_CONFLICT_RESOLUTIONS.LOCAL_WINS) {
    actionResult = await applyLocalWins(conflict);
  } else if (nextResolution === MASTER_DATA_CONFLICT_RESOLUTIONS.REMOTE_WINS) {
    actionResult = await applyRemoteWins(conflict);
  } else {
    actionResult = { skipped: true };
  }

  const updatedConflict = await updateSyncConflictResolution(conflict.id, {
    resolution: nextResolution,
    resolvedBy: actorLabel,
    note,
    metadataPatch: {
      actionResult,
    },
  });

  const updatedQueue = await markQueueAfterResolution({
    queueId: conflict.queueId,
    resolution: nextResolution,
    message: note || "Konflik ditandai skipped dari dev panel.",
  });

  await writeConflictResolutionAudit({
    conflict,
    resolution: nextResolution,
    note,
    actorLabel,
  });

  return {
    conflict: updatedConflict,
    queue: updatedQueue,
    actionResult,
  };
};
