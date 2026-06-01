import { getImsLocalDb } from "../../local/imsLocalDb";
import {
  LOCAL_DB_TABLES,
  LOCAL_SYNC_OPERATIONS,
} from "../../local/localDbSchema";
import { enqueueSyncOperation } from "../../sync/syncQueueService";
import { createSyncRecordFingerprint } from "../../sync/syncVersionGuard";

const nowIso = () => new Date().toISOString();

const cloneRecord = (record = {}) => JSON.parse(JSON.stringify(record || {}));

const trimText = (value) => (typeof value === "string" ? value.trim() : value);

const normalizePayload = (payload = {}) =>
  Object.fromEntries(
    Object.entries(cloneRecord(payload)).filter(([, value]) => value !== undefined)
  );

const createLocalId = (prefix = "local") => {
  const randomSuffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${randomSuffix}`;
};

const resolveRecordId = ({ payload = {}, idFields = ["id"], fallbackPrefix = null }) => {
  for (const fieldName of idFields) {
    const candidate = trimText(payload[fieldName]);
    if (candidate) return candidate;
  }

  if (fallbackPrefix) {
    return createLocalId(fallbackPrefix);
  }

  throw new Error("ID record lokal wajib tersedia sebelum disimpan ke offline DB.");
};

const sortByName = (records = []) =>
  [...records].sort((first, second) =>
    String(first?.name || "").localeCompare(String(second?.name || ""), "id", {
      sensitivity: "base",
    })
  );

const shouldQueueSync = (options = {}) => options.queueSync !== false;

export const createDexieMasterDataAdapter = ({
  tableName,
  syncCollectionName = tableName,
  idFields = ["id"],
  fallbackPrefix = null,
} = {}) => {
  if (!tableName) {
    throw new Error("tableName wajib diisi untuk Dexie master data adapter.");
  }

  const getDb = () => getImsLocalDb();
  const getTable = () => getDb().table(tableName);

  const list = async ({ includeDeleted = false } = {}) => {
    const rows = await getTable().toArray();
    const visibleRows = includeDeleted ? rows : rows.filter((row) => !row?._deleted);
    return sortByName(visibleRows);
  };

  const getById = async (id) => {
    if (!id) return null;
    const row = await getTable().get(id);
    return row && !row._deleted ? row : null;
  };

  const create = async (values = {}, options = {}) => {
    const payload = normalizePayload(values);
    const id = resolveRecordId({ payload, idFields, fallbackPrefix });
    const timestamp = nowIso();
    const record = {
      ...payload,
      id,
      syncStatus: payload.syncStatus || "pending",
      createdAt: payload.createdAt || timestamp,
      updatedAt: timestamp,
      localUpdatedAt: timestamp,
      _deleted: false,
    };

    const db = getDb();
    await db.transaction("rw", getTable(), db.table(LOCAL_DB_TABLES.SYNC_QUEUE), async () => {
      await getTable().put(record);
      if (shouldQueueSync(options)) {
        await enqueueSyncOperation({
          collectionName: syncCollectionName,
          documentId: id,
          operation: LOCAL_SYNC_OPERATIONS.CREATE,
          payload: record,
          now: timestamp,
        });
      }
    });

    return record;
  };

  const update = async (id, values = {}, options = {}) => {
    if (!id) {
      throw new Error("ID record lokal yang akan diubah wajib diisi.");
    }

    const existing = await getTable().get(id);
    if (!existing || existing._deleted) {
      throw new Error("Record lokal tidak ditemukan atau sudah dihapus.");
    }

    const timestamp = nowIso();
    const record = {
      ...existing,
      ...normalizePayload(values),
      id,
      syncStatus: "pending",
      updatedAt: timestamp,
      localUpdatedAt: timestamp,
      _deleted: false,
    };

    const db = getDb();
    await db.transaction("rw", getTable(), db.table(LOCAL_DB_TABLES.SYNC_QUEUE), async () => {
      await getTable().put(record);
      if (shouldQueueSync(options)) {
        await enqueueSyncOperation({
          collectionName: syncCollectionName,
          documentId: id,
          operation: LOCAL_SYNC_OPERATIONS.UPDATE,
          payload: record,
          baseVersion: existing?.updatedAt || existing?.remoteUpdatedAt || null,
          metadata: {
            baseRecordFingerprint: createSyncRecordFingerprint(existing),
            baseRecordUpdatedAt: existing?.updatedAt || null,
            baseRecordRemoteUpdatedAt: existing?.remoteUpdatedAt || null,
          },
          now: timestamp,
        });
      }
    });

    return record;
  };

  const remove = async (id, options = {}) => {
    const { hardDelete = false } = options;

    if (!id) {
      throw new Error("ID record lokal yang akan dihapus wajib diisi.");
    }

    const db = getDb();

    if (hardDelete) {
      await db.transaction("rw", getTable(), db.table(LOCAL_DB_TABLES.SYNC_QUEUE), async () => {
        await getTable().delete(id);
        if (shouldQueueSync(options)) {
          await enqueueSyncOperation({
            collectionName: syncCollectionName,
            documentId: id,
            operation: LOCAL_SYNC_OPERATIONS.DELETE,
            payload: { id, _deleted: true },
          });
        }
      });
      return { id, deleted: true, hardDelete: true };
    }

    const existing = await getTable().get(id);
    if (!existing) {
      return { id, deleted: false, reason: "not_found" };
    }

    const timestamp = nowIso();
    const record = {
      ...existing,
      id,
      syncStatus: "pending",
      updatedAt: timestamp,
      localUpdatedAt: timestamp,
      deletedAt: timestamp,
      _deleted: true,
    };

    await db.transaction("rw", getTable(), db.table(LOCAL_DB_TABLES.SYNC_QUEUE), async () => {
      await getTable().put(record);
      if (shouldQueueSync(options)) {
        await enqueueSyncOperation({
          collectionName: syncCollectionName,
          documentId: id,
          operation: LOCAL_SYNC_OPERATIONS.DELETE,
          payload: record,
          baseVersion: existing?.updatedAt || existing?.remoteUpdatedAt || null,
          metadata: {
            baseRecordFingerprint: createSyncRecordFingerprint(existing),
            baseRecordUpdatedAt: existing?.updatedAt || null,
            baseRecordRemoteUpdatedAt: existing?.remoteUpdatedAt || null,
          },
          now: timestamp,
        });
      }
    });

    return { id, deleted: true, hardDelete: false };
  };

  return {
    list,
    getById,
    create,
    update,
    remove,
  };
};
