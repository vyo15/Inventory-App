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

  return `conflict-${collectionName}-${conflictType}-${documentId}-${timestamp}-${randomSuffix}`;
};

export const createSyncConflict = async ({
  collectionName,
  documentId,
  conflictType,
  queueId = "",
  localPayload = null,
  remotePayload = null,
  message = "",
  metadata = {},
} = {}) => {
  if (!collectionName || !documentId || !conflictType) {
    throw new Error("collectionName, documentId, dan conflictType wajib diisi untuk sync_conflicts.");
  }

  const detectedAt = nowIso();
  const conflict = {
    id: createConflictId({ collectionName, documentId, conflictType }),
    queueId,
    collectionName,
    documentId,
    conflictType,
    localPayload: clonePayload(localPayload),
    remotePayload: clonePayload(remotePayload),
    message,
    metadata: clonePayload(metadata) || {},
    detectedAt,
    resolvedAt: null,
    resolution: "",
  };

  const db = getImsLocalDb();
  await db.table(LOCAL_DB_TABLES.SYNC_CONFLICTS).put(conflict);
  return conflict;
};

export const listSyncConflicts = async ({ unresolvedOnly = true } = {}) => {
  const db = getImsLocalDb();
  const rows = await db.table(LOCAL_DB_TABLES.SYNC_CONFLICTS).toArray();

  return rows
    .filter((row) => !unresolvedOnly || !row.resolvedAt)
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
    byType: {},
  };

  rows.forEach((row) => {
    if (row.resolvedAt) {
      summary.resolved += 1;
    } else {
      summary.unresolved += 1;
    }

    summary.byCollection[row.collectionName] =
      (summary.byCollection[row.collectionName] || 0) + 1;
    summary.byType[row.conflictType] = (summary.byType[row.conflictType] || 0) + 1;
  });

  return summary;
};


export const recordSyncConflict = createSyncConflict;

export const getSyncConflictById = async (conflictId) => {
  if (!conflictId) return null;
  const db = getImsLocalDb();
  return db.table(LOCAL_DB_TABLES.SYNC_CONFLICTS).get(conflictId);
};

export const updateSyncConflictResolution = async (
  conflictId,
  { resolution = "", resolvedAt = nowIso(), metadataPatch = {} } = {},
) => {
  if (!conflictId) {
    throw new Error("conflictId wajib diisi untuk resolve sync conflict.");
  }

  const db = getImsLocalDb();
  const existing = await db.table(LOCAL_DB_TABLES.SYNC_CONFLICTS).get(conflictId);
  if (!existing) {
    throw new Error("Sync conflict tidak ditemukan.");
  }

  const record = {
    ...existing,
    resolution,
    resolvedAt,
    metadata: {
      ...(existing.metadata || {}),
      ...metadataPatch,
    },
  };

  await db.table(LOCAL_DB_TABLES.SYNC_CONFLICTS).put(record);
  return record;
};
