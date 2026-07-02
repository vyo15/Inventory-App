import { createSqliteJsonRecordAdapter } from "./sqliteJsonRecordAdapterFactory";
import { toRoundedInteger } from "../../../utils/number/numberNormalization";
import {
  inferVariantMode,
  resolveVariantSourceList,
} from "../../../utils/variants/variantStockNormalizer";

export const normalizeStockReadModelRecord = (record = {}) => {
  const variants = resolveVariantSourceList(record);
  return {
    ...record,
    id: record.id || `${record.sourceType || "stock"}__${record.sourceId || record.code || ""}`,
    sourceType: record.sourceType || "product",
    sourceId: record.sourceId || record.id || "",
    name: record.name || record.itemName || "",
    currentStock: toRoundedInteger(record.currentStock ?? record.stock),
    stock: toRoundedInteger(record.currentStock ?? record.stock),
    reservedStock: toRoundedInteger(record.reservedStock),
    availableStock: toRoundedInteger(
      record.availableStock
      ?? Math.max(
        toRoundedInteger(record.currentStock ?? record.stock) - toRoundedInteger(record.reservedStock),
        0,
      ),
    ),
    hasVariants: inferVariantMode(record),
    variants,
  };
};

const adapter = createSqliteJsonRecordAdapter({
  endpoint: "/api/stock-read-models",
  normalizeRecord: normalizeStockReadModelRecord,
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
