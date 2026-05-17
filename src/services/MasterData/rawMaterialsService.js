import {
  collection,
  deleteDoc,
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
  calculateRawMaterialVariantTotals,
  enrichRawMaterialWithVariantTotals,
  normalizeRawMaterialVariants,
} from '../../utils/variants/rawMaterialVariantHelpers';
import {
  appendVariantModeHistory,
  archiveActiveVariantsForModeDisable,
  areAllVariantsStockEmpty,
  buildVariantModeHistoryEntry,
  isVariantStockEmpty,
  reconcileVariantArchiveState,
} from '../../utils/variants/variantArchiveHelpers';
import { toNumber } from '../../utils/stock/stockHelpers';
import {
  getSupplierDisplayName,
  getSupplierLink,
  getSupplierReferenceId,
} from './suppliersService';

const COLLECTION_NAME = 'raw_materials';

// IMS NOTE [AKTIF | behavior-preserving]: default form tetap di service supaya
// halaman create/edit Raw Material memakai struktur awal yang sama.
export const RAW_MATERIAL_DEFAULT_FORM = {
  code: '',
  name: '',
  supplierId: null,
  stockUnit: 'pcs',
  stock: 0,
  minStock: 0,
  restockReferencePrice: 0,
  averageActualUnitCost: 0,
  sellingPrice: 0,
  pricingMode: 'manual',
  pricingRuleId: null,
  hasVariants: false,
  variantLabel: 'Varian',
  variants: [],
  isActive: true,
};

const enrichRawMaterial = (item = {}) => {
  const activeVariants = (Array.isArray(item.variants) ? item.variants : []).filter((variant) => variant?.isArchived !== true);
  const activeVariantOptions = (Array.isArray(item.variantOptions) ? item.variantOptions : []).filter((variant) => variant?.isArchived !== true);

  return enrichRawMaterialWithVariantTotals({
    ...item,
    variants: activeVariants,
    variantOptions: activeVariantOptions,
    isActive: item.isActive !== false,
  });
};

const inferHasVariants = (item = {}) =>
  item?.hasVariants === true
  || item?.hasVariantOptions === true
  || (Array.isArray(item?.variants) && item.variants.some((variant) => variant?.isArchived !== true))
  || (Array.isArray(item?.variantOptions) && item.variantOptions.some((variant) => variant?.isArchived !== true));

const toStockNumber = (value = 0) => Math.round(toNumber(value || 0));

const resolveSupplierSnapshot = (values = {}, suppliers = []) => {
  const selectedSupplier = (suppliers || []).find((item) => String(item.id) === String(values.supplierId));

  return {
    supplierId: getSupplierReferenceId(selectedSupplier, values.supplierId),
    supplierName: getSupplierDisplayName(selectedSupplier) || null,
    supplierLink: getSupplierLink(selectedSupplier) || null,
  };
};

const resolveRawMaterialMetadata = (values = {}, suppliers = [], existingMaterial = {}) => ({
  code: String(values.code || '').trim().toUpperCase(),
  materialCode: String(values.code || '').trim().toUpperCase(),
  name: String(values.name || '').trim(),
  ...resolveSupplierSnapshot(values, suppliers),
  stockUnit: values.stockUnit || existingMaterial.stockUnit || 'pcs',
  // IMS NOTE [AKTIF | pricing-optional]: Raw Material baru default Manual agar
  // tambah bahan tidak wajib punya Pricing Rule. Mode Rule tetap mewajibkan rule.
  pricingMode: values.pricingMode === 'rule' ? 'rule' : 'manual',
  pricingRuleId: values.pricingMode === 'rule' ? values.pricingRuleId || null : null,
  minStock: toStockNumber(values.minStock || 0),
  restockReferencePrice: toStockNumber(values.restockReferencePrice || 0),
  averageActualUnitCost: toStockNumber(values.averageActualUnitCost || 0),
  sellingPrice: toStockNumber(values.sellingPrice || 0),
  isActive: values.isActive !== false,
  updatedAt: serverTimestamp(),
  lastPricingUpdatedAt: values.pricingMode === 'manual' ? serverTimestamp() : null,
});

