import { toRoundedInteger } from "../../../utils/number/numberNormalization";
import {
  inferVariantMode,
  resolveVariantSourceList,
} from "../../../utils/variants/variantStockNormalizer";
import { createSqliteJsonRecordAdapter } from "./sqliteJsonRecordAdapterFactory";

export const normalizeProductRecord = (record = {}) => {
  const currentStock = toRoundedInteger(record.currentStock ?? record.stock ?? 0);
  const reservedStock = toRoundedInteger(record.reservedStock || 0);
  const minStockAlert = toRoundedInteger(record.minStockAlert || 0);
  const variants = resolveVariantSourceList(record);
  return {
    ...record,
    code: record.code || record.productCode || "",
    productCode: record.productCode || record.code || "",
    name: record.name || "",
    category: record.category || record.categoryName || "Belum Dikategorikan",
    categoryName: record.categoryName || record.category || "Belum Dikategorikan",
    flowerType: record.flowerType || record.flowerTypeName || record.flowerGroup || "",
    flowerTypeName: record.flowerTypeName || record.flowerType || record.flowerGroup || "",
    hasVariants: inferVariantMode(record),
    variants,
    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock: toRoundedInteger(record.availableStock ?? Math.max(currentStock - reservedStock, 0)),
    minStockAlert,
    isActive: record.isActive !== false,
  };
};

const adapter = createSqliteJsonRecordAdapter({
  endpoint: "/api/products",
  normalizeRecord: normalizeProductRecord,
});

export const listProducts = adapter.list;
export const getProductById = adapter.getById;
export const generateProductCode = adapter.generateCode;
export const createProduct = adapter.create;
export const updateProduct = adapter.update;
export const deleteProduct = adapter.remove;
export const subscribeProducts = adapter.subscribe;
