// =====================================================
// Semi Finished Materials Service
// CRUD Firestore untuk collection semi_finished_materials
// Mendukung item dengan atau tanpa varian.
// =====================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  generateUniqueProductionSequentialCode,
  prepareUniqueProductionSequentialCodeInTransaction,
  isProductionBusinessCodeExists,
} from "../../utils/references/productionCodeGenerator";
import {
  getSequentialBusinessCodeSequence,
} from "../../utils/references/businessCodeGenerator";
import {
  calculateSemiFinishedTotalsFromVariants,
  normalizeSemiFinishedVariants,
} from "../../constants/semiFinishedMaterialOptions";

const COLLECTION_NAME = "semi_finished_materials";

const inferHasVariants = (item = {}) =>
  item?.hasVariants === true || (Array.isArray(item?.variants) && item.variants.length > 0);

const toStockNumber = (value = 0) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.round(number) : 0;
};

/* =====================================================
SECTION: Semi Finished Master Minimum Stock Resolver — AKTIF
Fungsi:
- menetapkan `semi_finished_materials.minStockAlert` sebagai threshold minimum stok master untuk item varian dan non-varian.

Dipakai oleh:
- create/update/read Semi Finished Materials melalui service produksi dan halaman SemiFinishedMaterials.

Alasan perubahan:
- variant Semi Finished hanya bucket stok fisik/average cost; `variants[].minStockAlert` lama dipertahankan sebagai legacy-compat tetapi tidak lagi menjadi source master.

Catatan cleanup:
- audit field legacy `variants[].minStockAlert` dapat dibuat terpisah tanpa migrasi massal pada batch ini.

Risiko:
- jika resolver ini diubah kembali ke total varian, status Perlu Dicek Semi Finished bisa berbeda dari input master user.
===================================================== */
const resolveSemiFinishedMasterMinStockAlert = (values = {}) => toStockNumber(values.minStockAlert || 0);

const toNumberValue = (value = 0) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const normalizeMetadataText = (value = "") => String(value || "").trim();

const resolveAuditUser = (currentUser = null) =>
  currentUser?.email || currentUser?.displayName || currentUser?.uid || "system";


const hasProtectedMasterStock = (item = {}) => {
  const currentStock = toStockNumber(item.currentStock ?? item.stock ?? 0);
  const reservedStock = toStockNumber(item.reservedStock || 0);
  const availableStock = toStockNumber(
    item.availableStock ?? Math.max(currentStock - reservedStock, 0),
  );

  return currentStock > 0 || reservedStock > 0 || availableStock > 0;
};

const normalizeZeroStockSemiVariants = (variants = []) =>
  normalizeSemiFinishedVariants(variants).map((variant) => ({
    ...variant,
    // IMS NOTE [GUARDED | stok-awal-existing]: varian baru dari Semi Product
    // existing selalu mulai 0. Hubungan flow: stok semi setelah create harus
    // lewat Stock Adjustment/produksi/transaksi resmi, bukan edit master.
    currentStock: 0,
    stock: 0,
    reservedStock: 0,
    availableStock: 0,
  }));

const enrichMaterialWithVariantTotals = (item = {}) => {
  const hasVariants = inferHasVariants(item);
  const variants = hasVariants ? normalizeSemiFinishedVariants(item.variants || []) : [];

  if (!hasVariants || variants.length === 0) {
    const currentStock = Number(item.currentStock ?? item.stock ?? 0);
    const reservedStock = Number(item.reservedStock || 0);
    const availableStock = Math.max(currentStock - reservedStock, 0);

    return {
      ...item,
      hasVariants,
      // IMS NOTE [AKTIF | legacy-active-default]: data lama yang belum punya field isActive
      // tetap dibaca aktif seperti Product/Raw Material; hanya false eksplisit yang nonaktif.
      isActive: item.isActive !== false,
      variants,
      currentStock,
      // IMS NOTE [LEGACY | behavior-preserving]: stock tetap alias currentStock
      // agar data lama semi finished masih terbaca tanpa migrasi otomatis.
      stock: currentStock,
      reservedStock,
      availableStock,
      minStockAlert: resolveSemiFinishedMasterMinStockAlert(item),
      averageCostPerUnit: Number(item.averageCostPerUnit || 0),
      variantCount: variants.length,
      activeVariantCount: variants.filter((variant) => variant.isActive !== false).length,
    };
  }

  const totals = calculateSemiFinishedTotalsFromVariants(variants);

  return {
    ...item,
    hasVariants,
    // IMS NOTE [AKTIF | legacy-active-default]: data lama yang belum punya field isActive
    // tetap dibaca aktif seperti Product/Raw Material; hanya false eksplisit yang nonaktif.
    isActive: item.isActive !== false,
    ...totals,
    minStockAlert: resolveSemiFinishedMasterMinStockAlert(item),
  };
};

