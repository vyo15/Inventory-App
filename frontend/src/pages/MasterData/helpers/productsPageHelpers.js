import { PRODUCT_DEFAULT_FORM } from '../../../services/MasterData/productsService';
import { formatStockWithUnitId } from '../../../utils/formatters/stockUnit';
import { getVariantAwareStockStatusMeta, hasSafeZeroStockSnapshot } from '../../../utils/stock/stockHelpers';
import {
  COLOR_VARIANT_MAP,
  ensureAtLeastOneVariant,
} from '../../../utils/variants/variantHelpers';
import { getMasterStockSummary } from '../../../utils/variants/variantStockNormalizer';

export const buildFormValues = (record = {}) => {
  const hasVariants = record?.hasVariants === true || (record?.variants || []).length > 0;

  return {
    ...PRODUCT_DEFAULT_FORM,
    ...record,
    hasVariants,
    variantLabel: record.variantLabel || 'Varian',
    variants: hasVariants ? ensureAtLeastOneVariant(record.variants || []) : [],
    currentStock: Number(record.currentStock || record.stock || 0),
    reservedStock: Number(record.reservedStock || 0),
    minStockAlert: Number(record.minStockAlert || 0),
  };
};

export const formatStockWithUnit = formatStockWithUnitId;

export const getRuleModeLabel = (mode, ruleId, pricingRuleMap = {}) => {
  if (mode !== 'rule') return 'Manual';
  return `Pricing Rule${pricingRuleMap[ruleId] ? ` | ${pricingRuleMap[ruleId]}` : ''}`;
};

export const DEFAULT_PRODUCT_VARIANT = {
  color: '',
  sku: '',
  currentStock: 0,
  reservedStock: 0,
  averageCostPerUnit: 0,
  isActive: true,
};

export const getVariantDisplayLabel = (variant = {}, index = 0) => (
  variant.variantLabel
  || variant.label
  || variant.name
  || COLOR_VARIANT_MAP[variant.color]
  || variant.color
  || `Varian ${index + 1}`
);

export const hasSafeZeroMasterStock = hasSafeZeroStockSnapshot;

export const compactCellClassNames = {
  stack: 'ims-cell-stack ims-cell-stack-tight',
  meta: 'ims-cell-meta',
};

export const getProductStockSummary = getMasterStockSummary;

export const getProductStatusMeta = (record = {}) => {
  const availableStock = Number(record.availableStock ?? record.currentStock ?? record.stock ?? 0);
  const minStockAlert = Number(record.minStockAlert || 0);

  if (record.isActive === false) {
    return { color: 'default', label: 'Nonaktif' };
  }

  const variantStatusMeta = getVariantAwareStockStatusMeta(record, {
    sourceType: 'product',
    threshold: minStockAlert,
  });

  if (variantStatusMeta) return variantStatusMeta;

  if (availableStock <= 0) {
    return { color: 'red', label: 'Kosong' };
  }

  if (minStockAlert > 0 && availableStock <= minStockAlert) {
    return { color: 'orange', label: 'Stok Rendah' };
  }

  return { color: 'green', label: 'Aman' };
};
