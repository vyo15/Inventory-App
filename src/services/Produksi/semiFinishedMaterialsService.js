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

const enrichMaterialWithVariantTotals = (item = {}) => {
  const hasVariants = inferHasVariants(item);
  const variants = hasVariants ? normalizeSemiFinishedVariants(item.variants || []) : [];

  if (!hasVariants || variants.length === 0) {
    const currentStock = Number(item.currentStock || 0);
    const reservedStock = Number(item.reservedStock || 0);
    const availableStock = Math.max(currentStock - reservedStock, 0);

    return {
      ...item,
      hasVariants,
      variants,
      currentStock,
      // ACTIVE: master semi finished wajib menyimpan stock alias currentStock.
      // ALASAN: kompatibilitas audit stok lama tanpa mengubah flow produksi.
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

const normalizePayload = (
  values = {},
  currentUser = null,
  selectedProducts = [],
  isEdit = false,
) => {
  const hasVariants = values.hasVariants === true;
  const normalizedVariants = hasVariants
    ? normalizeSemiFinishedVariants(values.variants || [])
    : [];
  const variantTotals = calculateSemiFinishedTotalsFromVariants(normalizedVariants);
  const currentStock = hasVariants
    ? variantTotals.currentStock
    : Number(values.currentStock || 0);
  const reservedStock = hasVariants
    ? variantTotals.reservedStock
    : Number(values.reservedStock || 0);
  const minStockAlert = hasVariants
    ? variantTotals.minStockAlert
    : Number(values.minStockAlert || 0);
  const averageCostPerUnit = hasVariants
    ? Number(variantTotals.averageCostPerUnit || 0)
    : Number(values.averageCostPerUnit || 0);

  const payload = {
    code: String(values.code || "")
      .trim()
      .toUpperCase(),
    name: String(values.name || "").trim(),
    description: String(values.description || "").trim(),
    category: values.category || "kelopak",
    flowerGroup: values.flowerGroup || "mawar",
    type: "semi_finished",
    unit: values.unit || "pcs",
    hasVariants,

    relatedProductIds: selectedProducts.map((item) => item.id),
    relatedProductNames: selectedProducts.map((item) => item.name || ""),
    variants: normalizedVariants,
    variantCount: hasVariants ? variantTotals.variantCount : 0,
    activeVariantCount: hasVariants ? variantTotals.activeVariantCount : 0,
    // ACTIVE: payload create/edit semi finished menjaga stock = currentStock.
    // ALASAN: semua master item harus lolos audit tanpa perlu Reset/Maintenance.

    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock: Math.max(currentStock - reservedStock, 0),
    minStockAlert,
    averageCostPerUnit,

    isActive: values.isActive !== false,
    isSellable: false,

    updatedAt: serverTimestamp(),
    updatedBy:
      currentUser?.email ||
      currentUser?.displayName ||
      currentUser?.uid ||
      "system",
  };

  if (!isEdit) {
    payload.createdAt = serverTimestamp();
    payload.createdBy =
      currentUser?.email ||
      currentUser?.displayName ||
      currentUser?.uid ||
      "system";
  }

  return payload;
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

  const payload = normalizePayload(
    values,
    currentUser,
    selectedProducts,
    false,
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

  const payload = normalizePayload(values, currentUser, selectedProducts, true);
  const ref = doc(db, COLLECTION_NAME, id);

  await updateDoc(ref, payload);
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
    updatedBy:
      currentUser?.email ||
      currentUser?.displayName ||
      currentUser?.uid ||
      "system",
  });

  return id;
};