const normalizeRawMaterialCreatePayload = (values = {}, suppliers = []) => {
  const hasVariants = values.hasVariants === true;
  const variants = hasVariants ? normalizeRawMaterialVariants(values.variants || []) : [];
  const variantTotals = calculateRawMaterialVariantTotals(variants);
  const stock = hasVariants ? toStockNumber(variantTotals.currentStock || 0) : toStockNumber(values.stock || 0);
  const reservedStock = hasVariants ? toStockNumber(variantTotals.reservedStock || 0) : toStockNumber(values.reservedStock || 0);

  // IMS NOTE [AKTIF | behavior-preserving]: jalur create masih menulis stok awal.
  // Hubungan flow: raw material baru boleh punya stok awal sebelum masuk purchase/adjustment resmi.
  return {
    ...resolveRawMaterialMetadata(values, suppliers),
    hasVariants,
    hasVariantOptions: hasVariants,
    variantLabel: hasVariants ? String(values.variantLabel || '').trim() : '',
    variants,
    variantOptions: variants,
    variantCount: hasVariants ? variantTotals.variantCount : 0,
    activeVariantCount: hasVariants ? variantTotals.activeVariantCount : 0,
    // IMS NOTE [LEGACY | behavior-preserving]: stock dipertahankan sebagai alias currentStock.
    stock,
    currentStock: stock,
    reservedStock,
    availableStock: Math.max(stock - reservedStock, 0),
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

const normalizeZeroStockRawVariants = (variants = []) =>
  normalizeRawMaterialVariants(variants).map((variant) => ({
    ...variant,
    // IMS NOTE [GUARDED | stok-awal-existing]: varian baru dari raw material
    // existing selalu mulai 0. Hubungan flow: stok bahan setelah create harus
    // lewat Purchase, Stock Adjustment, atau transaksi resmi.
    currentStock: 0,
    stock: 0,
    reservedStock: 0,
    availableStock: 0,
    isActive: true,
    isArchived: false,
  }));

const buildRawVariantKeyCandidates = (variant = {}) => [
  variant.variantKey,
  variant.variantCode,
  variant.sku,
  variant.variantName,
  variant.name,
]
  .map((value) => String(value || '').trim().toLowerCase())
  .filter(Boolean);

const buildRawVariantLookup = (variants = []) => {
  const lookup = new Map();
  normalizeRawMaterialVariants(variants).forEach((variant, index) => {
    buildRawVariantKeyCandidates(variant, index).forEach((key) => {
      if (!lookup.has(key)) lookup.set(key, variant);
    });
  });
  return lookup;
};

const hasProtectedVariantStock = (variant = {}) => {
  // IMS NOTE [GUARDED | stok-varian]: hapus/archive varian ditolak bila salah satu
  // bucket stok masih bernilai. Hubungan flow: mencegah bucket stok/reference
  // hilang dari master tanpa Purchase/Stock Adjustment/transaksi resmi. STATUS: AKTIF.
  return !isVariantStockEmpty(variant);
};

const assertNoRawVariantWithStockRemoved = (editedVariants = [], existingVariants = []) => {
  const editedLookup = buildRawVariantLookup(editedVariants);

  normalizeRawMaterialVariants(existingVariants).forEach((variant, index) => {
    const stillExists = buildRawVariantKeyCandidates(variant, index).some((key) => editedLookup.has(key));

    if (!stillExists && hasProtectedVariantStock(variant)) {
      throw {
        type: 'validation',
        errors: {
          variants: 'Varian yang masih punya stock/reserved tidak boleh dihapus dari master. Nolkan lewat purchase/adjustment resmi lebih dulu.',
        },
      };
    }
  });
};

const validateDuplicateRawVariantNames = (variants = []) => {
  const errors = {};
  const seen = new Set();

  normalizeRawMaterialVariants(variants).forEach((item, index) => {
    const key = String(item.name || '').toLowerCase();
    if (seen.has(key)) {
      errors[`variants.${index}.name`] = 'Nama varian tidak boleh duplikat';
    }
    seen.add(key);
  });

  return errors;
};

const mergeRawVariantMetadataWithExistingStock = (
  editedVariants = [],
  existingVariants = [],
  archivedVariants = [],
  options = {},
) => {
  const normalizedEdited = normalizeRawMaterialVariants(editedVariants);
  const normalizedExisting = normalizeRawMaterialVariants(existingVariants);

  if (normalizedEdited.length === 0) {
    throw { type: 'validation', errors: { variants: 'Minimal harus ada 1 varian' } };
  }

  const duplicateErrors = validateDuplicateRawVariantNames(normalizedEdited);
  if (Object.keys(duplicateErrors).length > 0) {
    throw { type: 'validation', errors: duplicateErrors };
  }

  assertNoRawVariantWithStockRemoved(normalizedEdited, normalizedExisting);

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
    isActive: true,
    isArchived: false,
  });

  return reconcileVariantArchiveState({
    editedVariants: normalizedEdited,
    existingVariants: normalizedExisting,
    archivedVariants,
    normalizeVariants: normalizeRawMaterialVariants,
    mergeActiveVariant,
    buildNewVariant,
    protectedRemovalMessage: 'Varian bahan yang masih punya stock/reserved tidak boleh diarsipkan. Nolkan lewat purchase/adjustment resmi lebih dulu.',
    duplicateActiveMessage: 'Nama varian aktif tidak boleh duplikat',
    now: options.now,
    actor: options.actor,
    archiveReason: options.archiveReason || 'Varian bahan baku diarsipkan dari edit master setelah stok 0.',
    restoreReason: options.restoreReason || 'Varian bahan baku lama direstore karena dibuat lagi dengan struktur yang sama.',
  });
};

