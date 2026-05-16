import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { generateUniqueSequentialCode, isBusinessCodeExists } from '../../utils/references/businessCodeGenerator';
import {
  calculateVariantTotals,
  normalizeColorVariants,
  validateDuplicateVariantColors,
} from '../../utils/variants/variantHelpers';
import {
  appendVariantModeHistory,
  archiveActiveVariantsForModeDisable,
  areAllVariantsStockEmpty,
  buildVariantModeHistoryEntry,
  reconcileVariantArchiveState,
  isVariantStockEmpty,
} from '../../utils/variants/variantArchiveHelpers';

const COLLECTION_NAME = 'products';

export const PRODUCT_DEFAULT_FORM = {
  code: '',
  name: '',
  categoryId: null,
  price: 0,
  hppPerUnit: 0,
  pricingMode: 'manual',
  pricingRuleId: null,
  description: '',
  hasVariants: false,
  variantLabel: 'Varian',
  variants: [],
  currentStock: 0,
  reservedStock: 0,
  minStockAlert: 0,
  isActive: true,
};

const inferHasVariants = (item = {}) =>
  item?.hasVariants === true || (Array.isArray(item?.variants) && item.variants.some((variant) => variant?.isArchived !== true));

const toStockNumber = (value = 0) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
};

/* =====================================================
SECTION: Product Master Minimum Stock Resolver — AKTIF
Fungsi:
- menetapkan `products.minStockAlert` sebagai threshold minimum stok master untuk produk varian dan non-varian.

Dipakai oleh:
- create/update/read Product melalui productsService dan halaman Products.

Alasan perubahan:
- variant sekarang hanya bucket stok fisik; `variants[].minStockAlert` dipertahankan sebagai legacy field tetapi tidak boleh menjadi source utama low stock master.

Catatan cleanup:
- audit data lama yang masih menyimpan `variants[].minStockAlert` bisa dilakukan pada batch maintenance terpisah.

Risiko:
- jika resolver ini diganti kembali ke total varian, warning stok rendah Product akan kembali tidak konsisten dengan input master.
===================================================== */
const resolveProductMasterMinStockAlert = (values = {}) => toStockNumber(values.minStockAlert || 0);

const enrichProduct = (item = {}) => {
  const hasVariants = inferHasVariants(item);
  const activeVariants = (Array.isArray(item.variants) ? item.variants : []).filter((variant) => variant?.isArchived !== true);
  const totals = calculateVariantTotals(activeVariants);
  const currentStock = hasVariants ? totals.currentStock : Number(item.currentStock ?? item.stock ?? 0);
  const reservedStock = hasVariants ? totals.reservedStock : Number(item.reservedStock || 0);
  const minStockAlert = resolveProductMasterMinStockAlert(item);

  return {
    ...item,
    hasVariants,
    variants: hasVariants ? totals.variants : [],
    stock: currentStock,
    currentStock,
    reservedStock,
    availableStock: Math.max(currentStock - reservedStock, 0),
    minStockAlert,
    variantCount: hasVariants ? totals.variantCount : 0,
    activeVariantCount: hasVariants ? totals.activeVariantCount : 0,
  };
};

const resolveProductMetadata = (values = {}, categories = []) => {
  const selectedCategory = (categories || []).find((item) => item.id === values.categoryId);

  return {
    code: String(values.code || '').trim().toUpperCase(),
    productCode: String(values.code || '').trim().toUpperCase(),
    name: String(values.name || '').trim(),
    categoryId: values.categoryId || null,
    category: selectedCategory?.name || 'Produk Jadi',
    description: String(values.description || '').trim(),
    // IMS NOTE [AKTIF | pricing-optional]: default service dibuat Manual agar
    // create Product tidak diblokir Pricing Rules. Hubungan flow: Pricing Rule
    // tetap valid saat user memilih mode Rule, tetapi mode Manual boleh kosong.
    pricingMode: values.pricingMode === 'rule' ? 'rule' : 'manual',
    pricingRuleId: values.pricingMode === 'rule' ? values.pricingRuleId || null : null,
    price: toStockNumber(values.price || 0),
    hppPerUnit: toStockNumber(values.hppPerUnit || 0),
    isActive: values.isActive !== false,
    variantLabel: String(values.variantLabel || 'Varian').trim() || 'Varian',
    updatedAt: serverTimestamp(),
    lastPricingUpdatedAt: values.pricingMode === 'manual' ? serverTimestamp() : null,
  };
};

