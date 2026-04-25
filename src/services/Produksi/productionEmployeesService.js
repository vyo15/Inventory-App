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
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";

// =====================================================
// Nama collection
// ACTIVE / FINAL:
// - production_employees tetap menjadi source of truth master karyawan produksi.
// - production_employee_code_sequences hanya counter teknis untuk menjaga kode
//   DDMMYYYY-XXX tetap unik saat tambah data baru.
// =====================================================
const COLLECTION_NAME = "production_employees";
const CODE_SEQUENCE_COLLECTION = "production_employee_code_sequences";

// =====================================================
// Helper format kode otomatis
// Fungsi:
// - membuat prefix tanggal lokal DDMMYYYY agar sesuai tanggal user Indonesia;
// - membaca nomor urut dari kode yang sudah ada;
// - menyiapkan preview tanpa mengunci nomor;
// - mengunci nomor final lewat transaction saat create.
// Status:
// - ACTIVE / FINAL untuk karyawan produksi baru.
// - Kode lama seperti EMP-... tetap dianggap legacy data dan tidak dimigrasi otomatis.
// =====================================================
const padTwoDigits = (value) => String(value).padStart(2, "0");
const padSequence = (value) => String(Number(value || 0)).padStart(3, "0");

export const formatProductionEmployeeCodePrefix = (date = new Date()) => {
  const localDate = date instanceof Date ? date : new Date(date);
  const day = padTwoDigits(localDate.getDate());
  const month = padTwoDigits(localDate.getMonth() + 1);
  const year = localDate.getFullYear();

  return `${day}${month}${year}`;
};

const parseProductionEmployeeCodeSequence = (code = "", prefix = "") => {
  const pattern = new RegExp(`^${prefix}-(\\d{3})$`);
  const match = String(code || "").trim().match(pattern);

  if (!match) return 0;

  return Number(match[1] || 0);
};

const getMaxExistingCodeSequence = async (prefix) => {
  const startCode = `${prefix}-000`;
  const endCode = `${prefix}-\uf8ff`;
  const q = query(
    collection(db, COLLECTION_NAME),
    where("code", ">=", startCode),
    where("code", "<=", endCode),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.reduce((maxSequence, item) => {
    const sequence = parseProductionEmployeeCodeSequence(item.data()?.code, prefix);
    return Math.max(maxSequence, sequence);
  }, 0);
};

const getStoredCodeSequence = async (prefix) => {
  const ref = doc(db, CODE_SEQUENCE_COLLECTION, prefix);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) return 0;

  return Number(snapshot.data()?.lastSequence || 0);
};

export const getNextProductionEmployeeCodePreview = async (date = new Date()) => {
  const prefix = formatProductionEmployeeCodePrefix(date);
  const [existingMax, storedMax] = await Promise.all([
    getMaxExistingCodeSequence(prefix),
    getStoredCodeSequence(prefix),
  ]);
  const nextSequence = Math.max(existingMax, storedMax) + 1;

  return `${prefix}-${padSequence(nextSequence)}`;
};

const generateProductionEmployeeCode = async (date = new Date()) => {
  const prefix = formatProductionEmployeeCodePrefix(date);
  const existingMax = await getMaxExistingCodeSequence(prefix);
  const sequenceRef = doc(db, CODE_SEQUENCE_COLLECTION, prefix);

  return runTransaction(db, async (transaction) => {
    const sequenceSnapshot = await transaction.get(sequenceRef);
    const storedMax = sequenceSnapshot.exists()
      ? Number(sequenceSnapshot.data()?.lastSequence || 0)
      : 0;
    const nextSequence = Math.max(existingMax, storedMax) + 1;
    const code = `${prefix}-${padSequence(nextSequence)}`;

    transaction.set(
      sequenceRef,
      {
        prefix,
        lastSequence: nextSequence,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return code;
  });
};

const generateUniqueProductionEmployeeCode = async (date = new Date()) => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = await generateProductionEmployeeCode(date);
    const exists = await isProductionEmployeeCodeExists(code);

    if (!exists) return code;
  }

  throw new Error("Gagal membuat kode karyawan produksi yang unik");
};

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
    // ACTIVE / FINAL
    // Field code tetap dipakai Work Log/Payroll sebagai display reference.
    // Untuk data baru, isi code digenerate otomatis DDMMYYYY-XXX.
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

    // =====================================================
    // LEGACY / DEPRECATED
    // Custom payroll karyawan dipertahankan sementara untuk kompatibilitas
    // data lama, tetapi tidak lagi dipakai di flow payroll final.
    // Source of truth payroll baru ada di Tahapan Produksi + Work Log.
    // =====================================================
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
  // =====================================================
  // ACTIVE / FINAL - QUERY UTAMA EMPLOYEE
  // Fungsi blok:
  // - membaca collection `production_employees` sebagai master karyawan produksi;
  // - order by name hanya untuk tampilan tabel yang rapi.
  // Alasan blok ini dipakai:
  // - employee adalah data utama halaman Karyawan Produksi.
  // Status:
  // - aktif dipakai; bukan legacy.
  // =====================================================
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
  } catch (error) {
    // =====================================================
    // ACTIVE / GUARDED - FALLBACK QUERY EMPLOYEE
    // Fungsi blok:
    // - fallback plain collection read jika orderBy bermasalah di Firestore;
    // - sort dilakukan di client agar data employee lama tetap tampil.
    // Alasan blok ini dipakai:
    // - data utama employee tidak boleh terlihat hilang hanya karena query/index.
    // Status:
    // - aktif sebagai guard; kandidat cleanup hanya jika query/index sudah stabil.
    // =====================================================
    console.error("Query employee utama gagal, pakai fallback plain collection", error);
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));

    return snapshot.docs
      .map((item) => ({
        id: item.id,
        ...item.data(),
      }))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }
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
  // =====================================================
  // ACTIVE / FINAL
  // Kode karyawan baru selalu digenerate ulang saat submit.
  // Preview di form hanya membantu user melihat format, sedangkan nomor
  // final dikunci di service agar tidak bentrok jika ada input paralel.
  // =====================================================
  const createdDate = new Date();
  const generatedCode = await generateUniqueProductionEmployeeCode(createdDate);
  const valuesWithGeneratedCode = {
    ...values,
    code: generatedCode,
  };
  const errors = validateProductionEmployee(valuesWithGeneratedCode);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const payload = normalizePayload(
    valuesWithGeneratedCode,
    currentUser,
    selectedSteps,
    false,
  );
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);

  return { id: result.id, code: generatedCode };
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