const normalizeRawMaterialMetadataPayload = (values = {}, suppliers = [], existingMaterial = {}) => {
  const existingActiveVariants = (Array.isArray(existingMaterial.variants) ? existingMaterial.variants : existingMaterial.variantOptions || [])
    .filter((variant) => variant?.isArchived !== true);
  const existingArchivedVariants = Array.isArray(existingMaterial.archivedVariants)
    ? existingMaterial.archivedVariants
    : [];
  const existingHasVariants = inferHasVariants(existingMaterial);
  const wantsVariants = values.hasVariants === true;
  const canActivateVariants = !existingHasVariants && wantsVariants;
  const hasVariants = wantsVariants;
  const now = new Date().toISOString();
  const actor = 'system';
  const payload = {
    ...resolveRawMaterialMetadata(values, suppliers, existingMaterial),
    hasVariants,
    hasVariantOptions: hasVariants,
    variantLabel: hasVariants ? String(values.variantLabel || existingMaterial.variantLabel || 'Varian').trim() : '',
  };

  /* =====================================================
  SECTION: Raw Material Variant Archive/Restore Guard — GUARDED
  Fungsi:
  - Menjadi guard service utama untuk OFF mode varian, archive varian stok 0, restore archived variant, dan duplicate active guard Raw Material.

  Dipakai oleh:
  - updateRawMaterial transaction setelah membaca dokumen Raw Material terbaru dan drawer Raw Material.

  Alasan perubahan:
  - Varian bahan boleh fleksibel saat semua stok 0, tetapi variantKey/variantOptions lama harus tetap aman untuk histori purchase/adjustment.

  Catatan cleanup:
  - Jika UI nanti mengirim audit user, actor dapat diganti dari system ke user email tanpa mengubah bentuk archive.

  Risiko:
  - Jika guard ini dilepas, client lama bisa hard delete variantOptions atau membuat duplicate variantKey bahan.
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
      archiveReason: 'Mode varian bahan baku dimatikan setelah semua stok varian 0.',
    });

    return {
      ...payload,
      hasVariants: false,
      hasVariantOptions: false,
      variantLabel: '',
      variants: [],
      variantOptions: [],
      archivedVariants: archiveResult.archivedVariants,
      variantModeHistory: appendVariantModeHistory(existingMaterial.variantModeHistory, archiveResult.historyEntries),
      variantCount: 0,
      activeVariantCount: 0,
      stock: 0,
      currentStock: 0,
      reservedStock: 0,
      availableStock: 0,
    };
  }

  if (canActivateVariants) {
    if (hasProtectedMasterStock(existingMaterial)) {
      throw {
        type: 'validation',
        errors: {
          hasVariants: 'Aktifkan varian hanya untuk bahan lama dengan stok, reserved, dan available stock 0. Nolkan/alokasikan stok lewat Purchase/Stock Adjustment resmi lebih dulu.',
        },
      };
    }

    const convertedVariants = normalizeZeroStockRawVariants(values.variants || []);
    if (convertedVariants.length === 0) {
      throw { type: 'validation', errors: { variants: 'Minimal harus ada 1 varian' } };
    }

    const duplicateErrors = validateDuplicateRawVariantNames(convertedVariants);
    if (Object.keys(duplicateErrors).length > 0) {
      throw { type: 'validation', errors: duplicateErrors };
    }

    const mergeResult = mergeRawVariantMetadataWithExistingStock(
      convertedVariants,
      [],
      existingArchivedVariants,
      {
        now,
        actor,
        restoreReason: 'Varian bahan baku lama direstore saat mode varian diaktifkan kembali.',
      },
    );
    const totals = calculateRawMaterialVariantTotals(mergeResult.activeVariants);
    const historyEntries = [
      buildVariantModeHistoryEntry('variant_mode_enabled', {
        now,
        actor,
        reason: 'Mode varian bahan baku diaktifkan dari item stok master 0.',
      }),
      ...mergeResult.historyEntries,
    ];

    return {
      ...payload,
      variants: totals.variants,
      variantOptions: totals.variants,
      archivedVariants: mergeResult.archivedVariants,
      variantModeHistory: appendVariantModeHistory(existingMaterial.variantModeHistory, historyEntries),
      variantCount: totals.variantCount,
      activeVariantCount: totals.activeVariantCount,
      stock: 0,
      currentStock: 0,
      reservedStock: 0,
      availableStock: 0,
    };
  }

  if (!hasVariants) {
    return {
      ...payload,
      hasVariants: false,
      hasVariantOptions: false,
      variantLabel: '',
      variants: [],
      variantOptions: [],
      archivedVariants: existingArchivedVariants,
      variantCount: 0,
      activeVariantCount: 0,
    };
  }

  const mergeResult = mergeRawVariantMetadataWithExistingStock(
    values.variants || [],
    existingActiveVariants,
    existingArchivedVariants,
    { now, actor },
  );
  const totals = calculateRawMaterialVariantTotals(mergeResult.activeVariants);

  return {
    ...payload,
    variants: totals.variants,
    variantOptions: totals.variants,
    archivedVariants: mergeResult.archivedVariants,
    variantModeHistory: appendVariantModeHistory(existingMaterial.variantModeHistory, mergeResult.historyEntries),
    variantCount: totals.variantCount,
    activeVariantCount: totals.activeVariantCount,
    stock: totals.currentStock,
    currentStock: totals.currentStock,
    reservedStock: totals.reservedStock,
    availableStock: totals.availableStock,
  };
};

export const validateRawMaterialPayload = async (values = {}, editingId = null) => {
  const errors = {};
  const materialName = String(values.name || '').trim();
  const hasVariants = values.hasVariants === true;
  const pricingMode = values.pricingMode === 'rule' ? 'rule' : 'manual';

  if (!materialName) {
    errors.name = 'Nama bahan baku wajib diisi';
  }

  if (!values.stockUnit) {
    errors.stockUnit = 'Satuan stok wajib dipilih';
  }

  if (hasVariants) {
    const variants = normalizeRawMaterialVariants(values.variants || []);
    if (variants.length === 0) {
      errors.variants = 'Minimal harus ada 1 varian';
    }
    Object.assign(errors, validateDuplicateRawVariantNames(variants));
  } else if (toNumber(values.stock || 0) < 0) {
    errors.stock = 'Stok tidak boleh negatif';
  }

  if (toNumber(values.minStock || 0) < 0) {
    errors.minStock = 'Minimum stok tidak boleh negatif';
  }

  if (toNumber(values.restockReferencePrice || 0) < 0) {
    errors.restockReferencePrice = 'Harga referensi restock tidak boleh negatif';
  }

  if (toNumber(values.averageActualUnitCost || 0) < 0) {
    errors.averageActualUnitCost = 'Modal aktual rata-rata tidak boleh negatif';
  }

  if (toNumber(values.sellingPrice || 0) < 0) {
    errors.sellingPrice = 'Harga jual tidak boleh negatif';
  }

  if (pricingMode === 'rule' && !values.pricingRuleId) {
    errors.pricingRuleId = 'Pricing rule wajib dipilih untuk mode Rule';
  }

  if (materialName) {
    const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), where('name', '==', materialName)));
    const duplicate = snapshot.docs.find((item) => item.id !== editingId);
    if (duplicate) {
      errors.name = 'Nama bahan baku sudah digunakan';
    }
  }

  return errors;
};

export const listenRawMaterials = (callback, onError) => {
  const q = query(collection(db, COLLECTION_NAME), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map((item) => enrichRawMaterial({ id: item.id, ...item.data() })));
    },
    onError,
  );
};

export const generateRawMaterialCode = async (values = {}, excludeId = null) => {
  // IMS NOTE [LEGACY-COMPAT | lint-safe-signature]: values tetap diterima agar caller lama tidak perlu diubah, meski kode RAW sekarang berbasis sequence internal.
  void values;
  // IMS NOTE [AKTIF | internal-sequence-code]: Raw Material baru memakai kode internal RAW-001 agar UI tetap clean dan nama/supplier menjadi identitas utama.
  return generateUniqueSequentialCode({
    db,
    collectionName: COLLECTION_NAME,
    fieldNames: ['code', 'materialCode', 'sku'],
    prefix: 'RAW',
    excludeId,
  });
};

const assertRawMaterialCodeAvailable = async (code = '', editingId = null) => {
  const normalizedCode = String(code || '').trim().toUpperCase();
  if (!normalizedCode) return;

  const exists = await isBusinessCodeExists({
    db,
    collectionName: COLLECTION_NAME,
    fieldNames: ['code', 'materialCode', 'sku'],
    value: normalizedCode,
    excludeId: editingId,
  });

  if (exists) {
    throw { type: 'validation', errors: { code: 'Kode raw material sudah digunakan' } };
  }
};

export const createRawMaterial = async (values = {}, suppliers = []) => {
  const errors = await validateRawMaterialPayload(values, null);
  if (Object.keys(errors).length > 0) {
    throw { type: 'validation', errors };
  }

  /* =====================================================
  SECTION: Raw Material service auto-generates hidden internal code — AKTIF
  Fungsi:
  - Menjamin Raw Material baru tetap memiliki kode RAW internal walaupun UI tidak mengirim field code.

  Dipakai oleh:
  - RawMaterials.jsx saat create Raw Material dan helper businessCodeGenerator.

  Alasan perubahan:
  - Input code disembunyikan dari UI utama master item, tetapi field code tetap wajib tersimpan otomatis.

  Catatan cleanup:
  - Belum ada.

  Risiko:
  - Jangan mengganti dengan input manual atau random ID karena supplier, stok, export, dan audit teknis masih memakai reference internal.
  ===================================================== */
  const normalizedCode = await generateRawMaterialCode(values);
  await assertRawMaterialCodeAvailable(normalizedCode, null);

  const payload = normalizeRawMaterialCreatePayload({ ...values, code: normalizedCode }, suppliers);
  /* =====================================================
  SECTION: Raw Material document ID = business code — AKTIF
  Fungsi:
  - Menyimpan Raw Material baru dengan document ID sama seperti kode RAW internal sequence.

  Dipakai oleh:
  - createRawMaterial pada Master Data Raw Material.

  Alasan perubahan:
  - Prefix standar data baru berubah dari RM ke RAW dan document ID baru dibuat audit-friendly.

  Catatan cleanup:
  - Data lama RM/random ID tetap compatibility, tidak di-rename.

  Risiko:
  - Jangan mengubah mutation stok atau supplier catalog dari section ini.
  ===================================================== */
  const ref = doc(db, COLLECTION_NAME, normalizedCode);
  await setDoc(ref, payload);
  return ref.id;
};