const normalizeProductCreatePayload = (values = {}, categories = []) => {
  const hasVariants = values.hasVariants === true;
  const normalizedVariants = hasVariants ? normalizeColorVariants(values.variants || []) : [];
  const variantTotals = calculateVariantTotals(normalizedVariants);
  const currentStock = hasVariants ? variantTotals.currentStock : toStockNumber(values.currentStock || 0);
  const reservedStock = hasVariants ? variantTotals.reservedStock : toStockNumber(values.reservedStock || 0);
  const minStockAlert = resolveProductMasterMinStockAlert(values);

  // IMS NOTE [AKTIF | behavior-preserving]: jalur create tetap menulis stok awal.
  // Hubungan flow: stok awal hanya boleh dibentuk saat master product pertama dibuat.
  return {
    ...resolveProductMetadata(values, categories),
    hasVariants,
    variants: normalizedVariants,
    variantCount: hasVariants ? variantTotals.variantCount : 0,
    activeVariantCount: hasVariants ? variantTotals.activeVariantCount : 0,
    currentStock,
    reservedStock,
    availableStock: Math.max(currentStock - reservedStock, 0),
    // IMS NOTE [LEGACY | behavior-preserving]: field stock tetap alias currentStock untuk data lama.
    stock: currentStock,
    minStockAlert,
    createdAt: serverTimestamp(),
  };
};

// IMS NOTE [GUARDED | behavior-preserving]: variant matching memakai key/kode/nama, bukan index.
// Alasan cleanup: index bisa salah memindahkan stok jika urutan varian berubah.

const hasProtectedMasterStock = (item = {}) => {
  const currentStock = toStockNumber(item.currentStock ?? item.stock ?? 0);
  const reservedStock = toStockNumber(item.reservedStock || 0);
  const availableStock = toStockNumber(
    item.availableStock ?? Math.max(currentStock - reservedStock, 0),
  );

  return currentStock > 0 || reservedStock > 0 || availableStock > 0;
};

const normalizeZeroStockProductVariants = (variants = []) =>
  normalizeColorVariants(variants).map((variant) => ({
    ...variant,
    // IMS NOTE [GUARDED | stok-awal-existing]: varian baru dari item existing
    // selalu mulai 0. Hubungan flow: stok setelah create tidak boleh ditulis
    // dari master; user bisa isi stok lewat Stock Adjustment/transaksi resmi.
    currentStock: 0,
    stock: 0,
    reservedStock: 0,
    availableStock: 0,
    isActive: true,
    isArchived: false,
  }));

const buildProductVariantKeyCandidates = (variant = {}) => [
  variant.variantKey,
  variant.sku,
  variant.color,
  variant.name,
]
  .map((value) => String(value || '').trim().toLowerCase())
  .filter(Boolean);

const buildProductVariantLookup = (variants = []) => {
  const lookup = new Map();
  normalizeColorVariants(variants).forEach((variant, index) => {
    buildProductVariantKeyCandidates(variant, index).forEach((key) => {
      if (!lookup.has(key)) lookup.set(key, variant);
    });
  });
  return lookup;
};

