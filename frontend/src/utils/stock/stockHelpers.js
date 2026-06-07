import { formatNumberId } from '../formatters/numberId';
import { resolveDisplayReference } from '../references/displayReferenceResolver';

export const toNumber = (value, fallback = 0) => {
  const parsedValue = Number(value ?? fallback);
  const parsedFallback = Number(fallback ?? 0);

  if (Number.isFinite(parsedValue)) return parsedValue;
  return Number.isFinite(parsedFallback) ? parsedFallback : 0;
};

export const calculateAvailableStock = (currentStock, reservedStock) => {
  return Math.max(toNumber(currentStock) - toNumber(reservedStock), 0);
};

export const normalizeStockSnapshot = (item = {}, stockField = 'currentStock') => {
  const currentStock = toNumber(item[stockField] ?? item.stock ?? 0);
  const reservedStock = toNumber(item.reservedStock);
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

  // =====================================================
  // ACTIVE / GUARDED - Zero-cost baseline protection.
  // Fungsi:
  // - Jika stok lama masih ada tetapi cost/HPP master ter-reset/0, stok lama tidak boleh
  //   dihitung sebagai modal 0 saat ada pembelian/produksi baru.
  // - Cost masuk pertama yang valid menjadi baseline untuk stok lama + stok masuk.
  // Risiko:
  // - Jangan ubah menjadi average biasa tanpa migration cost lama, karena bisa membuat
  //   modal turun tidak realistis dan laporan laba tampak terlalu besar.
  // =====================================================
  const previousCostBasis = prevQty > 0 && prevCost <= 0 && inCost > 0 ? inCost : prevCost;

  return (prevQty * previousCostBasis + inQty * inCost) / totalQty;
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
  const threshold = toNumber(record?.[primaryField] ?? record?.[fallbackField]);

  return threshold > 0 ? threshold : 0;
};

export const getVariantAvailableStockValue = (variant = {}) => {
  const currentStock = toNumber(variant?.currentStock ?? variant?.stock);
  const reservedStock = toNumber(variant?.reservedStock);
  const fallbackAvailable = Math.max(currentStock - reservedStock, 0);
  const availableStock = toNumber(variant?.availableStock, fallbackAvailable);

  return Math.max(availableStock, 0);
};

