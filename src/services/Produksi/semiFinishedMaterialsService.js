// =====================================================
// Semi Finished Materials Service
// CRUD Firestore untuk collection semi_finished_materials
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

const COLLECTION_NAME = "semi_finished_materials";

const normalizePayload = (
  values = {},
  currentUser = null,
  selectedProducts = [],
  isEdit = false,
) => {
  const currentStock = Number(values.currentStock || 0);
  const reservedStock = Number(values.reservedStock || 0);
  const availableStock =
    values.availableStock !== undefined && values.availableStock !== null
      ? Number(values.availableStock || 0)
      : currentStock - reservedStock;

  const payload = {
    code: String(values.code || "")
      .trim()
      .toUpperCase(),
    name: String(values.name || "").trim(),
    description: String(values.description || "").trim(),
    category: values.category || "kelopak",
    type: values.type || "component",
    unit: String(values.unit || "").trim() || "pcs",

    relatedProductIds: selectedProducts.map((item) => item.id),
    relatedProductNames: selectedProducts.map((item) => item.name || ""),
    tags: Array.isArray(values.tags) ? values.tags : [],

    currentStock,
    reservedStock,
    availableStock,
    minStockAlert: Number(values.minStockAlert || 0),
    maxStockTarget:
      values.maxStockTarget === null ||
      values.maxStockTarget === undefined ||
      values.maxStockTarget === ""
        ? null
        : Number(values.maxStockTarget),

    referenceCostPerUnit: Number(values.referenceCostPerUnit || 0),
    lastProductionCostPerUnit: Number(values.lastProductionCostPerUnit || 0),
    averageCostPerUnit: Number(values.averageCostPerUnit || 0),
    valuationMethod: values.valuationMethod || "average",

    isActive: values.isActive !== false,
    isSellable: false,
    notes: String(values.notes || "").trim(),

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

  if (!String(values.code || "").trim()) {
    errors.code = "Kode semi finished wajib diisi";
  }

  if (!String(values.name || "").trim()) {
    errors.name = "Nama semi finished wajib diisi";
  }

  if (!values.category) {
    errors.category = "Kategori wajib dipilih";
  }

  if (!values.type) {
    errors.type = "Tipe wajib dipilih";
  }

  if (!String(values.unit || "").trim()) {
    errors.unit = "Satuan wajib diisi";
  }

  if (Number(values.currentStock || 0) < 0) {
    errors.currentStock = "Stok tidak boleh negatif";
  }

  if (Number(values.reservedStock || 0) < 0) {
    errors.reservedStock = "Reserved stock tidak boleh negatif";
  }

  if (Number(values.minStockAlert || 0) < 0) {
    errors.minStockAlert = "Minimum stock alert tidak boleh negatif";
  }

  if (Number(values.referenceCostPerUnit || 0) < 0) {
    errors.referenceCostPerUnit = "Reference cost tidak boleh negatif";
  }

  if (Number(values.lastProductionCostPerUnit || 0) < 0) {
    errors.lastProductionCostPerUnit =
      "Last production cost tidak boleh negatif";
  }

  if (Number(values.averageCostPerUnit || 0) < 0) {
    errors.averageCostPerUnit = "Average cost tidak boleh negatif";
  }

  return errors;
};

export const getAllSemiFinishedMaterials = async () => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
};

export const getActiveSemiFinishedMaterials = async () => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("isActive", "==", true),
    orderBy("name", "asc"),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
};

export const getSemiFinishedMaterialById = async (id) => {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("Data semi finished material tidak ditemukan");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
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