const hasProtectedVariantStock = (variant = {}) => {
  // IMS NOTE [GUARDED | stok-varian]: hapus/archive varian ditolak bila salah satu
  // bucket stok masih bernilai. Hubungan flow: mencegah bucket stok/reference
  // hilang dari master tanpa Stock Adjustment/transaksi resmi. STATUS: AKTIF.
  return !isVariantStockEmpty(variant);
};

const assertNoProductVariantWithStockRemoved = (editedVariants = [], existingVariants = []) => {
  const editedLookup = buildProductVariantLookup(editedVariants);

  normalizeColorVariants(existingVariants).forEach((variant, index) => {
    const stillExists = buildProductVariantKeyCandidates(variant, index).some((key) => editedLookup.has(key));

    if (!stillExists && hasProtectedVariantStock(variant)) {
      throw {
        type: 'validation',
        errors: {
          variants: 'Varian yang masih punya stock/reserved tidak boleh dihapus dari master. Nolkan lewat flow resmi lebih dulu.',
        },
      };
    }
  });
};

const mergeProductVariantMetadataWithExistingStock = (
  editedVariants = [],
  existingVariants = [],
  archivedVariants = [],
  options = {},
) => {
  const normalizedEdited = normalizeColorVariants(editedVariants);
  const normalizedExisting = normalizeColorVariants(existingVariants);

  if (normalizedEdited.length === 0) {
    throw { type: 'validation', errors: { variants: 'Minimal harus ada 1 varian' } };
  }

  const duplicateErrors = validateDuplicateVariantColors(normalizedEdited);
  if (Object.keys(duplicateErrors).length > 0) {
    throw { type: 'validation', errors: duplicateErrors };
  }

  assertNoProductVariantWithStockRemoved(normalizedEdited, normalizedExisting);

  const mergeActiveVariant = (variant = {}, existingVariant = {}) => {
    const currentStock = toStockNumber(existingVariant?.currentStock ?? existingVariant?.stock ?? 0);
    const reservedStock = toStockNumber(existingVariant?.reservedStock || 0);

    return {
      ...variant,
      variantKey: existingVariant?.variantKey || variant.variantKey,
      currentStock,
      stock: currentStock,
      reservedStock,
      availableStock: Math.max(currentStock - reservedStock, 0),
      minStockAlert: toStockNumber(variant.minStockAlert || 0),
      isActive: variant.isActive !== false,
      isArchived: false,
    };
  };

  const buildNewVariant = (variant = {}) => ({
    ...variant,
    currentStock: 0,
    stock: 0,
    reservedStock: 0,
    availableStock: 0,
    minStockAlert: toStockNumber(variant.minStockAlert || 0),
    isActive: true,
    isArchived: false,
  });

  return reconcileVariantArchiveState({
    editedVariants: normalizedEdited,
    existingVariants: normalizedExisting,
    archivedVariants,
    normalizeVariants: normalizeColorVariants,
    mergeActiveVariant,
    buildNewVariant,
    protectedRemovalMessage: 'Varian yang masih punya stock/reserved tidak boleh diarsipkan. Nolkan lewat flow resmi lebih dulu.',
    duplicateActiveMessage: 'Nama varian aktif tidak boleh duplikat',
    now: options.now,
    actor: options.actor,
    archiveReason: options.archiveReason || 'Varian produk diarsipkan dari edit master setelah stok 0.',
    restoreReason: options.restoreReason || 'Varian produk lama direstore karena dibuat lagi dengan struktur yang sama.',
  });
};

