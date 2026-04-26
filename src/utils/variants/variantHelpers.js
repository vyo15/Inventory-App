import {
  COLOR_VARIANT_MAP,
  COLOR_VARIANT_OPTIONS,
  DEFAULT_COLOR_VARIANT,
} from '../../constants/variantOptions';
import {
  calculateVariantAvailableStock,
  calculateVariantStockTotals,
  normalizeNumberStock,
  normalizeVariantStockShape,
} from './variantStockNormalizer';
import formatNumber from '../formatters/numberId';

const normalizeBoolean = (value, defaultValue = true) =>
  value === undefined || value === null ? defaultValue : value !== false;

const pickVariantLabel = (item = {}, keyField = 'name') => {
  const directValue = String(item?.[keyField] || '').trim();
  if (directValue) return directValue;

  const legacyColorValue = String(item?.color || '').trim().toLowerCase();
  if (legacyColorValue) return legacyColorValue;

  return '';
};

export const normalizeVariants = (variants = [], options = {}) => {
  if (!Array.isArray(variants)) return [];

  const {
    keyField = 'name',
    stockField = 'currentStock',
    reservedField = 'reservedStock',
    minStockField = 'minStockAlert',
    averageCostField = 'averageCostPerUnit',
    skuField = 'sku',
    includeReserved = true,
    includeMinStock = true,
    includeAverageCost = true,
    includeLegacyColorAlias = true,
  } = options;

  return variants
    .map((item, index) => {
      const variantName = pickVariantLabel(item, keyField);
      const baseVariant = {
        ...item,
        [keyField]: variantName,
        [skuField]: String(item?.[skuField] || '').trim().toUpperCase(),
        currentStock: item?.[stockField] ?? item?.currentStock ?? item?.stock ?? 0,
        reservedStock: item?.[reservedField] ?? item?.reservedStock ?? 0,
        variantLabel: item?.variantLabel || item?.label || variantName,
        isActive: normalizeBoolean(item?.isActive, true),
      };

      // ACTIVE: helper product/semi finished tetap mempertahankan field UI lama
      // seperti color/name/code, tetapi stok final diserahkan ke normalizer pusat
      // agar variant.stock selalu sama dengan variant.currentStock.
      const normalizedStock = normalizeVariantStockShape(baseVariant, {
        fallbackIndex: index,
        currentStockField: 'currentStock',
        reservedStockField: 'reservedStock',
        keyFields: ['variantKey', skuField, keyField, 'color', 'name', 'code'],
        labelFields: ['variantLabel', 'label', keyField, 'color', 'name', skuField, 'code'],
      });

      const normalized = {
        ...normalizedStock,
        [keyField]: variantName,
        [skuField]: String(item?.[skuField] || '').trim().toUpperCase(),
        [stockField]: normalizedStock.currentStock,
        stock: normalizedStock.currentStock,
        isActive: normalizeBoolean(item?.isActive, true),
      };

      if (includeReserved) {
        normalized[reservedField] = normalizedStock.reservedStock;
      }

      if (includeMinStock) {
        normalized[minStockField] = normalizeNumberStock(item?.[minStockField] || 0);
      }

      if (includeAverageCost) {
        normalized[averageCostField] = normalizeNumberStock(item?.[averageCostField] || 0);
      }

      if (includeLegacyColorAlias) {
        normalized.color = variantName;
      }

      normalized.availableStock = calculateVariantAvailableStock(
        normalizedStock.currentStock,
        normalizedStock.reservedStock,
      );

      return normalized;
    })
    .filter((item) => String(item?.[keyField] || '').trim());
};

export const normalizeColorVariants = (variants = [], options = {}) =>
  normalizeVariants(variants, {
    keyField: 'color',
    includeReserved: true,
    includeMinStock: true,
    includeAverageCost: true,
    includeLegacyColorAlias: true,
    ...options,
  }).map((item) => ({
    ...item,
    color: String(item.color || '').trim().toLowerCase(),
  }));

export const ensureAtLeastOneVariant = (variants = [], options = {}) => {
  const normalized = normalizeVariants(variants, options);
  const defaultVariant = options.defaultVariant || { ...DEFAULT_COLOR_VARIANT };
  return normalized.length > 0 ? normalized : [defaultVariant];
};

export const calculateVariantTotals = (variants = [], options = {}) => {
  const {
    keyField = 'name',
    stockField = 'currentStock',
    reservedField = 'reservedStock',
    minStockField = 'minStockAlert',
    averageCostField = 'averageCostPerUnit',
    includeReserved = true,
    includeMinStock = true,
    includeAverageCost = true,
  } = options;

  const normalized = normalizeVariants(variants, {
    keyField,
    stockField,
    reservedField,
    minStockField,
    averageCostField,
    includeReserved,
    includeMinStock,
    includeAverageCost,
    includeLegacyColorAlias: true,
  });

  // ACTIVE: total produk/semi memakai helper pusat supaya master stock/currentStock
  // mengikuti total varian yang sudah dinormalisasi.
  const stockTotals = calculateVariantStockTotals(normalized, {
    keyFields: ['variantKey', keyField, 'color', 'name', 'sku', 'code'],
    labelFields: ['variantLabel', 'label', keyField, 'color', 'name', 'sku', 'code'],
  });
  const currentStock = stockTotals.currentStock;
  const reservedStock = includeReserved ? stockTotals.reservedStock : 0;
  const minStockAlert = includeMinStock
    ? normalized.reduce((sum, item) => sum + normalizeNumberStock(item[minStockField]), 0)
    : 0;
  const activeVariants = normalized.filter((item) => item.isActive);
  const averageCostPerUnit = includeAverageCost && activeVariants.length > 0
    ? activeVariants.reduce((sum, item) => sum + normalizeNumberStock(item[averageCostField]), 0) / activeVariants.length
    : 0;

  return {
    variants: normalized,
    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock: calculateVariantAvailableStock(currentStock, reservedStock),
    minStockAlert,
    averageCostPerUnit,
    variantCount: normalized.length,
    activeVariantCount: activeVariants.length,
  };
};

export const validateDuplicateVariantValues = (variants = [], options = {}) => {
  const { keyField = 'name', duplicateMessage = 'Varian tidak boleh duplikat' } = options;
  const errors = {};
  const seen = new Set();

  normalizeVariants(variants, { keyField }).forEach((item, index) => {
    const keyValue = String(item?.[keyField] || '').trim().toLowerCase();
    if (seen.has(keyValue)) {
      errors[`variants.${index}.${keyField}`] = duplicateMessage;
    }
    seen.add(keyValue);
  });

  return errors;
};

export const validateDuplicateVariantColors = (variants = []) =>
  validateDuplicateVariantValues(variants, {
    keyField: 'color',
    duplicateMessage: 'Warna tidak boleh duplikat',
  });

export const formatVariantSummary = (item = {}, options = {}) => {
  const totals = calculateVariantTotals(item.variants || [], options);
  // ACTIVE / FINAL: ringkasan varian memakai formatter shared agar stok tidak
  // kembali memakai formatter lokal/manual.
  const label = options.label || 'Varian';

  return `${label} ${formatNumber(totals.variantCount)} | Stok ${formatNumber(
    totals.currentStock,
  )} | Tersedia ${formatNumber(totals.availableStock)}`;
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
