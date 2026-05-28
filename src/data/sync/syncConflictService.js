import { getImsLocalDb } from "../local/imsLocalDb";
import { LOCAL_DB_TABLES } from "../local/localDbSchema";

const nowIso = () => new Date().toISOString();

const clonePayload = (payload = null) => JSON.parse(JSON.stringify(payload || null));

const createConflictId = ({ collectionName, documentId, conflictType }) => {
  const timestamp = Date.now();
  const randomSuffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10);

  return `conflict-${collectionName}-${documentId}-${conflictType}-${timestamp}-${randomSuffix}`;
};

export const recordSyncConflict = async ({
  collectionName,
  documentId,
  conflictType = "unknown",
  localPayload = null,
  remotePayload = null,
  queueItemId = null,
  reason = "",
  metadata = {},
} = {}) => {
  if (!collectionName || !documentId) {
    throw new Error("collectionName dan documentId wajib diisi untuk sync_conflicts.");
  }

  const db = getImsLocalDb();
  const detectedAt = nowIso();
  const conflict = {
    id: createConflictId({ collectionName, documentId, conflictType }),
    collectionName,
    documentId,
    conflictType,
    localPayload: clonePayload(localPayload),
    remotePayload: clonePayload(remotePayload),
    queueItemId,
    reason,
    metadata: clonePayload(metadata) || {},
    detectedAt,
    resolvedAt: null,
    resolution: "",
    resolutionNote: "",
  };

  await db.table(LOCAL_DB_TABLES.SYNC_CONFLICTS).put(conflict);
  return conflict;
};

// LEGACY-COMPAT: beberapa patch/panel lama sempat import createSyncConflict.
// Jangan hapus alias ini sebelum semua usage lama diaudit.
export const createSyncConflict = (payload = {}) => recordSyncConflict(payload);

export const getSyncConflictById = async (conflictId) => {
  if (!conflictId) return null;

  const db = getImsLocalDb();
  return db.table(LOCAL_DB_TABLES.SYNC_CONFLICTS).get(conflictId);
};

export const listSyncConflicts = async ({
  collectionName = null,
  unresolvedOnly = true,
} = {}) => {
  const db = getImsLocalDb();
  const rows = await db.table(LOCAL_DB_TABLES.SYNC_CONFLICTS).toArray();

  return rows
    .filter((row) => {
      if (collectionName && row.collectionName !== collectionName) return false;
      if (unresolvedOnly && row.resolvedAt) return false;
      return true;
    })
    .sort((first, second) =>
      String(second.detectedAt || "").localeCompare(String(first.detectedAt || ""))
    );
};

export const getSyncConflictSummary = async () => {
  const rows = await listSyncConflicts({ unresolvedOnly: false });
  const summary = {
    total: rows.length,
    unresolved: 0,
    resolved: 0,
    byCollection: {},
    byResolution: {},
  };

  rows.forEach((row) => {
    if (row.resolvedAt) {
      summary.resolved += 1;
    } else {
      summary.unresolved += 1;
    }

    summary.byCollection[row.collectionName] =
      (summary.byCollection[row.collectionName] || 0) + 1;

    const resolution = row.resolution || "unresolved";
    summary.byResolution[resolution] = (summary.byResolution[resolution] || 0) + 1;
  });

  return summary;
};

export const updateSyncConflictResolution = async (
  conflictId,
  {
    resolution,
    resolutionNote = "",
    metadataPatch = {},
  } = {}
) => {
  if (!conflictId) {
    throw new Error("conflictId wajib diisi untuk update resolution sync_conflicts.");
  }

  const db = getImsLocalDb();
  const existing = await db.table(LOCAL_DB_TABLES.SYNC_CONFLICTS).get(conflictId);

  if (!existing) {
    throw new Error("Data conflict tidak ditemukan.");
  }

  const resolvedAt = nowIso();
  const nextRecord = {
    ...existing,
    resolution: resolution || existing.resolution || "reviewed",
    resolutionNote,
    resolvedAt,
    metadata: {
      ...(existing.metadata || {}),
      ...clonePayload(metadataPatch),
    },
  };

  await db.table(LOCAL_DB_TABLES.SYNC_CONFLICTS).put(nextRecord);
  return nextRecord;
};
