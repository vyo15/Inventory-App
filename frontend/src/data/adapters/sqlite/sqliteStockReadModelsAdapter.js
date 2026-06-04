import { createSqliteJsonRecordAdapter } from "./sqliteJsonRecordAdapterFactory";

const normalizeRecord = (record = {}) => ({
  ...record,
  id: record.id || `${record.sourceType || "stock"}__${record.sourceId || record.code || ""}`,
  sourceType: record.sourceType || "product",
  sourceId: record.sourceId || record.id || "",
  name: record.name || record.itemName || "",
  currentStock: Math.round(Number(record.currentStock ?? record.stock ?? 0)),
  stock: Math.round(Number(record.currentStock ?? record.stock ?? 0)),
  reservedStock: Math.round(Number(record.reservedStock ?? 0)),
  availableStock: Math.round(Number(record.availableStock ?? Math.max(Number(record.currentStock ?? record.stock ?? 0) - Number(record.reservedStock ?? 0), 0))),
});

const adapter = createSqliteJsonRecordAdapter({
  endpoint: "/api/stock-read-models",
  normalizeRecord,
});

export const listStockReadModels = adapter.list;
export const getStockReadModelById = adapter.getById;
export const createStockReadModel = adapter.create;
export const updateStockReadModel = adapter.update;
export const deleteStockReadModel = adapter.remove;
export const subscribeStockReadModels = adapter.subscribe;

export const upsertStockReadModel = async (record = {}) => {
  const id = record.id || `${record.sourceType || "stock"}__${record.sourceId || ""}`;
  if (!id || id.endsWith("__")) {
    return createStockReadModel(record);
  }

  try {
    const existing = await getStockReadModelById(id);
    if (existing?.id) {
      return updateStockReadModel(id, { ...existing, ...record, id });
    }
  } catch (error) {
    if (!String(error?.message || "").includes("404")) {
      // API client may throw generic messages; create fallback remains safe for missing rows.
    }
  }

  return createStockReadModel({ ...record, id });
};
