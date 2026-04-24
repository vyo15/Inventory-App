import { calculateAvailableStock, toNumber } from '../stock/stockHelpers';

// =====================================================
// Helper trim aman untuk semua field identitas.
// Dipakai supaya perbandingan key / label / nama varian konsisten
// walaupun data lama masih campur null / undefined / string kosong.
// =====================================================
const safeTrim = (value) => String(value || '').trim();

// =====================================================
// Normalisasi token untuk kebutuhan pencocokan.
// Tujuan:
// - samakan huruf besar kecil
// - rapikan multi spasi
// - bikin compare key/label lebih stabil
// =====================================================
const normalizeCompareToken = (value) =>
  safeTrim(value)
    .toLowerCase()
    .replace(/\s+/g, ' ');

// =====================================================
// Ambil key utama varian.
// Prioritas tetap mempertahankan key eksplisit jika ada,
// lalu fallback ke field identitas lain untuk kompatibilitas data lama.
// =====================================================
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

// =====================================================
// Ambil label tampilan varian.
// Label ini dipakai di UI dan juga jadi fallback penting saat
// inherit variant antar item tidak bisa mengandalkan key internal.
// =====================================================
export const getVariantLabel = (variant = {}) =>
  safeTrim(
    variant.variantLabel ||
      variant.label ||
      variant.variantName ||
      variant.name ||
      variant.color ||
      variant.variantCode ||
      variant.code ||
      variant.sku ||
      variant.id,
  );

// =====================================================
// Deteksi apakah item benar-benar punya varian.
// Ini dipakai sebagai sumber kebenaran utama agar flow BOM lama
// tidak lagi hanya bergantung pada snapshot line yang stale.
// =====================================================
export const inferHasVariants = (item = {}) =>
  item?.hasVariants === true ||
  item?.hasVariantOptions === true ||
  (Array.isArray(item?.variants) && item.variants.length > 0) ||
  (Array.isArray(item?.variantOptions) && item.variantOptions.length > 0);

// =====================================================
// Kumpulkan semua token pencarian yang relevan untuk 1 varian.
// Dipakai untuk fallback match by label/name/color/code/sku.
// Ini penting untuk kasus inherit antar item yang labelnya sama
// (misal: "ungu") tetapi key internal item berbeda.
// =====================================================
const buildVariantLookupTokens = (variant = {}) => {
  const rawTokens = [
    variant.variantKey,
    variant.variantLabel,
    variant.label,
    variant.variantName,
    variant.name,
    variant.color,
    variant.variantCode,
    variant.code,
    variant.sku,
    variant.id,
    variant.value,
    getVariantKey(variant),
    getVariantLabel(variant),
  ];

  return Array.from(
    new Set(rawTokens.map((value) => normalizeCompareToken(value)).filter(Boolean)),
  );
};

