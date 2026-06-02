import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  buildStockItemReadModelPayload,
  normalizeStockReadModelSourceType,
  STOCK_READ_MODEL_SOURCE_COLLECTIONS,
} from "../../utils/stock/stockHelpers";
import { getRepositoryModeStatus } from "../../data/repositories/repositoryModeService";
import * as sqliteStockReadModelsAdapter from "../../data/adapters/sqlite/sqliteStockReadModelsAdapter";

export const STOCK_ITEM_READ_MODELS_COLLECTION = "stock_item_read_models";

const STOCK_READ_MODEL_BATCH_LIMIT = 450;

const toSafeString = (value = "") => String(value ?? "").trim();

const shouldUseSqliteStockReadModels = async () => {
  const status = await getRepositoryModeStatus();
  return status.isSqliteSidecar === true;
};

const toSqliteStockReadModelRecord = (record = {}) => ({
  ...record,
  id: record.id || buildStockItemReadModelDocumentId(record),
  code: record.code || record.referenceCode || record.sourceRef || buildStockItemReadModelDocumentId(record),
  name: record.name || record.itemName || record.sourceName || '',
  sourceType: normalizeStockReadModelSourceType(record.sourceType || record.type || ''),
  sourceId: record.sourceId || record.id || '',
});


const toStockReadModelRow = (documentSnapshot) => mapStockReadModelDocumentToRow({
  id: documentSnapshot.id,
  ...documentSnapshot.data(),
});

export const mapStockReadModelDocumentToRow = (readModel = {}) => {
  const stockStatus = toSafeString(readModel.stockStatus || 'safe') || 'safe';
  const reportStatus = readModel.reportStatus || (stockStatus === 'empty' ? 'Habis' : stockStatus === 'low' ? 'Kritis' : 'Normal');
  const affectedVariantEntries = Array.isArray(readModel.affectedVariantEntries)
    ? readModel.affectedVariantEntries
    : [];

  return {
    ...readModel,
    readModelId: readModel.id,
    id: readModel.sourceId || readModel.id,
    key: `${readModel.sourceType || 'stock'}-${readModel.sourceId || readModel.id}`,
    type: readModel.typeLabel || readModel.type || '',
    to: readModel.route || readModel.to || '/stock-management',
    category: readModel.categoryName || readModel.category || '',
    stock: Number(readModel.availableStock || 0),
    sourceStock: Number(readModel.stock || 0),
    currentStock: Number(readModel.currentStock || 0),
    reservedStock: Number(readModel.reservedStock || 0),
    availableStock: Number(readModel.availableStock || 0),
    stockDisplay: Number(readModel.availableStock || 0),
    minStockDisplay: Number(readModel.minStockThreshold || 0),
    minStock: Number(readModel.minStockThreshold || 0),
    unitDisplay: readModel.unitDisplay || readModel.unit || 'pcs',
    unit: readModel.unitDisplay || readModel.unit || 'pcs',
    status: reportStatus,
    sortGap: Number(readModel.sortGap || 0),
    severity: {
      status: stockStatus,
      reportStatus,
      label: readModel.stockStatusLabel || reportStatus,
      color: readModel.statusColor || 'green',
      alertType: readModel.alertType || 'success',
      affectedVariants: affectedVariantEntries,
    },
    statusMeta: {
      status: stockStatus,
      reportStatus,
      label: readModel.stockStatusLabel || reportStatus,
      color: readModel.statusColor || 'green',
      alertType: readModel.alertType || 'success',
      affectedVariants: affectedVariantEntries,
    },
    affectedVariantEntries,
    affectedVariantSummary: readModel.affectedVariantSummary || '',
    variants: Array.isArray(readModel.variants) ? readModel.variants : [],
  };
};

export const buildStockItemReadModelDocumentId = ({ sourceType = "", sourceId = "" } = {}) => {
  const resolvedSourceType = normalizeStockReadModelSourceType(sourceType);
  const resolvedSourceId = toSafeString(sourceId);

  if (!resolvedSourceId) {
    throw new Error("Source ID stok wajib tersedia untuk membuat stock read model.");
  }

  return `${resolvedSourceType}__${resolvedSourceId}`;
};

export const resolveStockReadModelSourceCollection = (sourceType = "", sourceCollection = "") => {
  const resolvedSourceType = normalizeStockReadModelSourceType(sourceType);
  return sourceCollection || STOCK_READ_MODEL_SOURCE_COLLECTIONS[resolvedSourceType] || "products";
};

export const buildStockItemReadModelDocument = (
  record = {},
  {
    id,
    sourceId = "",
    sourceType = "",
    sourceCollection = "",
    syncedAt = null,
    lastSyncedFrom = "stock_read_model_service",
    ...payloadOptions
  } = {},
) => {
  const resolvedSourceId = toSafeString(sourceId || id || record?.id || record?.sourceId);
  const resolvedSourceType = normalizeStockReadModelSourceType(sourceType || record?.sourceType || record?.typeLabel);
  const resolvedSourceCollection = resolveStockReadModelSourceCollection(
    resolvedSourceType,
    sourceCollection || record?.sourceCollection,
  );
  const documentId = buildStockItemReadModelDocumentId({
    sourceType: resolvedSourceType,
    sourceId: resolvedSourceId,
  });

  return {
    id: documentId,
    payload: buildStockItemReadModelPayload(record, {
      ...payloadOptions,
      id: resolvedSourceId,
      sourceId: resolvedSourceId,
      sourceType: resolvedSourceType,
      sourceCollection: resolvedSourceCollection,
      syncedAt,
      lastSyncedFrom,
    }),
  };
};

