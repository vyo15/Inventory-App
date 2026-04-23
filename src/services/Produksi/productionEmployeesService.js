// =====================================================
// Production Employees Service
// CRUD Firestore untuk collection production_employees
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

// =====================================================
// Nama collection
// =====================================================
const COLLECTION_NAME = "production_employees";

// =====================================================
// Helper normalize payload
// =====================================================
const normalizePayload = (
  values = {},
  currentUser = null,
  selectedSteps = [],
  isEdit = false,
) => {
  const useCustomPayrollRate = Boolean(values.useCustomPayrollRate);

  const payload = {
    // =====================================================
    // LEGACY / DEPRECATED
    // Custom payroll karyawan dipertahankan sementara untuk kompatibilitas
    // data lama, tetapi tidak lagi dipakai di flow payroll final.
    // Source of truth payroll baru ada di Tahapan Produksi + Work Log.
    // =====================================================
    code: String(values.code || "")
      .trim()
      .toUpperCase(),
    name: String(values.name || "").trim(),
    gender: values.gender || "female",
    phone: String(values.phone || "").trim(),
    address: String(values.address || "").trim(),
    joinDate: values.joinDate || null,

    employmentType: values.employmentType || "borongan",
    role: values.role || "operator",

    assignedStepIds: selectedSteps.map((step) => step.id),
    assignedStepCodes: selectedSteps.map((step) => step.code || ""),
    assignedStepNames: selectedSteps.map((step) => step.name || ""),

    useCustomPayrollRate,
    customPayrollMode: useCustomPayrollRate
      ? values.customPayrollMode || ""
      : "",
    customPayrollRate: useCustomPayrollRate
      ? Number(values.customPayrollRate || 0)
      : 0,
    customPayrollQtyBase: useCustomPayrollRate
      ? Number(values.customPayrollQtyBase || 1)
      : 1,
    customPayrollOutputBasis: useCustomPayrollRate
      ? values.customPayrollOutputBasis || "good_qty"
      : "good_qty",
    payrollNotes: String(values.payrollNotes || "").trim(),

    skillTags: Array.isArray(values.skillTags) ? values.skillTags : [],
    notes: String(values.notes || "").trim(),

    isActive: values.isActive !== false,

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

// =====================================================
// Validasi dasar
// =====================================================
export const validateProductionEmployee = (values = {}) => {
  const errors = {};

  if (!String(values.code || "").trim()) {
    errors.code = "Kode karyawan wajib diisi";
  }

  if (!String(values.name || "").trim()) {
    errors.name = "Nama karyawan wajib diisi";
  }

  if (!values.employmentType) {
    errors.employmentType = "Jenis kerja wajib dipilih";
  }

  if (!values.role) {
    errors.role = "Role wajib dipilih";
  }

  // =====================================================
  // LEGACY / DEPRECATED
  // Validasi ini dipertahankan selama field custom payroll masih ada
  // di schema. Tidak lagi dipakai sebagai jalur hitung payroll aktif.
  // =====================================================
  if (values.useCustomPayrollRate) {
    if (!values.customPayrollMode) {
      errors.customPayrollMode = "Mode payroll custom wajib dipilih";
    }

    if (Number(values.customPayrollRate || 0) < 0) {
      errors.customPayrollRate = "Tarif payroll custom tidak boleh negatif";
    }

    if (values.customPayrollMode === "per_qty") {
      if (Number(values.customPayrollQtyBase || 0) <= 0) {
        errors.customPayrollQtyBase = "Basis qty custom harus lebih dari 0";
      }

      if (!values.customPayrollOutputBasis) {
        errors.customPayrollOutputBasis =
          "Basis output payroll custom wajib dipilih";
      }
    }
  }

  return errors;
};

// =====================================================
// Ambil semua data
// =====================================================
export const getAllProductionEmployees = async () => {
  const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
};

// =====================================================
// Ambil data aktif
// =====================================================
export const getActiveProductionEmployees = async () => {
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

// =====================================================
// Ambil by id
// =====================================================
export const getProductionEmployeeById = async (id) => {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("Data karyawan produksi tidak ditemukan");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

// =====================================================
// Cek kode unik
// =====================================================
export const isProductionEmployeeCodeExists = async (
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

// =====================================================
// Create
// =====================================================
export const createProductionEmployee = async (
  values,
  selectedSteps = [],
  currentUser = null,
) => {
  const errors = validateProductionEmployee(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const isCodeExists = await isProductionEmployeeCodeExists(values.code);

  if (isCodeExists) {
    throw {
      type: "validation",
      errors: {
        code: "Kode karyawan sudah digunakan",
      },
    };
  }

  const payload = normalizePayload(values, currentUser, selectedSteps, false);
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);

  return result.id;
};

// =====================================================
// Update
// =====================================================
export const updateProductionEmployee = async (
  id,
  values,
  selectedSteps = [],
  currentUser = null,
) => {
  const errors = validateProductionEmployee(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const isCodeExists = await isProductionEmployeeCodeExists(values.code, id);

  if (isCodeExists) {
    throw {
      type: "validation",
      errors: {
        code: "Kode karyawan sudah digunakan",
      },
    };
  }

  const payload = normalizePayload(values, currentUser, selectedSteps, true);
  const ref = doc(db, COLLECTION_NAME, id);

  await updateDoc(ref, payload);

  return id;
};

// =====================================================
// Toggle aktif / nonaktif
// =====================================================
export const toggleProductionEmployeeActive = async (
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
