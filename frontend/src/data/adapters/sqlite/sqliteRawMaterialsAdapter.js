import { createSqliteJsonRecordAdapter } from "./sqliteJsonRecordAdapterFactory";

const toNumber = (value = 0) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

export const normalizeRawMaterialRecord = (record = {}) => {
  const stock = toNumber(record.currentStock ?? record.stock ?? 0);
  const reservedStock = toNumber(record.reservedStock || 0);
  const hasVariants = record.hasVariants === true
    || record.hasVariantOptions === true
    || (Array.isArray(record.variants) && record.variants.length > 0)
    || (Array.isArray(record.variantOptions) && record.variantOptions.length > 0);
  const variants = Array.isArray(record.variants) ? record.variants : Array.isArray(record.variantOptions) ? record.variantOptions : [];

  return {
    ...record,
    code: record.code || record.materialCode || "",
    materialCode: record.materialCode || record.code || "",
    name: record.name || "",
    hasVariants,
    hasVariantOptions: hasVariants,
    variants,
    variantOptions: variants,
    stock,
    currentStock: stock,
    reservedStock,
    availableStock: toNumber(record.availableStock ?? Math.max(stock - reservedStock, 0)),
    minStock: toNumber(record.minStock || record.minStockAlert || 0),
    stockUnit: record.stockUnit || "pcs",
    isActive: record.isActive !== false,
  };
};

const adapter = createSqliteJsonRecordAdapter({
  endpoint: "/api/raw-materials",
  normalizeRecord: normalizeRawMaterialRecord,
});

export const listRawMaterials = adapter.list;
export const getRawMaterialById = adapter.getById;
export const generateRawMaterialCode = adapter.generateCode;
export const createRawMaterial = adapter.create;
export const updateRawMaterial = adapter.update;
export const deleteRawMaterial = adapter.remove;
export const subscribeRawMaterials = adapter.subscribe;
