import { normalizeTruthyText as safeTrim } from "../../utils/text/textNormalization";
import { toFiniteNumber } from "../../utils/number/numberNormalization";
import * as sqliteStockReadModelsAdapter from "../../data/adapters/sqlite/sqliteStockReadModelsAdapter";
import { getLowStockVariantEntries, resolveVariantMinimumStockTotal } from "../../utils/stock/stockHelpers";

export const STOCK_ITEM_READ_MODELS_COLLECTION = "stock_read_models";

export const buildStockItemReadModelDocumentId = ({
  sourceType = "",
  sourceId = "",
} = {}) => `${safeTrim(sourceType)}__${safeTrim(sourceId)}`;

export const mapStockReadModelDocumentToRow = (readModel = {}) => ({
  ...readModel,
  id: readModel.id || readModel.readModelId || buildStockItemReadModelDocumentId(readModel),
});

export const resolveStockReadModelSourceCollection = (
  sourceType = "",
  sourceCollection = ""
) => sourceCollection || (
  sourceType === "product"
    ? "products"
    : sourceType === "semi_finished"
      ? "semi_finished_materials"
      : "raw_materials"
);

export const buildStockItemReadModelDocument = (record = {}, options = {}) => {
  const sourceType = options.sourceType || record.sourceType || "product";
  const sourceId = options.sourceId || record.sourceId || record.id || "";
  const currentStock = toFiniteNumber(record.currentStock ?? record.stock ?? 0);
  const reservedStock = toFiniteNumber(record.reservedStock ?? 0);

  const usesVariantMinimumStock = sourceType === "raw_material"
    && record.hasVariants === true
    && Array.isArray(record.variants)
    && record.variants.length > 0;
  const minStockAlert = usesVariantMinimumStock
    ? resolveVariantMinimumStockTotal(record, 0)
    : toFiniteNumber(record.minStockAlert ?? record.minStock ?? 0);

  return {
    ...record,
    id: buildStockItemReadModelDocumentId({ sourceType, sourceId }),
    readModelId: buildStockItemReadModelDocumentId({ sourceType, sourceId }),
    sourceType,
    sourceId,
    sourceCollection: resolveStockReadModelSourceCollection(
      sourceType,
      options.sourceCollection || record.sourceCollection
    ),
    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock: toFiniteNumber(record.availableStock ?? Math.max(currentStock - reservedStock, 0)),
    minStockAlert,
    minimumStockMode: usesVariantMinimumStock ? "variant" : "master",
    syncedAt: new Date().toISOString(),
  };
};

export const setStockItemReadModelInTransaction = () => ({
  skipped: true,
  reason: "Data stok lokal tidak memakai transaksi lama.",
});

export const setStockItemReadModelInBatch = () => ({
  skipped: true,
  reason: "Data stok lokal tidak memakai batch lama.",
});

export const upsertStockItemReadModel = async (record = {}, options = {}) => sqliteStockReadModelsAdapter
  .upsertStockReadModel(buildStockItemReadModelDocument(record, options));

export const upsertStockItemReadModels = async (records = [], options = {}) => Promise.all(
  (records || []).map((record) => upsertStockItemReadModel(record, options))
);

export const deleteStockItemReadModelInTransaction = () => ({ skipped: true });

export const deleteStockItemReadModel = async ({
  sourceType = "",
  sourceId = "",
} = {}) => sqliteStockReadModelsAdapter.deleteStockReadModel(
  buildStockItemReadModelDocumentId({ sourceType, sourceId })
);

export const getStockReadModelRows = async (options = {}) => sqliteStockReadModelsAdapter
  .listStockReadModels(options);

export const getStockIssueReadModels = async ({ maxResults = 50, includeMeta = false } = {}) => {
  const rows = await getStockReadModelRows({ limit: maxResults });
  const issues = rows.filter((row) => {
    if (row.minimumStockMode === "variant" || (row.sourceType === "raw_material" && row.hasVariants === true)) {
      return getLowStockVariantEntries(row, { sourceType: "material", threshold: undefined }).length > 0;
    }
    return Number(row.availableStock ?? row.currentStock ?? 0) <= Number(row.minStockAlert || 0);
  });
  return includeMeta ? { rows: issues, meta: { total: issues.length } } : issues;
};

export const getStockReadModelsBySourceType = async ({
  sourceType = "",
  maxResults = 100,
} = {}) => {
  const rows = await getStockReadModelRows({ limit: maxResults });
  return rows.filter((row) => !sourceType || row.sourceType === sourceType);
};
