import { calculateAvailableStock, toNumber } from '../stock/stockHelpers';

const safeTrim = (value) => String(value || '').trim();

export const getVariantKey = (variant = {}) =>
  safeTrim(
    variant.variantKey ||
      variant.id ||
      variant.variantId ||
      variant.name ||
      variant.color ||
      variant.code ||
      variant.sku,
  ).toLowerCase();

export const getVariantLabel = (variant = {}) =>
  safeTrim(
    variant.variantLabel ||
      variant.name ||
      variant.color ||
      variant.code ||
      variant.sku ||
      variant.id,
  );

export const inferHasVariants = (item = {}) =>
  item?.hasVariants === true ||
  (Array.isArray(item?.variants) && item.variants.length > 0);

export const normalizeItemVariants = (item = {}) => {
  if (!Array.isArray(item?.variants)) return [];

  return item.variants
    .map((variant, index) => {
      const variantKey = getVariantKey(variant) || `variant-${index}`;
      const variantLabel = getVariantLabel(variant) || variantKey;

      return {
        ...variant,
        variantKey,
        variantLabel,
        currentStock: toNumber(variant.currentStock || 0),
        reservedStock: toNumber(variant.reservedStock || 0),
        availableStock: calculateAvailableStock(
          toNumber(variant.currentStock || 0),
          toNumber(variant.reservedStock || 0),
        ),
        isActive: variant?.isActive !== false,
      };
    })
    .filter((variant) => safeTrim(variant.variantLabel));
};

export const buildVariantOptionsFromItem = (item = {}) =>
  normalizeItemVariants(item)
    .filter((variant) => variant.isActive !== false)
    .map((variant) => ({
      value: variant.variantKey,
      label: variant.variantLabel,
      raw: variant,
    }));

export const findVariantByKey = (item = {}, variantKey = '') => {
  const normalizedKey = safeTrim(variantKey).toLowerCase();
  if (!normalizedKey) return null;

  return (
    normalizeItemVariants(item).find(
      (variant) => safeTrim(variant.variantKey).toLowerCase() === normalizedKey,
    ) || null
  );
};

export const getItemStockSnapshot = (item = {}) => {
  const currentStock = toNumber(item.currentStock ?? item.stock ?? 0);
  const reservedStock = toNumber(item.reservedStock || 0);

  return {
    currentStock,
    reservedStock,
    availableStock: calculateAvailableStock(currentStock, reservedStock),
  };
};

export const resolveVariantSelection = ({
  item = {},
  materialVariantStrategy = 'none',
  targetVariantKey = '',
  fixedVariantKey = '',
} = {}) => {
  const hasVariants = inferHasVariants(item);
  const normalizedStrategy = hasVariants
    ? materialVariantStrategy || 'inherit'
    : 'none';

  // =====================================================
  // Active flow helper:
  // - Jika item tidak punya varian, stok selalu dibaca dari master.
  // - Jika item punya tepat 1 varian aktif dan tidak ada key yang dikirim,
  //   fallback otomatis ke varian tunggal itu supaya BOM -> PO -> Work Log
  //   tetap nyambung tanpa user memilih varian manual lagi.
  // =====================================================
  if (!hasVariants || normalizedStrategy === 'none') {
    const stock = getItemStockSnapshot(item);
    return {
      stockSourceType: 'master',
      materialHasVariants: hasVariants,
      materialVariantStrategy: 'none',
      resolvedVariantKey: '',
      resolvedVariantLabel: '',
      ...stock,
    };
  }

  const candidateKey =
    normalizedStrategy === 'fixed' ? fixedVariantKey : targetVariantKey;

  const activeVariants = buildVariantOptionsFromItem(item);
  const singleActiveVariant = activeVariants.length === 1 ? activeVariants[0]?.raw || null : null;
  const selectedVariant =
    findVariantByKey(item, candidateKey) ||
    (!safeTrim(candidateKey) && singleActiveVariant ? singleActiveVariant : null);

  if (!selectedVariant) {
    const stock = getItemStockSnapshot(item);
    return {
      stockSourceType: 'master',
      materialHasVariants: hasVariants,
      materialVariantStrategy: normalizedStrategy,
      resolvedVariantKey: '',
      resolvedVariantLabel: '',
      resolutionFallback: 'master',
      ...stock,
    };
  }

  return {
    stockSourceType: 'variant',
    materialHasVariants: true,
    materialVariantStrategy: normalizedStrategy,
    resolvedVariantKey: selectedVariant.variantKey,
    resolvedVariantLabel: selectedVariant.variantLabel,
    currentStock: toNumber(selectedVariant.currentStock || 0),
    reservedStock: toNumber(selectedVariant.reservedStock || 0),
    availableStock: calculateAvailableStock(
      toNumber(selectedVariant.currentStock || 0),
      toNumber(selectedVariant.reservedStock || 0),
    ),
  };
};

export const applyStockMutationToItem = ({
  item = {},
  variantKey = '',
  deltaCurrent = 0,
  deltaReserved = 0,
} = {}) => {
  const currentDelta = toNumber(deltaCurrent || 0);
  const reservedDelta = toNumber(deltaReserved || 0);
  const hasVariants = inferHasVariants(item);
  const normalizedVariantKey = safeTrim(variantKey).toLowerCase();

  if (hasVariants && normalizedVariantKey) {
    const variants = normalizeItemVariants(item).map((variant) => {
      if (safeTrim(variant.variantKey).toLowerCase() !== normalizedVariantKey) {
        return variant;
      }

      const nextCurrentStock = toNumber(variant.currentStock || 0) + currentDelta;
      const nextReservedStock = Math.max(
        toNumber(variant.reservedStock || 0) + reservedDelta,
        0,
      );

      return {
        ...variant,
        currentStock: nextCurrentStock,
        reservedStock: nextReservedStock,
        availableStock: calculateAvailableStock(nextCurrentStock, nextReservedStock),
      };
    });

    const totalCurrentStock = variants.reduce(
      (sum, variant) => sum + toNumber(variant.currentStock || 0),
      0,
    );
    const totalReservedStock = variants.reduce(
      (sum, variant) => sum + toNumber(variant.reservedStock || 0),
      0,
    );

    return {
      variants,
      currentStock: totalCurrentStock,
      reservedStock: totalReservedStock,
      availableStock: calculateAvailableStock(totalCurrentStock, totalReservedStock),
      stock: totalCurrentStock,
    };
  }

  const stock = getItemStockSnapshot(item);
  const nextCurrentStock = stock.currentStock + currentDelta;
  const nextReservedStock = Math.max(stock.reservedStock + reservedDelta, 0);

  return {
    currentStock: nextCurrentStock,
    reservedStock: nextReservedStock,
    availableStock: calculateAvailableStock(nextCurrentStock, nextReservedStock),
    stock: nextCurrentStock,
  };
};