const resolveSemiFinishedMetadata = (
  values = {},
  currentUser = null,
  selectedProducts = [],
) => ({
  code: String(values.code || "")
    .trim()
    .toUpperCase(),
  name: String(values.name || "").trim(),
  description: String(values.description || "").trim(),
  category: values.category || "kelopak",
  // IMS NOTE [GUARDED | no-silent-mawar-default]: service tidak boleh fallback
  // ke Mawar. Jika caller tidak mengirim Jenis Bunga, validasi harus gagal
  // agar data Semi Product jenis lain tidak salah masuk group Mawar.
  flowerGroup: normalizeMetadataText(values.flowerGroup),
  type: "semi_finished",
  unit: values.unit || "pcs",
  relatedProductIds: selectedProducts.map((item) => item.id),
  relatedProductNames: selectedProducts.map((item) => item.name || ""),
  minStockAlert: resolveSemiFinishedMasterMinStockAlert(values),
  averageCostPerUnit: toNumberValue(values.averageCostPerUnit || 0),
  isActive: values.isActive !== false,
  isSellable: false,
  variantLabel: values.hasVariants === true ? String(values.variantLabel || 'Varian').trim() || 'Varian' : '',
  updatedAt: serverTimestamp(),
  updatedBy: resolveAuditUser(currentUser),
});

const normalizeSemiFinishedCreatePayload = (
  values = {},
  currentUser = null,
  selectedProducts = [],
) => {
  const hasVariants = values.hasVariants === true;
  const normalizedVariants = hasVariants ? normalizeSemiFinishedVariants(values.variants || []) : [];
  const variantTotals = calculateSemiFinishedTotalsFromVariants(normalizedVariants);
  const currentStock = hasVariants ? variantTotals.currentStock : toNumberValue(values.currentStock || 0);
  const reservedStock = hasVariants ? variantTotals.reservedStock : toNumberValue(values.reservedStock || 0);
  const minStockAlert = resolveSemiFinishedMasterMinStockAlert(values);
  const averageCostPerUnit = hasVariants
    ? toNumberValue(variantTotals.averageCostPerUnit || 0)
    : toNumberValue(values.averageCostPerUnit || 0);

  // IMS NOTE [AKTIF | behavior-preserving]: create semi finished tetap menulis
  // stok awal sebelum item masuk flow produksi resmi.
  return {
    ...resolveSemiFinishedMetadata(values, currentUser, selectedProducts),
    hasVariants,
    variants: normalizedVariants,
    variantCount: hasVariants ? variantTotals.variantCount : 0,
    activeVariantCount: hasVariants ? variantTotals.activeVariantCount : 0,
    currentStock,
    // IMS NOTE [LEGACY | behavior-preserving]: stock dipertahankan sebagai alias currentStock.
    stock: currentStock,
    reservedStock,
    availableStock: Math.max(currentStock - reservedStock, 0),
    minStockAlert,
    averageCostPerUnit,
    createdAt: serverTimestamp(),
    createdBy: resolveAuditUser(currentUser),
  };
};

const normalizeSemiVariantLookupKey = (value = "") =>
  String(value || "").trim().toLowerCase();

// IMS NOTE [GUARDED | identity-safe]: matching varian semi finished tetap
// memprioritaskan variantKey lama. Hubungan flow: variantKey adalah bucket
// stok/reference PO/Work Log, sedangkan color boleh berubah sebagai metadata
// display. STATUS: AKTIF untuk update metadata varian tanpa migrasi transaksi.
const buildSemiVariantKeyCandidates = (variant = {}) => [
  variant.variantKey,
  variant.sku,
  variant.color,
  variant.name,
]
  .map(normalizeSemiVariantLookupKey)
  .filter(Boolean);