const normalizeProductMetadataPayload = (values = {}, categories = [], existingProduct = {}) => {
  const existingActiveVariants = (Array.isArray(existingProduct.variants) ? existingProduct.variants : [])
    .filter((variant) => variant?.isArchived !== true);
  const existingArchivedVariants = Array.isArray(existingProduct.archivedVariants)
    ? existingProduct.archivedVariants
    : [];
  const existingHasVariants = inferHasVariants(existingProduct);
  const wantsVariants = values.hasVariants === true;
  const canActivateVariants = !existingHasVariants && wantsVariants;
  const hasVariants = wantsVariants;
  const now = new Date().toISOString();
  const actor = 'system';
  const payload = {
    ...resolveProductMetadata(values, categories),
    hasVariants,
  };

  /* =====================================================
  SECTION: Product Variant Archive/Restore Guard — GUARDED
  Fungsi:
  - Menjadi guard service utama untuk OFF mode varian, archive varian stok 0, restore archived variant, dan duplicate active guard.

  Dipakai oleh:
  - updateProduct transaction setelah membaca dokumen Product terbaru dan drawer Product.

  Alasan perubahan:
  - Mode varian existing boleh fleksibel saat semua stok 0, tetapi variantKey lama harus tetap disimpan sebagai tombstone agar histori transaksi aman.

  Catatan cleanup:
  - Jika UI nanti mengirim audit user, actor dapat diganti dari system ke user email tanpa mengubah bentuk archive.

  Risiko:
  - Jika guard ini dilepas, client lama bisa hard delete varian, membuat duplicate variantKey, atau menulis stok tanpa flow resmi.
  ===================================================== */
  if (existingHasVariants && !wantsVariants) {
    if (!areAllVariantsStockEmpty(existingActiveVariants)) {
      throw {
        type: 'validation',
        errors: {
          hasVariants: 'Mode varian hanya bisa dimatikan jika semua varian current/reserved/available stock 0.',
        },
      };
    }

    const archiveResult = archiveActiveVariantsForModeDisable({
      activeVariants: existingActiveVariants,
      archivedVariants: existingArchivedVariants,
      now,
      actor,
      archiveReason: 'Mode varian produk dimatikan setelah semua stok varian 0.',
    });

    return {
      ...payload,
      hasVariants: false,
      variants: [],
      archivedVariants: archiveResult.archivedVariants,
      variantModeHistory: appendVariantModeHistory(existingProduct.variantModeHistory, archiveResult.historyEntries),
      variantCount: 0,
      activeVariantCount: 0,
      currentStock: 0,
      reservedStock: 0,
      availableStock: 0,
      stock: 0,
      minStockAlert: resolveProductMasterMinStockAlert(values),
    };
  }

  if (canActivateVariants) {
    if (hasProtectedMasterStock(existingProduct)) {
      throw {
        type: 'validation',
        errors: {
          hasVariants: 'Aktifkan varian hanya untuk produk lama dengan stok, reserved, dan available stock 0. Nolkan/alokasikan stok lewat flow Stock Adjustment resmi lebih dulu.',
        },
      };
    }

    const convertedVariants = normalizeZeroStockProductVariants(values.variants || []);
    if (convertedVariants.length === 0) {
      throw { type: 'validation', errors: { variants: 'Minimal harus ada 1 varian' } };
    }

    const duplicateErrors = validateDuplicateVariantColors(convertedVariants);
    if (Object.keys(duplicateErrors).length > 0) {
      throw { type: 'validation', errors: duplicateErrors };
    }

    const mergeResult = mergeProductVariantMetadataWithExistingStock(
      convertedVariants,
      [],
      existingArchivedVariants,
      {
        now,
        actor,
        restoreReason: 'Varian produk lama direstore saat mode varian diaktifkan kembali.',
      },
    );
    const variantTotals = calculateVariantTotals(mergeResult.activeVariants);
    const historyEntries = [
      buildVariantModeHistoryEntry('variant_mode_enabled', {
        now,
        actor,
        reason: 'Mode varian produk diaktifkan dari item stok master 0.',
      }),
      ...mergeResult.historyEntries,
    ];

    return {
      ...payload,
      variants: variantTotals.variants,
      archivedVariants: mergeResult.archivedVariants,
      variantModeHistory: appendVariantModeHistory(existingProduct.variantModeHistory, historyEntries),
      variantCount: variantTotals.variantCount,
      activeVariantCount: variantTotals.activeVariantCount,
      currentStock: 0,
      reservedStock: 0,
      availableStock: 0,
      stock: 0,
      minStockAlert: resolveProductMasterMinStockAlert(values),
    };
  }

  if (!hasVariants) {
    return {
      ...payload,
      hasVariants: false,
      variants: [],
      archivedVariants: existingArchivedVariants,
      variantCount: 0,
      activeVariantCount: 0,
      minStockAlert: resolveProductMasterMinStockAlert(values),
    };
  }

  const mergeResult = mergeProductVariantMetadataWithExistingStock(
    values.variants || [],
    existingActiveVariants,
    existingArchivedVariants,
    { now, actor },
  );
  const variantTotals = calculateVariantTotals(mergeResult.activeVariants);

  return {
    ...payload,
    variants: variantTotals.variants,
    archivedVariants: mergeResult.archivedVariants,
    variantModeHistory: appendVariantModeHistory(existingProduct.variantModeHistory, mergeResult.historyEntries),
    variantCount: variantTotals.variantCount,
    activeVariantCount: variantTotals.activeVariantCount,
    currentStock: variantTotals.currentStock,
    reservedStock: variantTotals.reservedStock,
    availableStock: variantTotals.availableStock,
    stock: variantTotals.currentStock,
    minStockAlert: resolveProductMasterMinStockAlert(values),
  };
};

