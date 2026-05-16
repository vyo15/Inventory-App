import { formatNumberId } from '../formatters/numberId';

export const toNumber = (value) => Number(value || 0);

export const calculateAvailableStock = (currentStock, reservedStock) => {
  return Math.max(toNumber(currentStock) - toNumber(reservedStock), 0);
};

export const normalizeStockSnapshot = (item = {}, stockField = 'currentStock') => {
  const currentStock = toNumber(item[stockField] ?? item.stock ?? 0);
  const reservedStock = toNumber(item.reservedStock || 0);
  const availableStock = calculateAvailableStock(currentStock, reservedStock);

  return {
    ...item,
    currentStock,
    reservedStock,
    availableStock,
    stock: currentStock,
  };
};

export const calculateWeightedAverage = (previousQty, previousCost, incomingQty, incomingCost) => {
  const prevQty = toNumber(previousQty);
  const prevCost = toNumber(previousCost);
  const inQty = toNumber(incomingQty);
  const inCost = toNumber(incomingCost);
  const totalQty = prevQty + inQty;

  if (totalQty <= 0) return 0;

  return (prevQty * prevCost + inQty * inCost) / totalQty;
};


const LOW_STOCK_SOURCE_THRESHOLD_FIELDS = {
  material: 'minStock',
  raw_material: 'minStock',
  raw_materials: 'minStock',
  product: 'minStockAlert',
  products: 'minStockAlert',
  semi_finished: 'minStockAlert',
  semi_finished_materials: 'minStockAlert',
};

const resolveLowStockThresholdField = (sourceType = '') =>
  LOW_STOCK_SOURCE_THRESHOLD_FIELDS[String(sourceType || '').toLowerCase()] || 'minStockAlert';

export const resolveMasterLowStockThreshold = (record = {}, sourceType = '') => {
  const primaryField = resolveLowStockThresholdField(sourceType);
  const fallbackField = primaryField === 'minStock' ? 'minStockAlert' : 'minStock';
  const threshold = Number(record?.[primaryField] ?? record?.[fallbackField] ?? 0);

  return Number.isFinite(threshold) && threshold > 0 ? threshold : 0;
};

export const getVariantAvailableStockValue = (variant = {}) => {
  const currentStock = Number(variant?.currentStock ?? variant?.stock ?? 0);
  const reservedStock = Number(variant?.reservedStock || 0);
  const fallbackAvailable = Math.max(currentStock - reservedStock, 0);
  const availableStock = Number(variant?.availableStock ?? fallbackAvailable);

  return Number.isFinite(availableStock) ? Math.max(availableStock, 0) : fallbackAvailable;
};

export const getVariantStockStatusMeta = (variant = {}, threshold = 0) => {
  if (variant?.isActive === false) {
    return { status: 'safe', label: 'Aman', color: 'green', pillClassName: '' };
  }

  const stock = getVariantAvailableStockValue(variant);
  const safeThreshold = Number(threshold || 0);

  if (stock <= 0) {
    return { status: 'empty', label: 'Kosong', color: 'red', pillClassName: 'stock-variant-pill--danger' };
  }

  if (safeThreshold > 0 && stock <= safeThreshold) {
    return { status: 'low', label: 'Stok Rendah', color: 'orange', pillClassName: 'stock-variant-pill--warning' };
  }

  return { status: 'safe', label: 'Aman', color: 'green', pillClassName: '' };
};

export const getLowStockVariantEntries = (
  record = {},
  {
    sourceType = '',
    threshold,
    unit,
    getVariantLabel,
  } = {},
) => {
  const variants = Array.isArray(record?.variants) ? record.variants : [];
  const hasVariants = (record?.hasVariants === true || variants.length > 0) && variants.length > 0;

  if (!hasVariants) return [];

  const resolvedThreshold = Number.isFinite(Number(threshold))
    ? Number(threshold)
    : resolveMasterLowStockThreshold(record, sourceType);
  const resolvedUnit = unit || record?.stockUnit || record?.unit || record?.baseUnit || 'pcs';

  return variants
    .map((variant, index) => {
      const label = typeof getVariantLabel === 'function'
        ? getVariantLabel(variant, index)
        : variant?.variantLabel || variant?.label || variant?.name || variant?.variantName || variant?.color || `Varian ${index + 1}`;
      const stock = getVariantAvailableStockValue(variant);
      const statusMeta = getVariantStockStatusMeta(variant, resolvedThreshold);

      return {
        key: variant?.variantKey || variant?.sku || variant?.color || label || `variant-${index}`,
        label,
        stock,
        unit: resolvedUnit,
        threshold: resolvedThreshold,
        ...statusMeta,
      };
    })
    .filter((item) => item.status !== 'safe');
};

export const getVariantAwareStockStatusMeta = (
  record = {},
  {
    sourceType = '',
    threshold,
  } = {},
) => {
  const affectedVariants = getLowStockVariantEntries(record, { sourceType, threshold });

  if (affectedVariants.length > 0) {
    const hasEmptyVariant = affectedVariants.some((item) => item.status === 'empty');
    return hasEmptyVariant
      ? { color: 'red', label: 'Kosong', alertType: 'error', affectedVariants }
      : { color: 'orange', label: 'Stok Rendah', alertType: 'warning', affectedVariants };
  }

  return null;
};

export const formatAffectedVariantStockSummary = (
  record = {},
  {
    sourceType = '',
    threshold,
    unit,
    getVariantLabel,
    maxItems = 3,
    prefix = 'Perlu restock',
  } = {},
) => {
  const affectedVariants = getLowStockVariantEntries(record, {
    sourceType,
    threshold,
    unit,
    getVariantLabel,
  });

  if (affectedVariants.length === 0) return '';

  const preview = affectedVariants
    .slice(0, maxItems)
    .map((item) => `${item.label} ${formatNumberId(item.stock)} ${item.unit}`)
    .join(', ');
  const remainingCount = affectedVariants.length - maxItems;

  return `${prefix}: ${preview}${remainingCount > 0 ? ` +${formatNumberId(remainingCount)} lainnya` : ''}`;
};