const buildSemiVariantLookup = (variants = []) => {
  const lookup = new Map();
  normalizeSemiFinishedVariants(variants).forEach((variant, index) => {
    buildSemiVariantKeyCandidates(variant, index).forEach((key) => {
      if (!lookup.has(key)) lookup.set(key, variant);
    });
  });
  return lookup;
};

const findExistingSemiVariant = (variant = {}, existingLookup = new Map(), index = 0) =>
  buildSemiVariantKeyCandidates(variant, index)
    .map((key) => existingLookup.get(key))
    .find(Boolean);

const resolveSemiVariantDisplayValue = (variant = {}, existingVariant = {}) =>
  String(variant.color || variant.name || variant.variantLabel || existingVariant.color || existingVariant.name || "")
    .trim();

const hasProtectedVariantStock = (variant = {}) => {
  const currentStock = toStockNumber(variant.currentStock ?? variant.stock ?? 0);
  const reservedStock = toStockNumber(variant.reservedStock || 0);
  const availableStock = toStockNumber(variant.availableStock ?? Math.max(currentStock - reservedStock, 0));

  // IMS NOTE [GUARDED | stok-varian]: hapus varian ditolak bila salah satu
  // bucket stok masih bernilai. Hubungan flow: mencegah bucket stok/reference
  // hilang dari master tanpa Stock Adjustment/transaksi resmi. STATUS: AKTIF.
  return currentStock > 0 || reservedStock > 0 || availableStock > 0;
};

const assertNoSemiVariantWithStockRemoved = (editedVariants = [], existingVariants = []) => {
  const editedLookup = buildSemiVariantLookup(editedVariants);

  normalizeSemiFinishedVariants(existingVariants).forEach((variant, index) => {
    const stillExists = buildSemiVariantKeyCandidates(variant, index).some((key) => editedLookup.has(key));

    if (!stillExists && hasProtectedVariantStock(variant)) {
      throw {
        type: "validation",
        errors: {
          variants: "Varian yang masih punya stock/reserved tidak boleh dihapus dari master. Gunakan flow produksi/adjustment resmi terlebih dulu.",
        },
      };
    }
  });
};

const validateDuplicateSemiVariantNames = (variants = []) => {
  const errors = {};
  const usedNames = new Set();

  normalizeSemiFinishedVariants(variants).forEach((item, index) => {
    const key = String(item.color || item.name || "").trim().toLowerCase();
    if (usedNames.has(key)) {
      errors[`variants.${index}.color`] = "Nama varian tidak boleh duplikat";
    }
    usedNames.add(key);
  });

  return errors;
};

const mergeSemiVariantMetadataWithExistingStock = (editedVariants = [], existingVariants = []) => {
  const normalizedEdited = normalizeSemiFinishedVariants(editedVariants);
  const normalizedExisting = normalizeSemiFinishedVariants(existingVariants);

  if (normalizedEdited.length === 0) {
    throw { type: "validation", errors: { variants: "Minimal harus ada 1 varian" } };
  }

  assertNoSemiVariantWithStockRemoved(normalizedEdited, normalizedExisting);

  const existingLookup = buildSemiVariantLookup(normalizedExisting);

  const mergedVariants = normalizedEdited.map((variant, index) => {
    const existingVariant = findExistingSemiVariant(variant, existingLookup, index);

    const displayValue = resolveSemiVariantDisplayValue(variant, existingVariant);
    const currentStock = existingVariant
      ? toNumberValue(existingVariant.currentStock ?? existingVariant.stock ?? 0)
      : 0;
    const reservedStock = existingVariant
      ? toNumberValue(existingVariant.reservedStock || 0)
      : 0;

    // IMS NOTE [GUARDED | identity-safe]: edit warna semi finished adalah rename
    // display/metadata. variantKey existing tetap dipakai agar bucket stok, PO,
    // Work Log, HPP, dan inventory log lama tidak perlu dimigrasi. STATUS: AKTIF.
    return {
      ...variant,
      variantKey: existingVariant?.variantKey || variant.variantKey,
      color: displayValue,
      name: displayValue,
      variantLabel: displayValue,
      label: displayValue,
      currentStock,
      stock: currentStock,
      reservedStock,
      availableStock: Math.max(currentStock - reservedStock, 0),
      minStockAlert: toStockNumber(variant.minStockAlert ?? existingVariant?.minStockAlert ?? 0),
      averageCostPerUnit: toNumberValue(
        variant.averageCostPerUnit ?? existingVariant?.averageCostPerUnit ?? 0,
      ),
    };
  });

  const duplicateErrors = validateDuplicateSemiVariantNames(mergedVariants);
  if (Object.keys(duplicateErrors).length > 0) {
    throw { type: "validation", errors: duplicateErrors };
  }

  return mergedVariants;
};

