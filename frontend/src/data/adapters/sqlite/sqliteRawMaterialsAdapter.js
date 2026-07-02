import { toRoundedInteger } from "../../../utils/number/numberNormalization";
import { createSqliteJsonRecordAdapter } from "./sqliteJsonRecordAdapterFactory";
import {
  inferVariantMode,
  resolveVariantSourceList,
} from "../../../utils/variants/variantStockNormalizer";

export const normalizeRawMaterialRecord = (record = {}) => {
  const stock = toRoundedInteger(record.currentStock ?? record.stock ?? 0);
  const reservedStock = toRoundedInteger(record.reservedStock || 0);
  const hasVariants = inferVariantMode(record);
  const variants = resolveVariantSourceList(record);

  return {
    ...record,
    code: record.code || record.materialCode || "",
    materialCode: record.materialCode || record.code || "",
    name: record.name || "",
    category: record.category || record.categoryName || "Belum Dikategorikan",
    categoryName: record.categoryName || record.category || "Belum Dikategorikan",
    hasVariants,
    hasVariantOptions: hasVariants,
    variants,
    variantOptions: variants,
    stock,
    currentStock: stock,
    reservedStock,
    availableStock: toRoundedInteger(record.availableStock ?? Math.max(stock - reservedStock, 0)),
    minStock: toRoundedInteger(record.minStock || record.minStockAlert || 0),
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