export const getVariantStockStatusMeta = (variant = {}, threshold = 0) => {
  if (variant?.isActive === false) {
    return { status: 'safe', label: 'Aman', color: 'green', pillClassName: '' };
  }

  const stock = getVariantAvailableStockValue(variant);
  const safeThreshold = toNumber(threshold);

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

  const parsedThreshold = Number(threshold);
  const resolvedThreshold = Number.isFinite(parsedThreshold)
    ? parsedThreshold
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
const STOCK_READ_MODEL_SOURCE_TYPE_ALIASES = {
  material: 'material',
  raw_material: 'material',
  raw_materials: 'material',
  'raw material': 'material',
  'raw-material': 'material',
  bahan_baku: 'material',
  bahanbaku: 'material',
  'bahan baku': 'material',
  product: 'product',
  products: 'product',
  'produk jadi': 'product',
  semi_finished: 'semi_finished',
  semi_finished_material: 'semi_finished',
  semi_finished_materials: 'semi_finished',
  'semi finished': 'semi_finished',
};

export const STOCK_READ_MODEL_SOURCE_COLLECTIONS = {
  material: 'raw_materials',
  product: 'products',
  semi_finished: 'semi_finished_materials',
};

export const STOCK_READ_MODEL_STATUS_RANK = {
  safe: 0,
  low: 1,
  empty: 2,
};

const STOCK_READ_MODEL_SOURCE_CONFIG = {
  material: {
    typeLabel: 'Bahan Baku',
    route: '/stock-management',
  },
  product: {
    typeLabel: 'Produk Jadi',
    route: '/stock-management',
  },
  semi_finished: {
    typeLabel: 'Semi Finished',
    route: '/produksi/semi-finished-materials',
  },
};

export const normalizeStockReadModelSourceType = (sourceType = '', typeLabel = '') => {
  const normalizedSource = String(sourceType || '').trim().toLowerCase();
  const normalizedTypeLabel = String(typeLabel || '').trim().toLowerCase();

  return (
    STOCK_READ_MODEL_SOURCE_TYPE_ALIASES[normalizedSource] ||
    STOCK_READ_MODEL_SOURCE_TYPE_ALIASES[normalizedTypeLabel] ||
    'product'
  );
};

export const getStockReadModelQuantities = (record = {}) => {
  const currentStock = toNumber(record?.currentStock ?? record?.stock);
  const reservedStock = toNumber(record?.reservedStock);
  const calculatedAvailableStock = calculateAvailableStock(currentStock, reservedStock);
  const availableStock = toNumber(record?.availableStock, calculatedAvailableStock);
  const stock = toNumber(record?.stock, currentStock);

  return {
    stock,
    currentStock,
    reservedStock,
    availableStock,
  };
};

export const getStockReadModelStatusMeta = (
  record = {},
  {
    sourceType = '',
    threshold,
    stockValue,
  } = {},
) => {
  const safeStockValue = toNumber(stockValue);
  const safeThreshold = toNumber(threshold);
  const variantStatusMeta = getVariantAwareStockStatusMeta(record, {
    sourceType,
    threshold: safeThreshold,
  });

  if (variantStatusMeta?.label === 'Kosong') {
    return {
      status: 'empty',
      reportStatus: 'Habis',
      label: 'Kosong',
      color: 'red',
      alertType: 'error',
      affectedVariants: variantStatusMeta.affectedVariants || [],
    };
  }

  if (variantStatusMeta?.label === 'Stok Rendah') {
    return {
      status: 'low',
      reportStatus: 'Kritis',
      label: 'Menipis',
      color: 'gold',
      alertType: 'warning',
      affectedVariants: variantStatusMeta.affectedVariants || [],
    };
  }

  if (safeStockValue <= 0) {
    return {
      status: 'empty',
      reportStatus: 'Habis',
      label: 'Kosong',
      color: 'red',
      alertType: 'error',
      affectedVariants: [],
    };
  }

  if (safeThreshold > 0 && safeStockValue <= safeThreshold) {
    return {
      status: 'low',
      reportStatus: 'Kritis',
      label: 'Menipis',
      color: 'gold',
      alertType: 'warning',
      affectedVariants: [],
    };
  }

  return {
    status: 'safe',
    reportStatus: 'Normal',
    label: 'Aman',
    color: 'green',
    alertType: 'success',
    affectedVariants: [],
  };
};

// =====================================================
// ACTIVE / READ-ONLY - Stock row mapper for Dashboard and Stock Report.
// Fungsi:
// - menyamakan sumber angka stok display: availableStock -> currentStock/stock fallback;
// - menyamakan threshold master per entity: raw material minStock, product/semi finished minStockAlert;
// - menjaga Dashboard dan Stock Report tidak punya comparator/status stok yang bercabang.
// Hubungan flow:
// - hanya mapper read-only dari dokumen master stok ke row UI/report;
// - tidak menulis stock/currentStock/reservedStock/availableStock, inventory log, transaksi, produksi, payroll, HPP, atau schema.
// Risiko:
// - Jangan pindahkan mutasi stok atau validasi transaksi ke helper ini. Writer tetap memakai service/helper stok guarded.
// =====================================================
export const buildStockReadModelRow = (
  record = {},
  {
    id,
    sourceType = '',
    typeLabel = '',
    route = '',
    unit = '',
    name = '',
    affectedVariantMaxItems = 3,
  } = {},
) => {
  const resolvedSourceType = normalizeStockReadModelSourceType(sourceType, typeLabel);
  const sourceConfig = STOCK_READ_MODEL_SOURCE_CONFIG[resolvedSourceType] || STOCK_READ_MODEL_SOURCE_CONFIG.product;
  const resolvedTypeLabel = typeLabel || sourceConfig.typeLabel;
  const quantities = getStockReadModelQuantities(record);
  const minStockThreshold = resolveMasterLowStockThreshold(record, resolvedSourceType);
  const unitDisplay = unit || record?.stockUnit || record?.unit || record?.baseUnit || 'pcs';
  const displayName = name || record?.name || record?.productName || record?.materialName || '-';
  const statusMeta = getStockReadModelStatusMeta(record, {
    sourceType: resolvedSourceType,
    threshold: minStockThreshold,
    stockValue: quantities.availableStock,
  });
  const affectedVariantSummary = formatAffectedVariantStockSummary(record, {
    sourceType: resolvedSourceType,
    threshold: minStockThreshold,
    unit: unitDisplay,
    maxItems: affectedVariantMaxItems,
  });

  return {
    ...record,
    id: id || record?.id,
    sourceType: resolvedSourceType,
    type: resolvedTypeLabel,
    to: route || sourceConfig.route,
    name: displayName,
    stock: quantities.stock,
    currentStock: quantities.currentStock,
    reservedStock: quantities.reservedStock,
    availableStock: quantities.availableStock,
    stockDisplay: quantities.availableStock,
    minStockDisplay: minStockThreshold,
    unitDisplay,
    status: statusMeta.reportStatus,
    statusMeta,
    affectedVariantSummary,
    affectedVariantEntries: statusMeta.affectedVariants || [],
  };
};

const toSafeString = (value = '') => String(value ?? '').trim();

const resolveStockReadModelSourceCollection = (sourceType = '', sourceCollection = '') => {
  const resolvedSourceType = normalizeStockReadModelSourceType(sourceType);
  return sourceCollection || STOCK_READ_MODEL_SOURCE_COLLECTIONS[resolvedSourceType] || 'products';
};

const normalizeAffectedVariantEntryForReadModel = (entry = {}) => ({
  key: toSafeString(entry?.key),
  label: toSafeString(entry?.label),
  stock: toNumber(entry?.stock),
  unit: toSafeString(entry?.unit),
  threshold: toNumber(entry?.threshold),
  status: toSafeString(entry?.status),
  statusLabel: toSafeString(entry?.label),
});


const normalizeVariantStockEntryForReadModel = (variant = {}, index = 0, unitDisplay = 'pcs') => {
  const variantLabel = toSafeString(
    variant?.variantLabel ||
      variant?.label ||
      variant?.name ||
      variant?.variantName ||
      variant?.color ||
      variant?.sku ||
      `Varian ${index + 1}`,
  );
  const currentStock = toNumber(variant?.currentStock ?? variant?.stock);
  const reservedStock = toNumber(variant?.reservedStock);
  const availableStock = getVariantAvailableStockValue(variant);

  return {
    variantKey: toSafeString(variant?.variantKey || variant?.id || variant?.sku || variant?.color || variantLabel),
    variantLabel,
    label: variantLabel,
    name: variantLabel,
    color: toSafeString(variant?.color),
    sku: toSafeString(variant?.sku),
    unit: unitDisplay,
    stock: currentStock,
    currentStock,
    reservedStock,
    availableStock,
    isActive: variant?.isActive !== false,
  };
};

const buildStockReadModelSearchText = ({
  displayReference = '',
  name = '',
  typeLabel = '',
  categoryName = '',
  unitDisplay = '',
} = {}) => [displayReference, name, typeLabel, categoryName, unitDisplay]
  .map((value) => toSafeString(value).toLowerCase())
  .filter(Boolean)
  .join(' ');

// =====================================================
// ACTIVE / PURE BUILDER - SQLite stock read model payload.
// Fungsi:
// - membangun payload read model stok dari buildStockReadModelRow() agar comparator Dashboard/Stock Report tetap satu sumber;
// - menyiapkan field queryable untuk status stok, issue flag, source collection, dan export/report;
// - tidak melakukan read/write database dan tidak membuat side-effect stok.
// Guard:
// - Jangan jadikan read model ini source of truth mutasi stok. Source of truth tetap master item + inventory_logs.
// - Writer sync/backfill wajib batch terpisah dan harus menjaga semua jalur stock mutation.
// =====================================================
export const buildStockItemReadModelPayload = (
  record = {},
  {
    id,
    sourceId = '',
    sourceType = '',
    sourceCollection = '',
    displayReference = '',
    syncedAt = null,
    lastSyncedFrom = 'master_stock',
    affectedVariantMaxItems = 3,
    ...rowOptions
  } = {},
) => {
  const row = buildStockReadModelRow(record, {
    ...rowOptions,
    id: id || sourceId || record?.id,
    sourceType,
    affectedVariantMaxItems,
  });
  const resolvedSourceType = normalizeStockReadModelSourceType(row.sourceType, row.type);
  const resolvedSourceId = toSafeString(sourceId || id || record?.id || record?.sourceId);
  const resolvedSourceCollection = resolveStockReadModelSourceCollection(resolvedSourceType, sourceCollection || record?.sourceCollection);
  const status = row.statusMeta?.status || 'safe';
  const statusRank = STOCK_READ_MODEL_STATUS_RANK[status] ?? STOCK_READ_MODEL_STATUS_RANK.safe;
  const variantList = Array.isArray(record?.variants) ? record.variants : [];
  const hasVariants = (record?.hasVariants === true || variantList.length > 0) && variantList.length > 0;
  const variantEntries = variantList.map((variant, index) =>
    normalizeVariantStockEntryForReadModel(variant, index, row.unitDisplay),
  );
  const categoryName = toSafeString(record?.categoryName || record?.category || record?.categoryLabel || record?.categoryId);
  const resolvedDisplayReference = displayReference || resolveDisplayReference(
    {
      ...record,
      id: resolvedSourceId,
      itemCode: record?.itemCode || record?.code || record?.productCode || record?.materialCode,
    },
    { fallback: '', allowTechnicalId: false },
  );
  const affectedVariantEntries = (row.affectedVariantEntries || [])
    .map(normalizeAffectedVariantEntryForReadModel);
  const isNegativeStock = row.currentStock < 0 || row.stock < 0;
  const isReservedOverrun = row.reservedStock > row.currentStock;
  const sortGap = row.availableStock - row.minStockDisplay;

  return {
    sourceType: resolvedSourceType,
    sourceCollection: resolvedSourceCollection,
    sourceId: resolvedSourceId,
    displayReference: resolvedDisplayReference,
    name: row.name,
    typeLabel: row.type,
    route: row.to,
    categoryId: toSafeString(record?.categoryId),
    categoryName,
    unit: row.unitDisplay,
    unitDisplay: row.unitDisplay,
    stock: row.stock,
    currentStock: row.currentStock,
    reservedStock: row.reservedStock,
    availableStock: row.availableStock,
    minStockThreshold: row.minStockDisplay,
    stockStatus: status,
    stockStatusLabel: row.statusMeta?.label || row.status,
    reportStatus: row.status,
    statusColor: row.statusMeta?.color || 'green',
    alertType: row.statusMeta?.alertType || 'success',
    statusRank,
    sortGap,
    hasStockIssue: statusRank > 0 || isNegativeStock || isReservedOverrun,
    isNegativeStock,
    isReservedOverrun,
    hasVariants,
    variantCount: variantList.length,
    variants: variantEntries,
    affectedVariantCount: affectedVariantEntries.length,
    affectedVariantSummary: row.affectedVariantSummary,
    affectedVariantEntries,
    lastPurchaseAt: record?.lastPurchaseAt || record?.latestPurchaseAt || null,
    lastPurchasePrice: toNumber(record?.lastPurchasePrice ?? record?.latestPurchasePrice ?? record?.lastPurchaseUnitPrice),
    lastPurchaseUnitPrice: toNumber(record?.lastPurchaseUnitPrice ?? record?.lastPurchasePrice ?? record?.latestPurchasePrice),
    restockSupplierId: toSafeString(record?.restockSupplierId || record?.supplierId),
    restockSupplierName: toSafeString(record?.restockSupplierName || record?.supplierName),
    restockProductLink: toSafeString(record?.restockProductLink || record?.productLink || record?.link),
    isActive: record?.isActive !== false,
    searchText: buildStockReadModelSearchText({
      displayReference: resolvedDisplayReference,
      name: row.name,
      typeLabel: row.type,
      categoryName,
      unitDisplay: row.unitDisplay,
    }),
    sourceUpdatedAt: record?.updatedAt || record?.createdAt || null,
    updatedAt: syncedAt || null,
    lastSyncedFrom,
  };
};