// =====================================================
// Normalisasi daftar varian item.
// Catatan maintainability:
// - tetap baca field stock lama jika currentStock belum ada
// - availableStock selalu dihitung ulang agar konsisten
// - hanya varian yang punya label valid yang dipertahankan
// =====================================================
export const normalizeItemVariants = (item = {}) => {
  const rawVariants = Array.isArray(item?.variants)
    ? item.variants
    : Array.isArray(item?.variantOptions)
      ? item.variantOptions
      : [];

  if (!Array.isArray(rawVariants)) return [];

  return rawVariants
    .map((variant, index) => {
      const variantKey = getVariantKey(variant) || `variant-${index}`;
      const variantLabel = getVariantLabel(variant) || variantKey;
      const currentStock = toNumber(variant.currentStock ?? variant.stock ?? 0);
      const reservedStock = toNumber(variant.reservedStock || 0);

      return {
        ...variant,
        variantKey,
        variantLabel,
        currentStock,
        reservedStock,
        availableStock: calculateAvailableStock(currentStock, reservedStock),
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

// =====================================================
// Cari varian berdasarkan key internal.
// Tetap dipisah dari pencarian label supaya jalur exact match
// masih jadi prioritas pertama sebelum fallback semantik.
// =====================================================
export const findVariantByKey = (item = {}, variantKey = '') => {
  const normalizedKey = normalizeCompareToken(variantKey);
  if (!normalizedKey) return null;

  return (
    normalizeItemVariants(item).find(
      (variant) => normalizeCompareToken(variant.variantKey) === normalizedKey,
    ) || null
  );
};

// =====================================================
// Cari varian berdasarkan label/nama/warna/kode.
// ACTIVE / FINAL untuk flow produksi varian:
// - exact token tetap prioritas utama;
// - fuzzy contains hanya dipakai jika match unik, agar kasus "Merah"
//   tetap bisa menemukan "Flanel Merah" tanpa asal pilih varian lain;
// - jika fuzzy ambigu, helper mengembalikan null dan caller strict akan
//   menghentikan proses, bukan fallback diam-diam ke master.
// =====================================================
const findVariantByLabel = (item = {}, variantReference = '') => {
  const normalizedReference = normalizeCompareToken(variantReference);
  if (!normalizedReference) return null;

  const variants = normalizeItemVariants(item);
  const exactMatch = variants.find((variant) =>
    buildVariantLookupTokens(variant).includes(normalizedReference),
  );

  if (exactMatch) return exactMatch;

  const fuzzyMatches = variants.filter((variant) =>
    buildVariantLookupTokens(variant).some((token) =>
      token.length >= 3 &&
      normalizedReference.length >= 3 &&
      (token.includes(normalizedReference) || normalizedReference.includes(token)),
    ),
  );

  return fuzzyMatches.length === 1 ? fuzzyMatches[0] : null;
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

// =====================================================
// Helper display final varian produksi.
// ACTIVE / FINAL untuk UI Production Order, Work Log, dan audit stok:
// - source of truth display varian selalu memakai key/label varian aktual
//   dari dokumen final, bukan hanya stockSourceType lama.
// - stockSourceType tetap dibaca sebagai metadata, tetapi tidak boleh
//   membuat UI menampilkan Master jika key/label varian sebenarnya ada.
// - Jika item bervarian tetapi tidak punya key/label, UI diberi status
//   warning agar data lama/mismatch terlihat jelas dan tidak tampak benar.
// =====================================================
export const buildVariantDisplayInfo = ({
  stockSourceType = '',
  variantKey = '',
  variantLabel = '',
  fallbackVariantKey = '',
  fallbackVariantLabel = '',
  hasVariants = false,
  expectsVariant = hasVariants,
  variantSourceLabel = 'Variant',
  masterSourceLabel = 'Master',
  masterVariantLabel = '',
  missingVariantLabel = 'Varian belum terbaca',
  missingVariantDescription = 'Cek data lama / legacy master',
} = {}) => {
  const normalizedStockSource = safeTrim(stockSourceType).toLowerCase();
  const normalizedVariantKey = safeTrim(variantKey || fallbackVariantKey);
  const normalizedVariantLabel = safeTrim(variantLabel || fallbackVariantLabel || normalizedVariantKey);
  const hasVariantIdentity = Boolean(normalizedVariantKey || normalizedVariantLabel);
  const shouldReadVariant = expectsVariant === true || normalizedStockSource === 'variant';

  if (normalizedStockSource === 'variant' || hasVariantIdentity) {
    return {
      isVariant: true,
      isMaster: false,
      isMissingVariant: shouldReadVariant && !normalizedVariantLabel,
      tagColor: 'purple',
      sourceLabel: variantSourceLabel,
      variantKey: normalizedVariantKey,
      variantLabel: normalizedVariantLabel || missingVariantLabel,
    };
  }

  // =====================================================
  // ACTIVE / FINAL display guard.
  // Item boleh punya varian, tetapi BOM/Work Log line tertentu bisa
  // memang diset memakai stok umum/master (materialVariantStrategy=none).
  // Warning "Varian belum terbaca" hanya muncul jika layer ini memang
  // diwajibkan membaca varian, bukan sekadar karena master item punya varian.
  // =====================================================
  if (shouldReadVariant) {
    return {
      isVariant: false,
      isMaster: false,
      isMissingVariant: true,
      tagColor: 'orange',
      sourceLabel: missingVariantLabel,
      variantKey: '',
      variantLabel: missingVariantDescription,
    };
  }

  return {
    isVariant: false,
    isMaster: true,
    isMissingVariant: false,
    tagColor: 'default',
    sourceLabel: masterSourceLabel,
    variantKey: '',
    variantLabel: safeTrim(masterVariantLabel),
  };
};

// =====================================================
// Resolve sumber stok yang dipakai untuk suatu material/output.
// ACTIVE / FINAL untuk flow PO variant:
// - caller final wajib mengirim allowMasterFallback=false supaya varian
//   yang gagal resolve tidak diam-diam kembali ke master;
// - fallback master hanya tersisa untuk flow manual/legacy yang memang
//   belum punya contract PO variant.
// Prioritas resolve:
// 1. key exact match
// 2. label / nama / warna / kode / sku
// 3. fuzzy label unik untuk naming yang tidak persis sama
// 4. single active variant fallback jika memang cuma ada 1 varian
// 5. master stock fallback hanya jika caller mengizinkan
// =====================================================
export const resolveVariantSelection = ({
  item = {},
  materialVariantStrategy = 'none',
  targetVariantKey = '',
  targetVariantLabel = '',
  fixedVariantKey = '',
  fixedVariantLabel = '',
  allowMasterFallback = true,
  contextLabel = '',
} = {}) => {
  const hasVariants = inferHasVariants(item);
  const normalizedStrategy = hasVariants
    ? materialVariantStrategy || 'inherit'
    : 'none';

  if (!hasVariants || normalizedStrategy === 'none') {
    const stock = getItemStockSnapshot(item);
    return {
      stockSourceType: 'master',
      materialHasVariants: hasVariants,
      materialVariantStrategy: 'none',
      resolvedVariantKey: '',
      resolvedVariantLabel: '',
      resolutionMatchType: 'master',
      ...stock,
    };
  }

  const candidateKey =
    normalizedStrategy === 'fixed' ? fixedVariantKey : targetVariantKey;
  const candidateLabel =
    normalizedStrategy === 'fixed' ? fixedVariantLabel : targetVariantLabel;

  const activeVariants = buildVariantOptionsFromItem(item);
  const singleActiveVariant = activeVariants.length === 1 ? activeVariants[0]?.raw || null : null;

  // =====================================================
  // Exact key match tetap didahulukan.
  // Setelah itu baru fallback ke label/reference text,
  // termasuk saat ada flow lama yang terlanjur mengirim label di field key.
  // =====================================================
  const selectedVariantByKey = findVariantByKey(item, candidateKey);
  const selectedVariantByLabel =
    findVariantByLabel(item, candidateLabel) ||
    findVariantByLabel(item, candidateKey) ||
    findVariantByLabel(item, fixedVariantLabel) ||
    findVariantByLabel(item, fixedVariantKey);

  const selectedVariant =
    selectedVariantByKey ||
    selectedVariantByLabel ||
    ((!safeTrim(candidateKey) && !safeTrim(candidateLabel) && singleActiveVariant)
      ? singleActiveVariant
      : null);

  if (!selectedVariant) {
    if (!allowMasterFallback) {
      const referenceText = [candidateKey, candidateLabel, fixedVariantKey, fixedVariantLabel]
        .map((value) => safeTrim(value))
        .filter(Boolean)
        .join(' / ');
      const itemName = safeTrim(item.name || item.productName || item.materialName || item.code);
      throw new Error(
        `${contextLabel || 'Varian'} tidak ditemukan pada ${itemName || 'item'}${referenceText ? ` untuk referensi ${referenceText}` : ''}. Proses dihentikan agar stok tidak masuk ke master/default.`,
      );
    }

    const stock = getItemStockSnapshot(item);
    return {
      stockSourceType: 'master',
      materialHasVariants: hasVariants,
      materialVariantStrategy: normalizedStrategy,
      resolvedVariantKey: '',
      resolvedVariantLabel: '',
      resolutionFallback: 'master',
      resolutionMatchType: 'master-fallback',
      ...stock,
    };
  }

  return {
    stockSourceType: 'variant',
    materialHasVariants: true,
    materialVariantStrategy: normalizedStrategy,
    resolvedVariantKey: selectedVariant.variantKey,
    resolvedVariantLabel: selectedVariant.variantLabel,
    resolutionMatchType: selectedVariantByKey
      ? 'key'
      : selectedVariantByLabel
        ? 'label'
        : 'single-active',
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