// =====================================================
// ACTIVE / FOUNDATION - Stock read model service.
// Fungsi:
// - menyediakan kontrak collection stock_item_read_models untuk batch writer/backfill berikutnya;
// - dipanggil oleh writer stok untuk menjaga collection turunan tetap sinkron dengan master stok.
// Guard:
// - Service ini tidak mengganti master stock atau inventory_logs sebagai source of truth.
// - Caller wajib menjalankan sync dalam transaction/batch yang sama ketika mutasi stok utama terjadi.
// =====================================================
export const setStockItemReadModelInTransaction = (transaction, record = {}, options = {}) => {
  if (!transaction) {
    throw new Error("Transaction Firestore wajib tersedia untuk sync stock read model.");
  }

  const { id, payload } = buildStockItemReadModelDocument(record, {
    ...options,
    syncedAt: options.syncedAt || serverTimestamp(),
  });

  transaction.set(doc(db, STOCK_ITEM_READ_MODELS_COLLECTION, id), payload, { merge: true });

  return {
    id,
    ...payload,
  };
};

export const setStockItemReadModelInBatch = (batch, record = {}, options = {}) => {
  if (!batch) {
    throw new Error("Write batch Firestore wajib tersedia untuk sync stock read model.");
  }

  const { id, payload } = buildStockItemReadModelDocument(record, {
    ...options,
    syncedAt: options.syncedAt || serverTimestamp(),
  });

  batch.set(doc(db, STOCK_ITEM_READ_MODELS_COLLECTION, id), payload, { merge: true });

  return {
    id,
    ...payload,
  };
};

export const upsertStockItemReadModel = async (record = {}, options = {}) => {
  if (await shouldUseSqliteStockReadModels()) {
    const payload = toSqliteStockReadModelRecord(buildStockItemReadModelPayload(record, { ...options, syncedAt: new Date().toISOString() }));
    const created = await sqliteStockReadModelsAdapter.createStockReadModel(payload);
    return created || payload;
  }

  const syncedAt = options.syncedAt || Timestamp.now();
  const { id, payload } = buildStockItemReadModelDocument(record, {
    ...options,
    syncedAt,
  });

  await setDoc(doc(db, STOCK_ITEM_READ_MODELS_COLLECTION, id), payload, { merge: true });

  return {
    id,
    ...payload,
  };
};

export const upsertStockItemReadModels = async (records = [], options = {}) => {
  if (await shouldUseSqliteStockReadModels()) {
    const rows = [];
    for (const record of records) {
      rows.push(await upsertStockItemReadModel(record, options));
    }
    return rows;
  }

  const syncedAt = options.syncedAt || Timestamp.now();
  const documents = records.map((record) => buildStockItemReadModelDocument(record, {
    ...options,
    syncedAt,
  }));

  for (let startIndex = 0; startIndex < documents.length; startIndex += STOCK_READ_MODEL_BATCH_LIMIT) {
    const batch = writeBatch(db);
    const batchDocuments = documents.slice(startIndex, startIndex + STOCK_READ_MODEL_BATCH_LIMIT);

    batchDocuments.forEach(({ id, payload }) => {
      batch.set(doc(db, STOCK_ITEM_READ_MODELS_COLLECTION, id), payload, { merge: true });
    });

    await batch.commit();
  }

  return documents.map(({ id, payload }) => ({ id, ...payload }));
};

export const deleteStockItemReadModelInTransaction = (transaction, { sourceType = "", sourceId = "" } = {}) => {
  if (!transaction) {
    throw new Error("Transaction Firestore wajib tersedia untuk delete stock read model.");
  }

  const documentId = buildStockItemReadModelDocumentId({ sourceType, sourceId });
  transaction.delete(doc(db, STOCK_ITEM_READ_MODELS_COLLECTION, documentId));

  return documentId;
};

export const deleteStockItemReadModel = async ({ sourceType = "", sourceId = "" } = {}) => {
  const documentId = buildStockItemReadModelDocumentId({ sourceType, sourceId });
  if (await shouldUseSqliteStockReadModels()) {
    await sqliteStockReadModelsAdapter.deleteStockReadModel(documentId);
    return documentId;
  }
  await deleteDoc(doc(db, STOCK_ITEM_READ_MODELS_COLLECTION, documentId));

  return documentId;
};

