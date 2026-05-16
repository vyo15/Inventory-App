export const toNumber = (value) => {
  const numericValue = Number(value || 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

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

// =====================================================
// SECTION: Minimum stock read model — AKTIF / GUARDED
// Fungsi:
// - menyatukan pembacaan minimum stok Product, Raw Material, dan Semi Finished;
// - item non-varian dibandingkan terhadap stok master;
// - item bervarian membandingkan setiap varian aktif terhadap minimum stok master.
// Hubungan flow:
// - read-only untuk Dashboard, master pages, Stock Report, dan display table;
// - tidak menulis stok, tidak mengubah schema, dan tidak memakai variants[].minStockAlert.
// Risiko:
// - jangan pindahkan threshold ke varian tanpa approval schema/business rule karena UI master sengaja hanya punya satu minimum stok.
// =====================================================
export const resolveInventoryMinimumStock = (item = {}, sourceType = '') => {
  const normalizedSourceType = String(sourceType || '').toLowerCase();
  const thresholdSource =
    normalizedSourceType === 'material' || normalizedSourceType === 'raw_material'
      ? item.minStock
      : normalizedSourceType === 'product' || normalizedSourceType === 'semi_finished'
        ? item.minStockAlert
        : item.minStockAlert ?? item.minStock;

  const threshold = toNumber(thresholdSource);
  return threshold > 0 ? threshold : 0;
};

export const resolveInventoryAvailableStock = (item = {}) => {
  if (item?.availableStock !== undefined && item?.availableStock !== null) {
    return toNumber(item.availableStock);
  }

  return calculateAvailableStock(item?.currentStock ?? item?.stock ?? 0, item?.reservedStock ?? 0);
};

export const resolveInventoryCurrentStock = (item = {}) => toNumber(item?.currentStock ?? item?.stock ?? 0);

export const resolveInventoryVariantLabel = (variant = {}, index = 0) =>
  variant.variantLabel ||
  variant.label ||
  variant.name ||
  variant.variantName ||
  variant.color ||
  variant.sku ||
  `Varian ${index + 1}`;

export const getActiveInventoryVariants = (item = {}) => {
  const variants = Array.isArray(item?.variants) ? item.variants : [];
  return variants.filter((variant) => variant && variant.isActive !== false);
};

export const getInventoryVariantStockMeta = (
  variant = {},
  index = 0,
  threshold = 0,
  getVariantLabel = resolveInventoryVariantLabel,
) => {
  const currentStock = resolveInventoryCurrentStock(variant);
  const reservedStock = toNumber(variant?.reservedStock ?? 0);
  const availableStock = resolveInventoryAvailableStock(variant);
  const isInactive = variant?.isActive === false;
  const isEmpty = !isInactive && availableStock <= 0;
  const isLow = !isInactive && !isEmpty && threshold > 0 && availableStock <= threshold;
  const statusKey = isInactive ? 'inactive' : isEmpty ? 'empty' : isLow ? 'low' : 'safe';
  const statusLabel =
    statusKey === 'inactive'
      ? 'Nonaktif'
      : statusKey === 'empty'
        ? 'Kosong'
        : statusKey === 'low'
          ? 'Stok Rendah'
          : 'Aman';

  return {
    variant,
    index,
    label: typeof getVariantLabel === 'function' ? getVariantLabel(variant, index) : resolveInventoryVariantLabel(variant, index),
    currentStock,
    reservedStock,
    availableStock,
    threshold,
    statusKey,
    statusLabel,
    isInactive,
    isEmpty,
    isLow,
  };
};

export const getInventoryVariantStockRows = (item = {}, sourceType = '', getVariantLabel = resolveInventoryVariantLabel) => {
  const threshold = resolveInventoryMinimumStock(item, sourceType);
  return getActiveInventoryVariants(item).map((variant, index) =>
    getInventoryVariantStockMeta(variant, index, threshold, getVariantLabel),
  );
};

export const getInventoryLowStockVariantRows = (item = {}, sourceType = '', getVariantLabel = resolveInventoryVariantLabel) =>
  getInventoryVariantStockRows(item, sourceType, getVariantLabel).filter(
    (variantMeta) => variantMeta.statusKey === 'empty' || variantMeta.statusKey === 'low',
  );

export const getInventoryStockStatusMeta = (item = {}, sourceType = '', options = {}) => {
  const threshold = resolveInventoryMinimumStock(item, sourceType);
  const hasVariants = item?.hasVariants === true || (Array.isArray(item?.variants) && item.variants.length > 0);
  const variantRows = hasVariants
    ? getInventoryVariantStockRows(item, sourceType, options.getVariantLabel)
    : [];
  const affectedVariants = variantRows.filter(
    (variantMeta) => variantMeta.statusKey === 'empty' || variantMeta.statusKey === 'low',
  );
  const emptyVariantCount = affectedVariants.filter((variantMeta) => variantMeta.statusKey === 'empty').length;
  const lowVariantCount = affectedVariants.filter((variantMeta) => variantMeta.statusKey === 'low').length;
  const stock = resolveInventoryAvailableStock(item);

  if (item?.isActive === false) {
    return {
      color: 'default',
      label: options.inactiveLabel || 'Nonaktif',
      alertType: 'info',
      statusKey: 'inactive',
      stock,
      threshold,
      hasVariants,
      affectedVariants: [],
      affectedVariantCount: 0,
      emptyVariantCount: 0,
      lowVariantCount: 0,
    };
  }

  if (hasVariants && variantRows.length > 0) {
    if (emptyVariantCount > 0) {
      return {
        color: 'red',
        label: options.variantEmptyLabel || options.emptyLabel || 'Kosong',
        alertType: 'error',
        statusKey: 'empty',
        stock,
        threshold,
        hasVariants: true,
        affectedVariants,
        affectedVariantCount: affectedVariants.length,
        emptyVariantCount,
        lowVariantCount,
      };
    }

    if (lowVariantCount > 0) {
      return {
        color: 'orange',
        label: options.variantLowLabel || options.lowLabel || 'Stok Rendah',
        alertType: 'warning',
        statusKey: 'low',
        stock,
        threshold,
        hasVariants: true,
        affectedVariants,
        affectedVariantCount: affectedVariants.length,
        emptyVariantCount,
        lowVariantCount,
      };
    }

    return {
      color: 'green',
      label: options.safeLabel || 'Aman',
      alertType: 'success',
      statusKey: 'safe',
      stock,
      threshold,
      hasVariants: true,
      affectedVariants: [],
      affectedVariantCount: 0,
      emptyVariantCount: 0,
      lowVariantCount: 0,
    };
  }

  if (stock <= 0) {
    return {
      color: 'red',
      label: options.emptyLabel || 'Kosong',
      alertType: 'error',
      statusKey: 'empty',
      stock,
      threshold,
      hasVariants: false,
      affectedVariants: [],
      affectedVariantCount: 0,
      emptyVariantCount: 0,
      lowVariantCount: 0,
    };
  }

  if (threshold > 0 && stock <= threshold) {
    return {
      color: 'orange',
      label: options.lowLabel || 'Stok Rendah',
      alertType: 'warning',
      statusKey: 'low',
      stock,
      threshold,
      hasVariants: false,
      affectedVariants: [],
      affectedVariantCount: 0,
      emptyVariantCount: 0,
      lowVariantCount: 0,
    };
  }

  return {
    color: 'green',
    label: options.safeLabel || 'Aman',
    alertType: 'success',
    statusKey: 'safe',
    stock,
    threshold,
    hasVariants: false,
    affectedVariants: [],
    affectedVariantCount: 0,
    emptyVariantCount: 0,
    lowVariantCount: 0,
  };
};
