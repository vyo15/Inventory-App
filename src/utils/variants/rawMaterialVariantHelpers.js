import { calculateAvailableStock, toNumber } from '../stock/stockHelpers';
import {
  calculateVariantStockTotals,
  normalizeVariantStockShape,
} from './variantStockNormalizer';

export const DEFAULT_RAW_MATERIAL_VARIANT = {
  name: '',
  sku: '',
  currentStock: 0,
  stock: 0,
  reservedStock: 0,
  availableStock: 0,
  isActive: true,
};

const safeTrim = (value) => String(value || '').trim();
const toVariantKey = (value) => safeTrim(value).toLowerCase();

// =====================================================
// Normalisasi varian Raw Material.
// ACTIVE: helper ini masih dipakai create/edit Raw Material dan purchase bahan,
// tetapi bentuk stok final didelegasikan ke variantStockNormalizer agar
// `variant.stock` selalu sama dengan `variant.currentStock`.
// CLEANUP: logic lokal hanya menjaga field khusus Raw Material seperti name,
// sku, variantName, dan variantCode.
// =====================================================
export const normalizeRawMaterialVariants = (variants = []) => {
  if (!Array.isArray(variants)) return [];

  return variants
    .map((item, index) => {
      const variantName = safeTrim(item?.variantName || item?.name);
      const variantCode = safeTrim(item?.variantCode || item?.sku).toUpperCase();
      const rawVariant = {
        ...item,
        name: variantName,
        sku: variantCode,
        variantName,
        variantCode,
        variantLabel: variantName,
      };
      const normalized = normalizeVariantStockShape(rawVariant, {
        fallbackIndex: index,
        keyFields: ['variantKey', 'variantCode', 'sku', 'variantName', 'name'],
        labelFields: ['variantLabel', 'variantName', 'name', 'variantCode', 'sku'],
      });

      return {
        ...normalized,
        name: variantName,
        sku: variantCode,
        variantName,
        variantCode,
        variantLabel: variantName,
      };
    })
    .filter((item) => item.name);
};

export const ensureAtLeastOneRawMaterialVariant = (variants = []) => {
  const normalized = normalizeRawMaterialVariants(variants);
  return normalized.length > 0 ? normalized : [{ ...DEFAULT_RAW_MATERIAL_VARIANT }];
};

export const calculateRawMaterialVariantTotals = (variants = []) => {
  // ACTIVE: totals Raw Material memakai helper pusat agar master stock/currentStock
  // selalu berasal dari varian final yang sudah punya stock, currentStock,
  // reservedStock, dan availableStock konsisten.
  const normalized = normalizeRawMaterialVariants(variants);
  return calculateVariantStockTotals(normalized, {
    keyFields: ['variantKey', 'variantCode', 'sku', 'variantName', 'name'],
    labelFields: ['variantLabel', 'variantName', 'name', 'variantCode', 'sku'],
  });
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
  { qty = 0, unitCost = 0, variantKey = '', variantName = '', variantCode = '', restockReferencePrice = material?.restockReferencePrice || 0 } = {},
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
    const nextCurrentStock = toNumber(currentVariant.currentStock || 0) + normalizedQty;
    // ACTIVE: purchase bahan bervarian harus menulis stock dan currentStock sekaligus.
    // ALASAN: Reset/Maintenance tidak boleh menjadi flow harian hanya karena
    // varian hasil purchase kehilangan alias stock kompatibilitas lama.
    nextVariants[targetIndex] = normalizeVariantStockShape(
      {
        ...currentVariant,
        currentStock: nextCurrentStock,
        stock: nextCurrentStock,
      },
      {
        fallbackIndex: targetIndex,
        keyFields: ['variantKey', 'variantCode', 'sku', 'variantName', 'name'],
        labelFields: ['variantLabel', 'variantName', 'name', 'variantCode', 'sku'],
      },
    );

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
      restockReferencePrice: Math.round(toNumber(restockReferencePrice || 0)),
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
    restockReferencePrice: Math.round(toNumber(restockReferencePrice || 0)),
  };
};