export const updateRawMaterial = async (id, values = {}, suppliers = []) => {
  const errors = await validateRawMaterialPayload(values, id);
  if (Object.keys(errors).length > 0) {
    throw { type: 'validation', errors };
  }

  const ref = doc(db, COLLECTION_NAME, id);
  const existingSnapshot = await getDoc(ref);
  if (!existingSnapshot.exists()) {
    throw new Error('Bahan baku tidak ditemukan.');
  }

  const existingMaterialBeforeUpdate = enrichRawMaterial({ id: existingSnapshot.id, ...existingSnapshot.data() });
  // IMS NOTE [AKTIF | immutable-code]: UI tidak mengirim code; update wajib mempertahankan code existing agar edit nama/supplier tidak regenerate kode RAW.
  const submittedCode = String(values.code || '').trim().toUpperCase();
  const existingCode = String(existingMaterialBeforeUpdate.code || existingMaterialBeforeUpdate.materialCode || '').trim().toUpperCase();
  const normalizedCode = existingCode || submittedCode || (await generateRawMaterialCode(values, id));
  await assertRawMaterialCodeAvailable(normalizedCode, id);

  // IMS NOTE [GUARDED | behavior-preserving terhadap stok]: update raw material
  // memakai transaction agar merge variant tidak menimpa purchase/adjustment terbaru.
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) {
      throw new Error('Bahan baku tidak ditemukan.');
    }

    const existingMaterial = enrichRawMaterial({ id: snapshot.id, ...snapshot.data() });
    const payload = normalizeRawMaterialMetadataPayload({ ...values, code: normalizedCode }, suppliers, existingMaterial);
    transaction.update(ref, payload);
  });

  return id;
};

export const removeRawMaterial = async (id) => {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
  return id;
};

export const toggleRawMaterialActive = async (id, isActive) => {
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    isActive: Boolean(isActive),
    updatedAt: serverTimestamp(),
  });
  return id;
};
