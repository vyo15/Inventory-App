import {
  COLOR_VARIANT_MAP,
  COLOR_VARIANT_OPTIONS,
  DEFAULT_COLOR_VARIANT,
} from '../../constants/variantOptions';
import {
  calculateAvailableStock,
  toNumber,
} from '../stock/stockHelpers';

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
    .map((item) => {
      const variantName = pickVariantLabel(item, keyField);
      const normalized = {
        [keyField]: variantName,
        [skuField]: String(item?.[skuField] || '').trim().toUpperCase(),
        [stockField]: toNumber(item?.[stockField] || 0),
        isActive: normalizeBoolean(item?.isActive, true),
      };

      if (includeReserved) {
        normalized[reservedField] = toNumber(item?.[reservedField] || 0);
      }

      if (includeMinStock) {
        normalized[minStockField] = toNumber(item?.[minStockField] || 0);
      }

      if (includeAverageCost) {
        normalized[averageCostField] = toNumber(item?.[averageCostField] || 0);
      }

      if (includeLegacyColorAlias) {
        normalized.color = variantName;
      }

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

  const currentStock = normalized.reduce((sum, item) => sum + toNumber(item[stockField]), 0);
  const reservedStock = includeReserved
    ? normalized.reduce((sum, item) => sum + toNumber(item[reservedField]), 0)
    : 0;
  const minStockAlert = includeMinStock
    ? normalized.reduce((sum, item) => sum + toNumber(item[minStockField]), 0)
    : 0;
  const activeVariants = normalized.filter((item) => item.isActive);
  const averageCostPerUnit = includeAverageCost && activeVariants.length > 0
    ? activeVariants.reduce((sum, item) => sum + toNumber(item[averageCostField]), 0) / activeVariants.length
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
  const formatter = new Intl.NumberFormat('id-ID');
  const label = options.label || 'Varian';

  return `${label} ${formatter.format(totals.variantCount)} | Stok ${formatter.format(
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