const normalizeSemiFinishedMetadataPayload = (
  values = {},
  currentUser = null,
  selectedProducts = [],
  existingMaterial = {},
) => {
  const existingHasVariants = inferHasVariants(existingMaterial);
  const wantsVariants = values.hasVariants === true;
  const canActivateVariants = !existingHasVariants && wantsVariants;
  const hasVariants = existingHasVariants || canActivateVariants;
  const payload = {
    ...resolveSemiFinishedMetadata(
      { ...values, hasVariants, variantLabel: values.variantLabel || existingMaterial.variantLabel || 'Varian' },
      currentUser,
      selectedProducts,
    ),
    hasVariants,
  };

  if (canActivateVariants) {
    if (hasProtectedMasterStock(existingMaterial)) {
      throw {
        type: "validation",
        errors: {
          hasVariants: "Aktifkan varian hanya untuk Semi Product lama dengan stok, reserved, dan available stock 0. Nolkan stok lewat flow resmi lebih dulu.",
        },
      };
    }

    const convertedVariants = normalizeZeroStockSemiVariants(values.variants || []);
    if (convertedVariants.length === 0) {
      throw { type: "validation", errors: { variants: "Minimal harus ada 1 varian" } };
    }

    const duplicateErrors = validateDuplicateSemiVariantNames(convertedVariants);
    if (Object.keys(duplicateErrors).length > 0) {
      throw { type: "validation", errors: duplicateErrors };
    }

    const variantTotals = calculateSemiFinishedTotalsFromVariants(convertedVariants);

    // IMS NOTE [GUARDED | konversi-varian-zero-stock]: Semi Product lama non-varian
    // boleh mulai memakai varian hanya saat stok master aman 0. Tidak ada stok
    // yang dipindah otomatis; semua varian baru mulai dari 0.
    return {
      ...payload,
      variants: variantTotals.variants,
      variantCount: variantTotals.variantCount,
      activeVariantCount: variantTotals.activeVariantCount,
      currentStock: 0,
      stock: 0,
      reservedStock: 0,
      availableStock: 0,
      minStockAlert: resolveSemiFinishedMasterMinStockAlert(values),
      averageCostPerUnit: toNumberValue(variantTotals.averageCostPerUnit || 0),
    };
  }

  if (!hasVariants) {
    // IMS NOTE [GUARDED | behavior-preserving terhadap stok]: update metadata
    // non-varian tidak mengirim stock/currentStock/reservedStock/availableStock.
    return {
      ...payload,
      variants: [],
      variantCount: 0,
      activeVariantCount: 0,
    };
  }

  const mergedVariants = mergeSemiVariantMetadataWithExistingStock(
    values.variants || [],
    existingMaterial.variants || [],
  );
  const variantTotals = calculateSemiFinishedTotalsFromVariants(mergedVariants);

  // IMS NOTE [GUARDED | behavior-preserving terhadap stok]: array variants ditulis
  // ulang hanya setelah stok existing/latest digabung kembali.
  return {
    ...payload,
    variants: variantTotals.variants,
    variantCount: variantTotals.variantCount,
    activeVariantCount: variantTotals.activeVariantCount,
    currentStock: variantTotals.currentStock,
    stock: variantTotals.currentStock,
    reservedStock: variantTotals.reservedStock,
    availableStock: variantTotals.availableStock,
    minStockAlert: resolveSemiFinishedMasterMinStockAlert(values),
    averageCostPerUnit: toNumberValue(variantTotals.averageCostPerUnit || 0),
  };
};

