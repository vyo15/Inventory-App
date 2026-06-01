import { calculateAvailableStock, toNumber } from '../stock/stockHelpers';

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
// ACTIVE: dipakai oleh semua normalizer agar data lama null/undefined tetap aman.
// =====================================================
export const trimVariantText = (value) => String(value || '').trim();

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
// Hitung available stock final.
// ACTIVE: wrapper ini memastikan semua helper memakai rumus sama:
// availableStock = max(currentStock - reservedStock, 0).
// =====================================================
export const calculateVariantAvailableStock = (currentStock = 0, reservedStock = 0) =>
  calculateAvailableStock(normalizeNumberStock(currentStock), normalizeNumberStock(reservedStock));

// =====================================================
// Build key stabil untuk varian.
// ACTIVE: mempertahankan key lama jika ada, lalu fallback ke kode/nama/warna.
// ALASAN: data lama IMS tidak selalu punya `variantKey`, jadi audit dan mutasi
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

// =====================================================
// Normalisasi master item dari daftar varian.
// ACTIVE: helper ini tidak menulis Firestore langsung; hanya membentuk payload
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
