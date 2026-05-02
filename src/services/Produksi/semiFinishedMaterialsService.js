// =====================================================
// Semi Finished Materials Service
// CRUD Firestore untuk collection semi_finished_materials
// Mendukung item dengan atau tanpa varian.
// =====================================================

import {
  addDoc,
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

const toNumberValue = (value = 0) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const resolveAuditUser = (currentUser = null) =>
  currentUser?.email || currentUser?.displayName || currentUser?.uid || "system";

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
      variants,
      currentStock,
      // IMS NOTE [LEGACY | behavior-preserving]: stock tetap alias currentStock
      // agar data lama semi finished masih terbaca tanpa migrasi otomatis.
      stock: currentStock,
      reservedStock,
      availableStock,
      minStockAlert: Number(item.minStockAlert || 0),
      averageCostPerUnit: Number(item.averageCostPerUnit || 0),
      variantCount: variants.length,
      activeVariantCount: variants.filter((variant) => variant.isActive !== false).length,
    };
  }

  const totals = calculateSemiFinishedTotalsFromVariants(variants);

  return {
    ...item,
    hasVariants,
    ...totals,
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
  flowerGroup: values.flowerGroup || "mawar",
  type: "semi_finished",
  unit: values.unit || "pcs",
  relatedProductIds: selectedProducts.map((item) => item.id),
  relatedProductNames: selectedProducts.map((item) => item.name || ""),
  minStockAlert: toStockNumber(values.minStockAlert || 0),
  averageCostPerUnit: toNumberValue(values.averageCostPerUnit || 0),
  isActive: values.isActive !== false,
  isSellable: false,
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
  const minStockAlert = hasVariants ? variantTotals.minStockAlert : toStockNumber(values.minStockAlert || 0);
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

// IMS NOTE [GUARDED | behavior-preserving]: variant matching memakai key/kode/nama, bukan index.
// Alasan cleanup: index bisa salah memindahkan stok jika urutan varian berubah.
const buildSemiVariantKeyCandidates = (variant = {}) => [
  variant.variantKey,
  variant.sku,
  variant.color,
  variant.name,
]
  .map((value) => String(value || "").trim().toLowerCase())
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

const hasProtectedVariantStock = (variant = {}) =>
  toStockNumber(variant.currentStock ?? variant.stock ?? 0) > 0 || toStockNumber(variant.reservedStock || 0) > 0;

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

const validateDuplicateSemiVariantColors = (variants = []) => {
  const errors = {};
  const usedColors = new Set();

  normalizeSemiFinishedVariants(variants).forEach((item, index) => {
    const key = String(item.color || "").trim().toLowerCase();
    if (usedColors.has(key)) {
      errors[`variants.${index}.color`] = "Warna tidak boleh duplikat";
    }
    usedColors.add(key);
  });

  return errors;
};

const mergeSemiVariantMetadataWithExistingStock = (editedVariants = [], existingVariants = []) => {
  const normalizedEdited = normalizeSemiFinishedVariants(editedVariants);
  const normalizedExisting = normalizeSemiFinishedVariants(existingVariants);

  if (normalizedEdited.length === 0) {
    throw { type: "validation", errors: { variants: "Minimal harus ada 1 varian" } };
  }

  const duplicateErrors = validateDuplicateSemiVariantColors(normalizedEdited);
  if (Object.keys(duplicateErrors).length > 0) {
    throw { type: "validation", errors: duplicateErrors };
  }

  assertNoSemiVariantWithStockRemoved(normalizedEdited, normalizedExisting);

  const existingLookup = buildSemiVariantLookup(normalizedExisting);

  return normalizedEdited.map((variant, index) => {
    const existingVariant = buildSemiVariantKeyCandidates(variant, index)
      .map((key) => existingLookup.get(key))
      .find(Boolean);
    const currentStock = toNumberValue(existingVariant?.currentStock ?? existingVariant?.stock ?? 0);
    const reservedStock = toNumberValue(existingVariant?.reservedStock || 0);

    // IMS NOTE [GUARDED | behavior-preserving]: metadata varian semi finished
    // boleh berubah, tetapi stok varian selalu dipreserve dari dokumen latest.
    return {
      ...variant,
      currentStock,
      stock: currentStock,
      reservedStock,
      availableStock: Math.max(currentStock - reservedStock, 0),
      minStockAlert: toStockNumber(variant.minStockAlert || 0),
      averageCostPerUnit: toNumberValue(variant.averageCostPerUnit || 0),
    };
  });
};

const normalizeSemiFinishedMetadataPayload = (
  values = {},
  currentUser = null,
  selectedProducts = [],
  existingMaterial = {},
) => {
  const hasVariants = inferHasVariants(existingMaterial);
  const payload = {
    ...resolveSemiFinishedMetadata(values, currentUser, selectedProducts),
    hasVariants,
  };

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
    minStockAlert: variantTotals.minStockAlert,
    averageCostPerUnit: toNumberValue(variantTotals.averageCostPerUnit || 0),
  };
};

