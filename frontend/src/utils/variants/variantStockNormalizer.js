import { normalizeTruthyText as trimVariantText } from "../text/textNormalization";
export { trimVariantText };
import { calculateAvailableStock, normalizeStockSnapshot, toNumber } from '../stock/stockHelpers';

// =====================================================
// VARIANT STOCK NORMALIZER - SINGLE SOURCE OF TRUTH.
// ACTIVE: file ini menjadi pusat bentuk final stok varian untuk Raw Material,
// Product, Semi Finished, Stock Adjustment, Sales, Returns, dan Production.
// ALASAN: helper lama sempat punya rumus sendiri sehingga `stock` dan
// `currentStock` varian bisa bercabang setelah edit/transaksi.
// CLEANUP: helper lama tetap boleh ada untuk compatibility import, tetapi
// logic stok varian wajib didelegasikan ke helper di file ini.
// =====================================================
export const normalizeNumberStock = (value = 0) => {
  const normalized = toNumber(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

// =====================================================
// Helper trim/compare ringan untuk key dan label varian.
// ACTIVE: dipakai oleh semua normalizer agar data historis null/undefined tetap aman.
// =====================================================

const normalizeVariantToken = (value) =>
  trimVariantText(value).toLowerCase();

const pickFirstText = (variant = {}, fields = []) => {
  for (const field of fields) {
    const value = trimVariantText(variant?.[field]);
    if (value) return value;
  }
  return '';
};

const DEFAULT_KEY_FIELDS = [
  'variantKey',
  'id',
  'variantId',
  'variantCode',
  'code',
  'sku',
  'variantName',
  'variantLabel',
  'label',
  'name',
  'color',
  'value',
];

const DEFAULT_LABEL_FIELDS = [
  'variantLabel',
  'label',
  'variantName',
  'name',
  'color',
  'variantCode',
  'code',
  'sku',
  'id',
  'value',
];

// =====================================================
// Pilih sumber daftar varian secara compatibility-safe.
// Array `variants: []` tidak boleh menutupi `variantOptions` legacy yang berisi data.
// =====================================================
export const resolveVariantSourceList = (item = {}) => {
  const variants = Array.isArray(item?.variants) ? item.variants : [];
  const variantOptions = Array.isArray(item?.variantOptions) ? item.variantOptions : [];
  if (variants.length > 0) return variants;
  if (variantOptions.length > 0) return variantOptions;
  return [];
};

export const inferVariantMode = (item = {}) =>
  item?.hasVariants === true
  || item?.hasVariantOptions === true
  || resolveVariantSourceList(item).length > 0;

// =====================================================
// Hitung available stock final.
// ACTIVE: wrapper ini memastikan semua helper memakai rumus sama:
// availableStock = max(currentStock - reservedStock, 0).
// =====================================================
export const calculateVariantAvailableStock = (currentStock = 0, reservedStock = 0) =>
  calculateAvailableStock(normalizeNumberStock(currentStock), normalizeNumberStock(reservedStock));

// =====================================================
// Build key stabil untuk varian.
// ACTIVE: mempertahankan key lama jika ada, lalu fallback ke kode/nama/warna.
// ALASAN: data historis IMS tidak selalu punya `variantKey`, jadi audit dan mutasi
// varian harus tetap bisa membaca identitas lama secara aman.
// =====================================================
export const buildVariantKey = (variant = {}, fallbackIndex = 0, keyFields = DEFAULT_KEY_FIELDS) => {
  const explicitKey = pickFirstText(variant, keyFields);
  return normalizeVariantToken(explicitKey || `variant-${fallbackIndex}`);
};

export const buildVariantLabel = (variant = {}, labelFields = DEFAULT_LABEL_FIELDS) =>
  pickFirstText(variant, labelFields);

// =====================================================
// Normalisasi 1 varian ke bentuk final.
// ACTIVE: semua helper varian memakai bentuk ini supaya `stock/currentStock`
// tidak berbeda lagi setelah create/edit/transaksi.
// =====================================================
export const normalizeVariantStockShape = (variant = {}, options = {}) => {
  const {
    fallbackIndex = 0,
    keyFields = DEFAULT_KEY_FIELDS,
    labelFields = DEFAULT_LABEL_FIELDS,
    currentStockField = 'currentStock',
    reservedStockField = 'reservedStock',
    fallbackKeyPrefix = 'variant',
  } = options;

  const currentStock = normalizeNumberStock(
    variant?.[currentStockField] ?? variant?.currentStock ?? variant?.stock ?? 0,
  );
  const reservedStock = normalizeNumberStock(
    variant?.[reservedStockField] ?? variant?.reservedStock ?? 0,
  );
  const variantKey = buildVariantKey(
    variant,
    fallbackIndex,
    keyFields,
  ) || `${fallbackKeyPrefix}-${fallbackIndex}`;
  const variantLabel = buildVariantLabel(variant, labelFields) || variantKey;

  return {
    ...variant,
    variantKey,
    variantLabel,
    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock: calculateVariantAvailableStock(currentStock, reservedStock),
    isActive: variant?.isActive !== false,
  };
};

// =====================================================
// Normalisasi list varian.
// ACTIVE: dipakai helper lama sebagai delegasi, sehingga import lama tetap aman
// tetapi bentuk output stok varian tidak bercabang lagi.
// =====================================================
export const normalizeVariantStockList = (variants = [], options = {}) => {
  if (!Array.isArray(variants)) return [];

  const {
    filterEmptyLabel = true,
    labelFields = DEFAULT_LABEL_FIELDS,
  } = options;

  return variants
    .map((variant, index) => normalizeVariantStockShape(variant, {
      ...options,
      labelFields,
      fallbackIndex: index,
    }))
    .filter((variant) => !filterEmptyLabel || trimVariantText(variant.variantLabel));
};

// =====================================================
// Hitung total varian final.
// ACTIVE: sumber total master item agar master `stock/currentStock` selalu sama
// dengan total varian yang sudah dinormalisasi.
// =====================================================
export const calculateVariantStockTotals = (variants = [], options = {}) => {
  const normalizedVariants = normalizeVariantStockList(variants, options);
  const currentStock = normalizedVariants.reduce(
    (sum, variant) => sum + normalizeNumberStock(variant.currentStock),
    0,
  );
  const reservedStock = normalizedVariants.reduce(
    (sum, variant) => sum + normalizeNumberStock(variant.reservedStock),
    0,
  );
  const activeVariants = normalizedVariants.filter((variant) => variant.isActive !== false);

  return {
    variants: normalizedVariants,
    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock: calculateVariantAvailableStock(currentStock, reservedStock),
    variantCount: normalizedVariants.length,
    activeVariantCount: activeVariants.length,
  };
};

export const getMasterStockSummary = (record = {}) => {
  if (record?.hasVariants) {
    const totals = calculateVariantStockTotals(record.variants || [], { filterEmptyLabel: false });
    return {
      currentStock: totals.currentStock,
      reservedStock: totals.reservedStock,
      availableStock: totals.availableStock,
    };
  }

  const snapshot = normalizeStockSnapshot(record);
  return {
    currentStock: snapshot.currentStock,
    reservedStock: snapshot.reservedStock,
    availableStock: Number(record.availableStock ?? snapshot.availableStock),
  };
};

// =====================================================
// Normalisasi master item dari daftar varian.
// ACTIVE: helper ini tidak menulis database langsung; hanya membentuk payload
// final agar service/transaksi bisa menyimpan master stock yang konsisten.
// =====================================================
export const normalizeVariantMasterStock = (item = {}, variants = [], options = {}) => {
  const totals = calculateVariantStockTotals(variants, options);

  return {
    ...item,
    variants: totals.variants,
    variantOptions: totals.variants,
    variantCount: totals.variantCount,
    activeVariantCount: totals.activeVariantCount,
    currentStock: totals.currentStock,
    stock: totals.stock,
    reservedStock: totals.reservedStock,
    availableStock: totals.availableStock,
  };
};

const GUARDED_STOCK_FIELDS = [
  'stock',
  'currentStock',
  'reservedStock',
  'availableStock',
];

const omitFields = (value = {}, fields = []) => {
  const next = { ...value };
  fields.forEach((field) => {
    delete next[field];
  });
  return next;
};

// =====================================================
// Sanitasi payload edit master inventory.
// ACTIVE/GUARDED: defense-in-depth frontend saja; backend tetap authority final.
// Stok dan valuation hasil transaksi tidak ikut dikirim dari snapshot form lama.
// =====================================================
export const stripGuardedInventoryUpdateFields = (payload = {}, options = {}) => {
  const protectedFields = Array.isArray(options.protectedFields) ? options.protectedFields : [];
  const protectedVariantFields = Array.isArray(options.protectedVariantFields)
    ? options.protectedVariantFields
    : protectedFields;
  const topLevelFields = [...GUARDED_STOCK_FIELDS, ...protectedFields];
  const variantFields = [...GUARDED_STOCK_FIELDS, ...protectedVariantFields];
  const next = omitFields(payload, topLevelFields);

  if (Array.isArray(payload.variants)) {
    next.variants = payload.variants.map((variant) => omitFields(variant, variantFields));
  }

  if (Array.isArray(payload.variantOptions)) {
    next.variantOptions = payload.variantOptions.map((variant) => omitFields(variant, variantFields));
  }

  return next;
};
