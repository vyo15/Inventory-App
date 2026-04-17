import { calculateAvailableStock, toNumber } from '../stock/stockHelpers';

export const DEFAULT_RAW_MATERIAL_VARIANT = {
  name: '',
  sku: '',
  currentStock: 0,
  reservedStock: 0,
  isActive: true,
};

const safeTrim = (value) => String(value || '').trim();
const toVariantKey = (value) => safeTrim(value).toLowerCase();

export const normalizeRawMaterialVariants = (variants = []) => {
  if (!Array.isArray(variants)) return [];

  return variants
    .map((item, index) => {
      const variantName = safeTrim(item?.variantName || item?.name);
      const variantCode = safeTrim(item?.variantCode || item?.sku).toUpperCase();
      const variantKey =
        toVariantKey(item?.variantKey) ||
        toVariantKey(variantCode) ||
        toVariantKey(variantName) ||
        `variant-${index}`;

      return {
        name: variantName,
        sku: variantCode,
        currentStock: toNumber(item?.currentStock || 0),
        reservedStock: toNumber(item?.reservedStock || 0),
        isActive: item?.isActive !== false,
        variantName,
        variantCode,
        variantKey,
      };
    })
    .filter((item) => item.name);
};

export const ensureAtLeastOneRawMaterialVariant = (variants = []) => {
  const normalized = normalizeRawMaterialVariants(variants);
  return normalized.length > 0 ? normalized : [{ ...DEFAULT_RAW_MATERIAL_VARIANT }];
};

export const calculateRawMaterialVariantTotals = (variants = []) => {
  const normalized = normalizeRawMaterialVariants(variants);
  const activeVariants = normalized.filter((item) => item.isActive !== false);

  const currentStock = normalized.reduce((sum, item) => sum + toNumber(item.currentStock), 0);
  const reservedStock = normalized.reduce((sum, item) => sum + toNumber(item.reservedStock), 0);

  return {
    variants: normalized,
    currentStock,
    reservedStock,
    availableStock: calculateAvailableStock(currentStock, reservedStock),
    variantCount: normalized.length,
    activeVariantCount: activeVariants.length,
  };
};

export const buildRawMaterialVariantSummary = (item = {}) => {
  const totals = calculateRawMaterialVariantTotals(item.variants || item.variantOptions || []);

  return {
    variantCount: totals.variantCount,
    activeVariantCount: totals.activeVariantCount,
    currentStock: totals.currentStock,
    availableStock: totals.availableStock,
  };
};

export const normalizeRawMaterialVariantReferences = (variants = []) =>
  normalizeRawMaterialVariants(variants).map((variant, index) => ({
    ...variant,
    variantName: variant.variantName || variant.name,
    variantCode: variant.variantCode || variant.sku,
    variantKey: variant.variantKey || toVariantKey(variant.variantCode || variant.variantName) || `variant-${index}`,
    label: variant.variantName || variant.name,
    value: variant.variantKey || toVariantKey(variant.variantCode || variant.variantName) || `variant-${index}`,
  }));

export const enrichRawMaterialWithVariantTotals = (item = {}) => {
  const hasVariants = item?.hasVariants === true || item?.hasVariantOptions === true;
  const totals = calculateRawMaterialVariantTotals(item.variants || item.variantOptions || []);

  if (!hasVariants) {
    const currentStock = toNumber(item?.currentStock ?? item?.stock ?? 0);
    const reservedStock = toNumber(item?.reservedStock || 0);

    return {
      ...item,
      hasVariants: false,
      hasVariantOptions: false,
      variants: [],
      variantOptions: [],
      variantCount: 0,
      activeVariantCount: 0,
      currentStock,
      stock: currentStock,
      reservedStock,
      availableStock: calculateAvailableStock(currentStock, reservedStock),
    };
  }

  return {
    ...item,
    hasVariants: true,
    hasVariantOptions: true,
    variantLabel: safeTrim(item?.variantLabel) || 'Varian',
    variants: totals.variants,
    variantOptions: totals.variants,
    variantCount: totals.variantCount,
    activeVariantCount: totals.activeVariantCount,
    currentStock: totals.currentStock,
    stock: totals.currentStock,
    reservedStock: totals.reservedStock,
    availableStock: totals.availableStock,
  };
};

export const applyPurchaseToRawMaterial = (
  material = {},
  { qty = 0, unitCost = 0, variantKey = '', variantName = '', variantCode = '' } = {},
) => {
  const normalizedQty = toNumber(qty);
  const normalizedCost = toNumber(unitCost);
  const currentAverage = toNumber(material?.averageActualUnitCost || 0);

  if (material?.hasVariants === true || material?.hasVariantOptions === true) {
    const variants = normalizeRawMaterialVariants(material.variants || material.variantOptions || []);
    const targetKey = toVariantKey(variantKey || variantCode || variantName);
    const targetIndex = variants.findIndex((item) => item.variantKey === targetKey);

    if (targetIndex < 0) {
      throw new Error(`Varian bahan tidak ditemukan untuk ${material?.name || 'bahan baku'}`);
    }

    const nextVariants = [...variants];
    const currentVariant = { ...nextVariants[targetIndex] };
    currentVariant.currentStock = toNumber(currentVariant.currentStock || 0) + normalizedQty;
    nextVariants[targetIndex] = currentVariant;

    const previousTotalStock = variants.reduce((sum, item) => sum + toNumber(item.currentStock || 0), 0);
    const nextTotalStock = previousTotalStock + normalizedQty;
    const averageActualUnitCost =
      nextTotalStock > 0
        ? ((previousTotalStock * currentAverage) + (normalizedQty * normalizedCost)) / nextTotalStock
        : normalizedCost;

    return enrichRawMaterialWithVariantTotals({
      ...material,
      variants: nextVariants,
      averageActualUnitCost,
    });
  }

  const previousStock = toNumber(material?.currentStock ?? material?.stock ?? 0);
  const nextStock = previousStock + normalizedQty;
  const averageActualUnitCost =
    nextStock > 0
      ? ((previousStock * currentAverage) + (normalizedQty * normalizedCost)) / nextStock
      : normalizedCost;

  return {
    ...material,
    currentStock: nextStock,
    stock: nextStock,
    availableStock: calculateAvailableStock(nextStock, toNumber(material?.reservedStock || 0)),
    averageActualUnitCost,
  };
};