export const getStockIssueReadModels = async ({ maxResults = 50, includeMeta = false } = {}) => {
  if (await shouldUseSqliteStockReadModels()) {
    const rows = (await sqliteStockReadModelsAdapter.listStockReadModels({ limit: maxResults }))
      .map(mapStockReadModelDocumentToRow)
      .filter((item) => item.hasStockIssue === true || item.stockStatus === "low" || item.stockStatus === "empty");
    if (!includeMeta) return rows;
    return { rows, meta: { collection: "stock_read_models", maxResults, loadedRows: rows.length, hasMore: false, isLimited: false } };
  }

  const normalizedLimit = Math.max(1, Number(maxResults || 50));
  const queryLimit = includeMeta ? normalizedLimit + 1 : normalizedLimit;
  const stockReadModelQuery = query(
    collection(db, STOCK_ITEM_READ_MODELS_COLLECTION),
    where("hasStockIssue", "==", true),
    orderBy("statusRank", "desc"),
    orderBy("sortGap", "asc"),
    firestoreLimit(queryLimit),
  );
  const snapshot = await getDocs(stockReadModelQuery);
  const hasMore = includeMeta && snapshot.docs.length > normalizedLimit;
  const rows = snapshot.docs
    .slice(0, normalizedLimit)
    .map(toStockReadModelRow);

  if (!includeMeta) return rows;

  return {
    rows,
    meta: {
      collection: STOCK_ITEM_READ_MODELS_COLLECTION,
      query: "stock_issue",
      maxResults: normalizedLimit,
      loadedRows: rows.length,
      hasMore,
      isLimited: hasMore,
    },
  };
};

export const getStockReadModelsBySourceType = async ({ sourceType = "", maxResults = 100 } = {}) => {
  const resolvedSourceType = normalizeStockReadModelSourceType(sourceType);
  if (await shouldUseSqliteStockReadModels()) {
    return (await sqliteStockReadModelsAdapter.listStockReadModels({ sourceType: resolvedSourceType, limit: maxResults })).map(mapStockReadModelDocumentToRow);
  }
  const stockReadModelQuery = query(
    collection(db, STOCK_ITEM_READ_MODELS_COLLECTION),
    where("sourceType", "==", resolvedSourceType),
    orderBy("name", "asc"),
    firestoreLimit(Math.max(1, Number(maxResults || 100))),
  );
  const snapshot = await getDocs(stockReadModelQuery);

  return snapshot.docs.map((documentSnapshot) => ({
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  }));
};


export const getStockReadModelRows = async ({
  maxResults = 1000,
  includeMeta = false,
  cursor = null,
  ordered = false,
} = {}) => {
  if (await shouldUseSqliteStockReadModels()) {
    const rows = (await sqliteStockReadModelsAdapter.listStockReadModels({ limit: maxResults }))
      .map(mapStockReadModelDocumentToRow)
      .sort((left, right) => {
        const sourceCompare = String(left.sourceType || "").localeCompare(String(right.sourceType || ""));
        if (sourceCompare !== 0) return sourceCompare;
        return String(left.name || "").localeCompare(String(right.name || ""));
      });
    if (!includeMeta) return rows;
    return { rows, meta: { collection: "stock_read_models", maxResults, loadedRows: rows.length, hasMore: false, isLimited: false, nextCursor: null, orderBy: ordered || cursor ? ["sourceType", "name"] : [] } };
  }

  const normalizedLimit = Math.max(1, Number(maxResults || 1000));
  const queryLimit = includeMeta ? normalizedLimit + 1 : normalizedLimit;
  const queryConstraints = [];

  // AKTIF / GUARDED: orderBy hanya dipakai saat caller butuh paging cursor.
  // Caller lama tetap memakai query tanpa order agar fallback Dashboard tidak mendadak butuh index baru.
  if (ordered || cursor) {
    queryConstraints.push(orderBy("sourceType", "asc"), orderBy("name", "asc"));
  }

  if (cursor) {
    queryConstraints.push(startAfter(cursor));
  }

  queryConstraints.push(firestoreLimit(queryLimit));

  const stockReadModelQuery = query(
    collection(db, STOCK_ITEM_READ_MODELS_COLLECTION),
    ...queryConstraints,
  );
  const snapshot = await getDocs(stockReadModelQuery);
  const hasMore = includeMeta && snapshot.docs.length > normalizedLimit;
  const visibleDocs = snapshot.docs.slice(0, normalizedLimit);
  const rows = visibleDocs
    .map(toStockReadModelRow)
    .sort((left, right) => {
      const sourceCompare = String(left.sourceType || '').localeCompare(String(right.sourceType || ''));
      if (sourceCompare !== 0) return sourceCompare;
      return String(left.name || '').localeCompare(String(right.name || ''));
    });

  if (!includeMeta) return rows;

  return {
    rows,
    meta: {
      collection: STOCK_ITEM_READ_MODELS_COLLECTION,
      maxResults: normalizedLimit,
      loadedRows: rows.length,
      hasMore,
      isLimited: hasMore,
      nextCursor: hasMore && visibleDocs.length > 0 ? visibleDocs[visibleDocs.length - 1] : null,
      orderBy: ordered || cursor ? ["sourceType", "name"] : [],
    },
  };
};
