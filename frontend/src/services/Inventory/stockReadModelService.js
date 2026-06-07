import * as sqliteStockReadModelsAdapter from "../../data/adapters/sqlite/sqliteStockReadModelsAdapter";

export const STOCK_ITEM_READ_MODELS_COLLECTION = "stock_read_models";
const safeTrim = (value) => String(value || "").trim();
const toNumber = (value) => Number(value || 0);
export const mapStockReadModelDocumentToRow = (readModel = {}) => ({ ...readModel, id: readModel.id || readModel.readModelId || buildStockItemReadModelDocumentId(readModel) });
export const buildStockItemReadModelDocumentId = ({ sourceType = "", sourceId = "" } = {}) => `${safeTrim(sourceType)}__${safeTrim(sourceId)}`;
export const resolveStockReadModelSourceCollection = (sourceType = "", sourceCollection = "") => sourceCollection || (sourceType === "product" ? "products" : sourceType === "semi_finished" ? "semi_finished_materials" : "raw_materials");
export const buildStockItemReadModelDocument = (record = {}, options = {}) => {
  const sourceType = options.sourceType || record.sourceType || "product";
  const sourceId = options.sourceId || record.sourceId || record.id || "";
  const currentStock = toNumber(record.currentStock ?? record.stock ?? 0);
  const reservedStock = toNumber(record.reservedStock ?? 0);
  return {
    ...record,
    id: buildStockItemReadModelDocumentId({ sourceType, sourceId }),
    readModelId: buildStockItemReadModelDocumentId({ sourceType, sourceId }),
    sourceType,
    sourceId,
    sourceCollection: resolveStockReadModelSourceCollection(sourceType, options.sourceCollection || record.sourceCollection),
    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock: toNumber(record.availableStock ?? Math.max(currentStock - reservedStock, 0)),
    minStockAlert: toNumber(record.minStockAlert ?? record.minStock ?? 0),
    syncedAt: new Date().toISOString(),
  };
};
export const setStockItemReadModelInTransaction = () => ({ skipped: true, reason: "SQLite stock read model tidak memakai legacy transaction." });
export const setStockItemReadModelInBatch = () => ({ skipped: true, reason: "SQLite stock read model tidak memakai legacy batch." });
export const upsertStockItemReadModel = async (record = {}, options = {}) => sqliteStockReadModelsAdapter.upsertStockReadModel(buildStockItemReadModelDocument(record, options));
export const upsertStockItemReadModels = async (records = [], options = {}) => Promise.all((records || []).map((record) => upsertStockItemReadModel(record, options)));
export const deleteStockItemReadModelInTransaction = () => ({ skipped: true });
export const deleteStockItemReadModel = async ({ sourceType = "", sourceId = "" } = {}) => sqliteStockReadModelsAdapter.deleteStockReadModel(buildStockItemReadModelDocumentId({ sourceType, sourceId }));
export const getStockReadModelRows = async (options = {}) => sqliteStockReadModelsAdapter.listStockReadModels(options);
export const getStockIssueReadModels = async ({ maxResults = 50, includeMeta = false } = {}) => {
  const rows = await getStockReadModelRows({ limit: maxResults });
  const issues = rows.filter((row) => Number(row.availableStock ?? row.currentStock ?? 0) <= Number(row.minStockAlert || 0));
  return includeMeta ? { rows: issues, meta: { total: issues.length } } : issues;
};
export const getStockReadModelsBySourceType = async ({ sourceType = "", maxResults = 100 } = {}) => (await getStockReadModelRows({ limit: maxResults })).filter((row) => !sourceType || row.sourceType === sourceType);