export const validateSemiFinishedMaterial = (values = {}) => {
  const errors = {};
  const hasVariants = values.hasVariants === true;
  const normalizedVariants = hasVariants
    ? normalizeSemiFinishedVariants(values.variants || [])
    : [];

  if (!String(values.code || "").trim()) {
    errors.code = "Kode semi finished wajib diisi";
  }

  if (!String(values.name || "").trim()) {
    errors.name = "Nama semi finished wajib diisi";
  }

  if (!values.category) {
    errors.category = "Kategori wajib dipilih";
  }

  if (!values.flowerGroup) {
    errors.flowerGroup = "Grup bunga wajib dipilih";
  }

  if (hasVariants) {
    if (normalizedVariants.length === 0) {
      errors.variants = "Minimal harus ada 1 varian";
    }

    const usedColors = new Set();

    normalizedVariants.forEach((item, index) => {
      if (!item.color) {
        errors[`variants.${index}.color`] = "Warna wajib dipilih";
      }

      if (usedColors.has(item.color)) {
        errors[`variants.${index}.color`] = "Warna tidak boleh duplikat";
      }
      usedColors.add(item.color);

      if (Number(item.currentStock || 0) < 0) {
        errors[`variants.${index}.currentStock`] = "Stok tidak boleh negatif";
      }

      if (Number(item.reservedStock || 0) < 0) {
        errors[`variants.${index}.reservedStock`] =
          "Reserved stock tidak boleh negatif";
      }

      if (Number(item.minStockAlert || 0) < 0) {
        errors[`variants.${index}.minStockAlert`] =
          "Minimum stock alert tidak boleh negatif";
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

    if (Number(values.minStockAlert || 0) < 0) {
      errors.minStockAlert = "Minimum stock alert tidak boleh negatif";
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

  const q = query(
    collection(db, COLLECTION_NAME),
    where("code", "==", normalizedCode),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return false;

  const found = snapshot.docs.find((item) => item.id !== excludeId);
  return Boolean(found);
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

  const isCodeExists = await isSemiFinishedMaterialCodeExists(values.code);

  if (isCodeExists) {
    throw {
      type: "validation",
      errors: {
        code: "Kode semi finished sudah digunakan",
      },
    };
  }

  const payload = normalizeSemiFinishedCreatePayload(
    values,
    currentUser,
    selectedProducts,
  );
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);

  return result.id;
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

  const isCodeExists = await isSemiFinishedMaterialCodeExists(values.code, id);

  if (isCodeExists) {
    throw {
      type: "validation",
      errors: {
        code: "Kode semi finished sudah digunakan",
      },
    };
  }

  const ref = doc(db, COLLECTION_NAME, id);

  // IMS NOTE [GUARDED | behavior-preserving terhadap stok]: update semi finished
  // memakai transaction agar metadata edit tidak menimpa stok dari flow produksi.
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) {
      throw new Error("Data semi finished material tidak ditemukan");
    }

    const existingMaterial = enrichMaterialWithVariantTotals({ id: snapshot.id, ...snapshot.data() });
    const payload = normalizeSemiFinishedMetadataPayload(
      values,
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