// =====================================================
// SECTION: Auto code Semi Finished — AKTIF
// Fungsi:
// - Generate kode item Semi Finished dari nama secara otomatis.
// - Base code tanpa suffix dipakai jika unik; suffix 3 digit hanya saat duplicate.
//
// Dipakai oleh:
// - createSemiFinishedMaterial
// - updateSemiFinishedMaterial
//
// Alasan perubahan:
// - Kode Item tidak perlu diisi manual, tetapi tetap menjadi reference bisnis yang mudah dibaca.
//
// Catatan cleanup:
// - Belum ada.
//
// Risiko:
// - Data baru memakai document ID = code, tetapi data lama tetap boleh random dan tidak di-rename.
// =====================================================
export const generateSemiFinishedMaterialCode = async (values = {}, excludeId = null) => {
  // IMS NOTE [LEGACY-COMPAT | lint-safe-signature]: values tetap diterima agar caller lama tidak perlu diubah, meski kode SFP sekarang berbasis sequence internal.
  void values;

  return generateUniqueProductionSequentialCode({
    db,
    collectionName: COLLECTION_NAME,
    fieldNames: ["code", "itemCode"],
    prefix: "SFP",
    excludeId,
  });
};

export const validateSemiFinishedMaterial = (values = {}) => {
  const errors = {};
  const hasVariants = values.hasVariants === true;
  const normalizedVariants = hasVariants
    ? normalizeSemiFinishedVariants(values.variants || [])
    : [];

  if (!String(values.name || "").trim()) {
    errors.name = "Nama semi finished wajib diisi";
  }

  if (!values.category) {
    errors.category = "Kategori wajib dipilih";
  }

  if (!normalizeMetadataText(values.flowerGroup)) {
    errors.flowerGroup = "Grup bunga wajib dipilih";
  }

  if (Number(values.minStockAlert || 0) < 0) {
    errors.minStockAlert = "Minimum stock alert tidak boleh negatif";
  }

  if (hasVariants) {
    if (normalizedVariants.length === 0) {
      errors.variants = "Minimal harus ada 1 varian";
    }

    const usedNames = new Set();

    normalizedVariants.forEach((item, index) => {
      if (!item.color) {
        errors[`variants.${index}.color`] = "Nama varian wajib diisi";
      }

      const variantNameKey = String(item.color || item.name || "").trim().toLowerCase();
      if (usedNames.has(variantNameKey)) {
        errors[`variants.${index}.color`] = "Nama varian tidak boleh duplikat";
      }
      usedNames.add(variantNameKey);

      if (Number(item.currentStock || 0) < 0) {
        errors[`variants.${index}.currentStock`] = "Stok tidak boleh negatif";
      }

      if (Number(item.reservedStock || 0) < 0) {
        errors[`variants.${index}.reservedStock`] =
          "Reserved stock tidak boleh negatif";
      }

      if (Number(item.averageCostPerUnit || 0) < 0) {
        errors[`variants.${index}.averageCostPerUnit`] =
          "Average cost tidak boleh negatif";
      }
    });
  } else {
    if (Number(values.currentStock || 0) < 0) {
      errors.currentStock = "Stok tidak boleh negatif";
    }

    if (Number(values.reservedStock || 0) < 0) {
      errors.reservedStock = "Reserved stock tidak boleh negatif";
    }

    if (Number(values.averageCostPerUnit || 0) < 0) {
      errors.averageCostPerUnit = "Average cost tidak boleh negatif";
    }
  }

  return errors;
};

export const getAllSemiFinishedMaterials = async () => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) =>
    enrichMaterialWithVariantTotals({
      id: item.id,
      ...item.data(),
    }),
  );
};

export const getActiveSemiFinishedMaterials = async () => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("isActive", "==", true),
    orderBy("name", "asc"),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) =>
    enrichMaterialWithVariantTotals({
      id: item.id,
      ...item.data(),
    }),
  );
};

export const getSemiFinishedMaterialById = async (id) => {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("Data semi finished material tidak ditemukan");
  }

  return enrichMaterialWithVariantTotals({
    id: snapshot.id,
    ...snapshot.data(),
  });
};

export const isSemiFinishedMaterialCodeExists = async (
  code,
  excludeId = null,
) => {
  const normalizedCode = String(code || "")
    .trim()
    .toUpperCase();

  if (!normalizedCode) return false;

  return isProductionBusinessCodeExists({
    db,
    collectionName: COLLECTION_NAME,
    fieldNames: ["code", "itemCode"],
    value: normalizedCode,
    excludeId,
  });
};

