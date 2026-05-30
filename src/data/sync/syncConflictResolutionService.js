import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

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

export const SYNC_CONFLICT_RESOLUTION_CONFIRMATION = "RESOLVE OFFLINE SYNC CONFLICT";
export const MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION = "RESOLVE MASTER DATA CONFLICT";

export const CONFLICT_RESOLUTION_MODES = Object.freeze({
  MARK_SKIPPED: "mark_skipped",
  LOCAL_WINS: "local_wins",
  REMOTE_WINS: "remote_wins",
});

const ACCEPTED_CONFLICT_RESOLUTION_CONFIRMATIONS = new Set([
  SYNC_CONFLICT_RESOLUTION_CONFIRMATION,
  MASTER_DATA_CONFLICT_RESOLUTION_CONFIRMATION,
]);

const FIREBASE_COLLECTION_BY_LOCAL_COLLECTION = Object.freeze({
  [LOCAL_DB_TABLES.CATEGORIES]: "categories",
  [LOCAL_DB_TABLES.CUSTOMERS]: "customers",
});

const sanitizeFirebasePayload = (payload = {}) => {
  const cloned = JSON.parse(JSON.stringify(payload || {}));
  ["_deleted", "syncStatus", "localUpdatedAt", "lastSyncedAt", "remoteUpdatedAt", "deletedAt", "deletedBy"].forEach((fieldName) => {
    delete cloned[fieldName];
  });
  return cloned;
};

const getAllowedFirebaseCollection = (collectionName) =>
  FIREBASE_COLLECTION_BY_LOCAL_COLLECTION[collectionName] || null;

const assertConfirmation = (confirmation = "") => {
  if (!ACCEPTED_CONFLICT_RESOLUTION_CONFIRMATIONS.has(confirmation)) {
    throw new Error(
      `Untuk resolve conflict, isi confirmation: ${SYNC_CONFLICT_RESOLUTION_CONFIRMATION}`
    );
  }
};

const normalizeResolutionStrategy = (strategy = "") => {
  if (strategy === CONFLICT_RESOLUTION_MODES.LOCAL_WINS) return "local_wins";
  if (strategy === CONFLICT_RESOLUTION_MODES.REMOTE_WINS) return "remote_wins";
  if (
    strategy === CONFLICT_RESOLUTION_MODES.MARK_SKIPPED ||
    strategy === "skip" ||
    strategy === "mark_skipped"
  ) {
    return "skip";
  }

  return "skip";
};

const resolveLocalWins = async (conflict, { timestamp }) => {
  const firebaseCollection = getAllowedFirebaseCollection(conflict.collectionName);
  if (!firebaseCollection) {
    throw new Error(`Collection ${conflict.collectionName} belum diizinkan untuk conflict local-wins.`);
  }

  const payload = sanitizeFirebasePayload(conflict.localPayload || {});
  await setDoc(
    doc(db, firebaseCollection, conflict.documentId),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  if (conflict.queueId) {
    await updateSyncQueueItemStatus(conflict.queueId, {
      status: LOCAL_SYNC_STATUSES.SYNCED,
      errorMessage: "",
      metadataPatch: {
        resolvedConflictId: conflict.id,
        resolvedBy: "local_wins",
        resolvedAt: timestamp,
      },
    });
  }

  return "local_wins";
};

const resolveRemoteWins = async (conflict, { timestamp }) => {
  const firebaseCollection = getAllowedFirebaseCollection(conflict.collectionName);
  if (!firebaseCollection) {
    throw new Error(`Collection ${conflict.collectionName} belum diizinkan untuk conflict remote-wins.`);
  }

  const snapshot = await getDoc(doc(db, firebaseCollection, conflict.documentId));
  const remotePayload = snapshot.exists()
    ? { id: snapshot.id, ...snapshot.data() }
    : conflict.remotePayload;

  if (!remotePayload) {
    throw new Error("Remote payload tidak tersedia untuk remote_wins.");
  }

  const dbLocal = getImsLocalDb();
  await dbLocal.table(conflict.collectionName).put({
    ...remotePayload,
    id: conflict.documentId,
    syncStatus: LOCAL_SYNC_STATUSES.SYNCED,
    lastSyncedAt: timestamp,
    updatedAt: remotePayload.updatedAt || timestamp,
  });

  if (conflict.queueId) {
    await updateSyncQueueItemStatus(conflict.queueId, {
      status: LOCAL_SYNC_STATUSES.SYNCED,
      errorMessage: "",
      metadataPatch: {
        resolvedConflictId: conflict.id,
        resolvedBy: "remote_wins",
        resolvedAt: timestamp,
      },
    });
  }

  return "remote_wins";
};

const resolveSkip = async (conflict, { timestamp }) => {
  if (conflict.queueId) {
    await updateSyncQueueItemStatus(conflict.queueId, {
      status: LOCAL_SYNC_STATUSES.FAILED,
      errorMessage: "Conflict ditandai skip manual; queue belum disync.",
      metadataPatch: {
        resolvedConflictId: conflict.id,
        resolvedBy: "skip",
        resolvedAt: timestamp,
      },
    });
  }

  return "skip";
};

export const resolveSyncConflict = async (
  conflictId,
  { strategy = "skip", confirmation = "", note = "" } = {},
) => {
  assertConfirmation(confirmation);

  const conflict = await getSyncConflictById(conflictId);
  if (!conflict) {
    throw new Error("Sync conflict tidak ditemukan.");
  }

  if (conflict.resolvedAt) {
    return { conflict, alreadyResolved: true };
  }

  if (conflict.queueId) {
    await getSyncQueueItemById(conflict.queueId);
  }

  const timestamp = new Date().toISOString();
  const normalizedStrategy = normalizeResolutionStrategy(strategy);
  let resolution = "skip";

  if (normalizedStrategy === "local_wins") {
    resolution = await resolveLocalWins(conflict, { timestamp });
  } else if (normalizedStrategy === "remote_wins") {
    resolution = await resolveRemoteWins(conflict, { timestamp });
  } else {
    resolution = await resolveSkip(conflict, { timestamp });
  }

  const resolvedConflict = await updateSyncConflictResolution(conflict.id, {
    resolution,
    resolvedAt: timestamp,
    metadataPatch: {
      resolutionNote: note,
    },
  });

  return { conflict: resolvedConflict, resolution, resolvedAt: timestamp };
};

export const resolveMasterDataSyncConflict = ({
  conflictId,
  resolutionMode = CONFLICT_RESOLUTION_MODES.MARK_SKIPPED,
  confirmation = "",
  resolutionNote = "",
} = {}) =>
  resolveSyncConflict(conflictId, {
    strategy: resolutionMode,
    confirmation,
    note: resolutionNote,
  });