export const validateProductPayload = async (values = {}, editingId = null) => {
  const errors = {};
  const productName = String(values.name || '').trim();
  const hasVariants = values.hasVariants === true;
  const pricingMode = values.pricingMode === 'rule' ? 'rule' : 'manual';

  if (!productName) {
    errors.name = 'Nama produk wajib diisi';
  }

  if (Number(values.price || 0) < 0) {
    errors.price = 'Harga jual tidak boleh negatif';
  }

  if (Number(values.hppPerUnit || 0) < 0) {
    errors.hppPerUnit = 'HPP tidak boleh negatif';
  }

  if (pricingMode === 'rule' && !values.pricingRuleId) {
    errors.pricingRuleId = 'Pricing rule wajib dipilih untuk mode Rule';
  }

  if (Number(values.minStockAlert || 0) < 0) {
    errors.minStockAlert = 'Minimum stok tidak boleh negatif';
  }

  if (hasVariants) {
    const variants = normalizeColorVariants(values.variants || []);
    if (variants.length === 0) {
      errors.variants = 'Minimal harus ada 1 varian';
    }
    Object.assign(errors, validateDuplicateVariantColors(variants));
  } else {
    if (Number(values.currentStock || 0) < 0) {
      errors.currentStock = 'Stok tidak boleh negatif';
    }
    if (Number(values.reservedStock || 0) < 0) {
      errors.reservedStock = 'Reserved stock tidak boleh negatif';
    }
  }

  if (productName) {
    const q = query(collection(db, COLLECTION_NAME), where('name', '==', productName));
    const snapshot = await getDocs(q);
    const duplicate = snapshot.docs.find((item) => item.id !== editingId);
    if (duplicate) {
      errors.name = 'Nama produk sudah digunakan';
    }
  }

  return errors;
};

export const listenProducts = (callback, onError) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((item) => enrichProduct({ id: item.id, ...item.data() })));
    },
    onError,
  );
};

export const generateProductCode = async (values = {}, excludeId = null) => {
  // IMS NOTE [AKTIF | internal-sequence-code]: Product baru memakai kode internal PRD-001 agar UI fokus ke nama produk, bukan kode semantic panjang.
  return generateUniqueSequentialCode({
    db,
    collectionName: COLLECTION_NAME,
    fieldNames: ['code', 'productCode', 'sku'],
    prefix: 'PRD',
    excludeId,
  });
};

