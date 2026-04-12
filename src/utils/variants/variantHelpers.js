import {
  COLOR_VARIANT_MAP,
  COLOR_VARIANT_OPTIONS,
  DEFAULT_COLOR_VARIANT,
} from '../../constants/variantOptions';
import {
  calculateAvailableStock,
  toNumber,
} from '../stock/stockHelpers';

export const normalizeColorVariants = (variants = []) => {
  if (!Array.isArray(variants)) return [];

  return variants
    .map((item) => ({
      color: String(item?.color || '').trim().toLowerCase(),
      sku: String(item?.sku || '').trim().toUpperCase(),
      currentStock: toNumber(item?.currentStock || 0),
      reservedStock: toNumber(item?.reservedStock || 0),
      minStockAlert: toNumber(item?.minStockAlert || 0),
      averageCostPerUnit: toNumber(item?.averageCostPerUnit || 0),
      isActive: item?.isActive !== false,
    }))
    .filter((item) => item.color);
};

export const ensureAtLeastOneVariant = (variants = []) => {
  const normalized = normalizeColorVariants(variants);
  return normalized.length > 0 ? normalized : [{ ...DEFAULT_COLOR_VARIANT }];
};

export const calculateVariantTotals = (variants = []) => {
  const normalized = normalizeColorVariants(variants);
  const currentStock = normalized.reduce((sum, item) => sum + toNumber(item.currentStock), 0);
  const reservedStock = normalized.reduce((sum, item) => sum + toNumber(item.reservedStock), 0);
  const minStockAlert = normalized.reduce((sum, item) => sum + toNumber(item.minStockAlert), 0);
  const activeVariants = normalized.filter((item) => item.isActive);
  const averageCostPerUnit =
    activeVariants.length > 0
      ? activeVariants.reduce((sum, item) => sum + toNumber(item.averageCostPerUnit), 0) / activeVariants.length
      : 0;

  return {
    variants: normalized,
    currentStock,
    reservedStock,
    availableStock: calculateAvailableStock(currentStock, reservedStock),
    minStockAlert,
    averageCostPerUnit,
    variantCount: normalized.length,
    activeVariantCount: activeVariants.length,
  };
};

export const validateDuplicateVariantColors = (variants = []) => {
  const errors = {};
  const seen = new Set();

  normalizeColorVariants(variants).forEach((item, index) => {
    if (seen.has(item.color)) {
      errors[`variants.${index}.color`] = 'Warna tidak boleh duplikat';
    }
    seen.add(item.color);
  });

  return errors;
};

export const formatVariantSummary = (item = {}) => {
  const totals = calculateVariantTotals(item.variants || []);
  const formatter = new Intl.NumberFormat('id-ID');

  return `Varian ${formatter.format(totals.variantCount)} | Stok ${formatter.format(
    totals.currentStock,
  )} | Tersedia ${formatter.format(totals.availableStock)}`;
};

export const buildColorTagList = (variants = []) =>
  normalizeColorVariants(variants).map((item) => ({
    key: item.color,
    color: item.color,
    label: COLOR_VARIANT_MAP[item.color] || item.color,
  }));

export {
  COLOR_VARIANT_OPTIONS,
  COLOR_VARIANT_MAP,
  DEFAULT_COLOR_VARIANT,
};
