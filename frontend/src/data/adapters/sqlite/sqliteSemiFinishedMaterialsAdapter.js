import { createSqliteJsonRecordAdapter } from "./sqliteJsonRecordAdapterFactory";

const toNumber = (value = 0) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

export const normalizeSemiFinishedMaterialRecord = (record = {}) => {
  const currentStock = toNumber(record.currentStock ?? record.stock ?? 0);
  const reservedStock = toNumber(record.reservedStock || 0);
  const variants = Array.isArray(record.variants) ? record.variants : [];
  const hasVariants = record.hasVariants === true || variants.length > 0;

  return {
    ...record,
    code: record.code || record.itemCode || "",
    itemCode: record.itemCode || record.code || "",
    name: record.name || "",
    category: record.category || "Semi Finished",
    type: "semi_finished",
    hasVariants,
    variants,
    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock: toNumber(record.availableStock ?? Math.max(currentStock - reservedStock, 0)),
    minStockAlert: toNumber(record.minStockAlert || record.minStock || 0),
    averageCostPerUnit: toNumber(record.averageCostPerUnit || 0),
    isActive: record.isActive !== false,
    isSellable: false,
  };
};

const adapter = createSqliteJsonRecordAdapter({
  endpoint: "/api/semi-finished-materials",
  normalizeRecord: normalizeSemiFinishedMaterialRecord,
});

export const listSemiFinishedMaterials = adapter.list;
export const getSemiFinishedMaterialById = adapter.getById;
export const generateSemiFinishedMaterialCode = adapter.generateCode;
export const createSemiFinishedMaterial = adapter.create;
export const updateSemiFinishedMaterial = adapter.update;
export const deleteSemiFinishedMaterial = adapter.remove;
export const subscribeSemiFinishedMaterials = adapter.subscribe;