export const createSemiFinishedMaterial = async (
  values,
  selectedProducts = [],
  currentUser = null,
) => {
  const errors = validateSemiFinishedMaterial(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  /* =====================================================
  SECTION: Semi Finished final code on create — AKTIF
  Fungsi:
  - Service selalu membuat kode final saat create, meskipun UI mengirim preview code.
  - Preview UI hanya bantuan tampilan; source of truth tetap service.

  Dipakai oleh:
  - createSemiFinishedMaterial dari halaman SemiFinishedMaterials.

  Alasan perubahan:
  - Kode SFP tidak lagi menjadi identitas user-facing; final code tetap dicek ulang agar tidak duplicate.

  Catatan cleanup:
  - Belum ada.

  Risiko:
  - Jangan gunakan kode manual dari UI untuk create karena field utama harus otomatis.
  ===================================================== */
  const baselineCode = await generateSemiFinishedMaterialCode(values);
  const baselineSequence = getSequentialBusinessCodeSequence({ code: baselineCode, prefix: "SFP" });
  let createdId = "";

  await runTransaction(db, async (transaction) => {
    const codeReservation = await prepareUniqueProductionSequentialCodeInTransaction({
      transaction,
      db,
      collectionName: COLLECTION_NAME,
      prefix: "SFP",
      minimumSequence: Math.max(baselineSequence - 1, 0),
    });
    const normalizedCode = codeReservation.code;
    const resultRef = doc(db, COLLECTION_NAME, normalizedCode);
    const existingSnapshot = await transaction.get(resultRef);

    if (existingSnapshot.exists()) {
      throw {
        type: "validation",
        errors: {
          code: "Kode semi finished sudah digunakan",
        },
      };
    }

    const payload = normalizeSemiFinishedCreatePayload(
      { ...values, code: normalizedCode },
      currentUser,
      selectedProducts,
    );
    /* =====================================================
    SECTION: Semi Finished document ID = business code — AKTIF
    Fungsi:
    - Menyimpan Semi Finished baru memakai document ID sama dengan kode SFP internal sequence.

    Dipakai oleh:
    - createSemiFinishedMaterial.

    Alasan perubahan:
    - Kode SFP final wajib otomatis dan data baru idealnya memakai business code sebagai ID.

    Catatan cleanup:
    - Data lama/manual code tetap compatibility, tidak di-rename.

    Risiko:
    - Jangan mengubah stok varian/output produksi dari section ini.
    ===================================================== */
    codeReservation.commit();
    transaction.set(resultRef, payload);
    createdId = resultRef.id;
  });

  return createdId;
};

export const updateSemiFinishedMaterial = async (
  id,
  values,
  selectedProducts = [],
  currentUser = null,
) => {
  const errors = validateSemiFinishedMaterial(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("Data semi finished material tidak ditemukan");
  }

  const existingMaterialBeforeUpdate = enrichMaterialWithVariantTotals({
    id: snapshot.id,
    ...snapshot.data(),
  });
  // IMS NOTE [AKTIF | immutable-code]: UI tidak mengirim code; update wajib mempertahankan code/itemCode existing agar edit nama/kategori tidak regenerate kode SFP.
  const submittedCode = String(values.code || "").trim().toUpperCase();
  const existingCode = String(existingMaterialBeforeUpdate.code || existingMaterialBeforeUpdate.itemCode || "").trim().toUpperCase();
  const normalizedCode = existingCode || submittedCode || (await generateSemiFinishedMaterialCode(values, id));
  const isCodeExists = await isSemiFinishedMaterialCodeExists(normalizedCode, id);

  if (isCodeExists) {
    throw {
      type: "validation",
      errors: {
        code: "Kode semi finished sudah digunakan",
      },
    };
  }

  // IMS NOTE [GUARDED | behavior-preserving terhadap stok]: update semi finished
  // memakai transaction agar metadata edit tidak menimpa stok dari flow produksi.
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) {
      throw new Error("Data semi finished material tidak ditemukan");
    }

    const existingMaterial = enrichMaterialWithVariantTotals({ id: snapshot.id, ...snapshot.data() });
    const payload = normalizeSemiFinishedMetadataPayload(
      { ...values, code: normalizedCode },
      currentUser,
      selectedProducts,
      existingMaterial,
    );
    transaction.update(ref, payload);
  });

  return id;
};

export const toggleSemiFinishedMaterialActive = async (
  id,
  isActive,
  currentUser = null,
) => {
  const ref = doc(db, COLLECTION_NAME, id);

  await updateDoc(ref, {
    isActive: Boolean(isActive),
    updatedAt: serverTimestamp(),
    updatedBy: resolveAuditUser(currentUser),
  });

  return id;
};