const assertProductCodeAvailable = async (code = '', editingId = null) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return;

  const exists = await isBusinessCodeExists({
    db,
    collectionName: COLLECTION_NAME,
    fieldNames: ['code', 'productCode', 'sku'],
    value: normalizedCode,
    excludeId: editingId,
  });

  if (exists) {
    throw { type: 'validation', errors: { code: 'Kode produk sudah digunakan' } };
  }
};

export const createProduct = async (values = {}, categories = []) => {
  const errors = await validateProductPayload(values, null);
  if (Object.keys(errors).length > 0) {
    throw { type: 'validation', errors };
  }

  /* =====================================================
  SECTION: Product service auto-generates hidden internal code — AKTIF
  Fungsi:
  - Menjamin Product baru tetap memiliki kode PRD internal walaupun UI tidak mengirim field code.

  Dipakai oleh:
  - Products.jsx saat create Product dan helper businessCodeGenerator.

  Alasan perubahan:
  - Input code disembunyikan dari UI utama master item, tetapi field code tetap wajib tersimpan otomatis.

  Catatan cleanup:
  - Belum ada.

  Risiko:
  - Jangan mengganti dengan input manual atau random ID karena akan merusak duplicate guard dan export/audit teknis.
  ===================================================== */
  const normalizedCode = await generateProductCode(values);
  await assertProductCodeAvailable(normalizedCode, null);

  const payload = normalizeProductCreatePayload({ ...values, code: normalizedCode }, categories);
  /* =====================================================
  SECTION: Product document ID = business code — AKTIF
  Fungsi:
  - Menyimpan Product baru dengan document ID sama seperti kode PRD internal sequence.

  Dipakai oleh:
  - createProduct pada Master Data Produk.

  Alasan perubahan:
  - Data baru yang 1 dokumen = 1 referensi utama idealnya memakai internal code sebagai document ID.

  Catatan cleanup:
  - Data lama dengan random ID tetap dipertahankan dan tidak di-rename.

  Risiko:
  - Jangan mengubah update flow; relasi data lama tetap bergantung id existing.
  ===================================================== */
  const ref = doc(db, COLLECTION_NAME, normalizedCode);
  await setDoc(ref, payload);
  return ref.id;
};

export const updateProduct = async (id, values = {}, categories = []) => {
  const errors = await validateProductPayload(values, id);
  if (Object.keys(errors).length > 0) {
    throw { type: 'validation', errors };
  }

  const ref = doc(db, COLLECTION_NAME, id);
  const existingSnapshot = await getDoc(ref);
  if (!existingSnapshot.exists()) {
    throw new Error('Produk tidak ditemukan.');
  }

  const existingProductBeforeUpdate = enrichProduct({ id: existingSnapshot.id, ...existingSnapshot.data() });
  // IMS NOTE [AKTIF | immutable-code]: UI tidak mengirim code; update wajib mempertahankan code existing agar edit nama/kategori tidak regenerate kode PRD.
  const submittedCode = String(values.code || '').trim().toUpperCase();
  const existingCode = String(existingProductBeforeUpdate.code || existingProductBeforeUpdate.productCode || '').trim().toUpperCase();
  const normalizedCode = existingCode || submittedCode || (await generateProductCode(values, id));
  await assertProductCodeAvailable(normalizedCode, id);

  // IMS NOTE [GUARDED | behavior-preserving terhadap stok]: update metadata
  // memakai transaction supaya merge variant tidak menimpa Stock Adjustment terbaru.
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) {
      throw new Error('Produk tidak ditemukan.');
    }

    const existingProduct = enrichProduct({ id: snapshot.id, ...snapshot.data() });
    const payload = normalizeProductMetadataPayload({ ...values, code: normalizedCode }, categories, existingProduct);
    transaction.update(ref, payload);
  });

  return id;
};

export const toggleProductActive = async (id, isActive) => {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    isActive: Boolean(isActive),
    updatedAt: serverTimestamp(),
  });
  return id;
};
