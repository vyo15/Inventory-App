import {
  inferVariantMode,
  resolveVariantSourceList,
} from "../../../utils/variants/variantStockNormalizer";
import { createSqliteJsonRecordAdapter } from "./sqliteJsonRecordAdapterFactory";

const toNumber = (value = 0) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

export const normalizeSemiFinishedMaterialRecord = (record = {}) => {
  const currentStock = toNumber(record.currentStock ?? record.stock ?? 0);
  const reservedStock = toNumber(record.reservedStock || 0);
  const variants = resolveVariantSourceList(record);
  const hasVariants = inferVariantMode(record);

  return {
    ...record,
    code: record.code || record.itemCode || "",
    itemCode: record.itemCode || record.code || "",
    name: record.name || "",
    // `category` tetap Jenis Komponen produksi yang dipakai recipe/HPP existing.
    category: record.category || 'lainnya',
    categoryId: record.categoryId || '',
    componentGroup: record.componentGroup || record.componentGroupName || '',
    componentGroupName: record.componentGroupName || record.componentGroup || '',
    flowerTypeId: record.flowerTypeId || '',
    flowerType: record.flowerType || record.flowerTypeName || record.flowerGroup || '',
    flowerTypeName: record.flowerTypeName || record.flowerType || record.flowerGroup || '',
    flowerGroup: record.flowerGroup || record.flowerType || record.flowerTypeName || '',
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
