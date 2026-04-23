// =====================================================
// Production Steps Service
// CRUD Firestore untuk collection production_steps
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

const COLLECTION_NAME = "production_steps";

// =====================================================
// Helper normalize payload
// Menjaga data konsisten sebelum disimpan
// =====================================================

const generateProductionStepCode = (name = "") => {
  const normalizedName = String(name || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  const timeSuffix = Date.now().toString().slice(-6);
  return `${normalizedName || "STEP"}-${timeSuffix}`;
};

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const normalizedCode = String(values.code || "")
    .trim()
    .toUpperCase();

  const processType = values.processType || "raw_to_semi";

  const derivedConfigByProcessType = {
    raw_to_semi: {
      inputPolicy: "raw_only",
      outputType: "semi_finished_material",
      outputUnit: String(values.outputUnit || "pcs").trim() || "pcs",
      allowsPartialOutput: true,
      requiresQc: false,
      autoConsumeMaterials: true,
      autoCreateOutput: true,
    },
    semi_to_semi: {
      inputPolicy: "semi_only",
      outputType: "semi_finished_material",
      outputUnit: String(values.outputUnit || "pcs").trim() || "pcs",
      allowsPartialOutput: true,
      requiresQc: false,
      autoConsumeMaterials: true,
      autoCreateOutput: true,
    },
    semi_to_product: {
      inputPolicy: "semi_only",
      outputType: "product",
      outputUnit: String(values.outputUnit || "pcs").trim() || "pcs",
      allowsPartialOutput: true,
      requiresQc: false,
      autoConsumeMaterials: true,
      autoCreateOutput: true,
    },
    support_process: {
      inputPolicy: "mixed",
      outputType: "none",
      outputUnit: "",
      allowsPartialOutput: false,
      requiresQc: false,
      autoConsumeMaterials: false,
      autoCreateOutput: false,
    },
    raw_to_product: {
      inputPolicy: "raw_only",
      outputType: "product",
      outputUnit: String(values.outputUnit || "pcs").trim() || "pcs",
      allowsPartialOutput: true,
      requiresQc: false,
      autoConsumeMaterials: true,
      autoCreateOutput: true,
    },
    finishing: {
      inputPolicy: "mixed",
      outputType: "product",
      outputUnit: String(values.outputUnit || "pcs").trim() || "pcs",
      allowsPartialOutput: true,
      requiresQc: false,
      autoConsumeMaterials: true,
      autoCreateOutput: true,
    },
    qc: {
      inputPolicy: "none",
      outputType: "none",
      outputUnit: "",
      allowsPartialOutput: false,
      requiresQc: true,
      autoConsumeMaterials: false,
      autoCreateOutput: false,
    },
  };

  const derivedConfig = derivedConfigByProcessType[processType] || derivedConfigByProcessType.raw_to_semi;

  const payload = {
    code: normalizedCode || generateProductionStepCode(values.name),
    name: String(values.name || "").trim(),
    description: String(values.description || "").trim(),

    processType,
    sequenceNo: Number(values.sequenceNo || 1),
    inputPolicy: values.inputPolicy || derivedConfig.inputPolicy,
    outputType: values.outputType || derivedConfig.outputType,
    outputUnit: (values.outputType || derivedConfig.outputType) === "none"
      ? ""
      : String(values.outputUnit || derivedConfig.outputUnit || "").trim(),

    standardBatchQty: Number(values.standardBatchQty || 1),
    estimatedDurationMinutes: Number(values.estimatedDurationMinutes || 0),
    defaultWorkerCount: Number(values.defaultWorkerCount || 1),

    allowsPartialOutput:
      typeof values.allowsPartialOutput === "boolean"
        ? values.allowsPartialOutput
        : Boolean(derivedConfig.allowsPartialOutput),
    requiresQc:
      typeof values.requiresQc === "boolean"
        ? values.requiresQc
        : Boolean(derivedConfig.requiresQc),
    allowRework: Boolean(values.allowRework),
    autoConsumeMaterials:
      typeof values.autoConsumeMaterials === "boolean"
        ? values.autoConsumeMaterials
        : Boolean(derivedConfig.autoConsumeMaterials),
    autoCreateOutput:
      typeof values.autoCreateOutput === "boolean"
        ? values.autoCreateOutput
        : Boolean(derivedConfig.autoCreateOutput),

    basisType: values.basisType || "per_meter",
    monitoringMode: values.monitoringMode || "none",

    // =====================================================
    // ACTIVE / GUARDED
    // Rule payroll di master step adalah source of truth utama untuk
    // generate payroll produksi.
    // =====================================================
    payrollMode: values.payrollMode || "per_qty",
    payrollRate: Number(values.payrollRate || 0),
    payrollQtyBase:
      values.payrollMode === "per_qty" ? Number(values.payrollQtyBase || 1) : 1,
    payrollOutputBasis:
      values.payrollMode === "per_qty"
        ? values.payrollOutputBasis || "good_qty"
        : "good_qty",
    payrollNotes: String(values.payrollNotes || "").trim(),

    colorTag: String(values.colorTag || "").trim(),
    iconName: String(values.iconName || "").trim(),
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
// Dipakai sebelum create/update
// =====================================================

export const validateProductionStep = (values = {}) => {
  const errors = {};

  if (!String(values.name || "").trim()) {
    errors.name = "Nama tahapan wajib diisi";
  }

  if (!values.processType) {
    errors.processType = "Jenis proses wajib dipilih";
  }

  if (!values.basisType) {
    errors.basisType = "Basis kerja wajib dipilih";
  }

  if (!values.monitoringMode) {
    errors.monitoringMode = "Mode monitoring wajib dipilih";
  }

  if (!values.payrollMode) {
    errors.payrollMode = "Mode payroll wajib dipilih";
  }

  if (Number(values.payrollRate || 0) < 0) {
    errors.payrollRate = "Tarif payroll tidak boleh negatif";
  }

  if (values.payrollMode === "per_qty") {
    if (Number(values.payrollQtyBase || 0) <= 0) {
      errors.payrollQtyBase = "Qty dasar bayar harus lebih dari 0";
    }

    if (!values.payrollOutputBasis) {
      errors.payrollOutputBasis = "Basis output bayar wajib dipilih";
    }
  }

  return errors;
};

// =====================================================
// Ambil semua data tahapan produksi

// =====================================================

export const getAllProductionSteps = async () => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("sequenceNo", "asc"),
      orderBy("name", "asc"),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
  } catch (error) {
    console.error("Query step utama gagal, pakai fallback query", error);

    try {
      const fallbackQuery = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));
      const snapshot = await getDocs(fallbackQuery);

      return snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
    } catch (fallbackError) {
      console.error("Fallback query step gagal, pakai getDocs biasa", fallbackError);
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));

      return snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
    }
  }
};

// =====================================================
// Ambil tahapan produksi aktif saja
// =====================================================

export const getActiveProductionSteps = async () => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("isActive", "==", true),
      orderBy("sequenceNo", "asc"),
      orderBy("name", "asc"),
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
  } catch (error) {
    console.error("Query active step utama gagal, pakai fallback query", error);

    try {
      const fallbackQuery = query(
        collection(db, COLLECTION_NAME),
        where("isActive", "==", true),
        orderBy("name", "asc"),
      );
      const snapshot = await getDocs(fallbackQuery);

      return snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      }));
    } catch (fallbackError) {
      console.error("Fallback query active step gagal, pakai filter manual", fallbackError);
      const snapshot = await getDocs(collection(db, COLLECTION_NAME));

      return snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.isActive);
    }
  }
};

// =====================================================
// Ambil satu data by id
// =====================================================

export const getProductionStepById = async (id) => {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("Data tahapan produksi tidak ditemukan");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

// =====================================================
// Cek kode unik
// excludeId dipakai saat edit
// =====================================================

export const isProductionStepCodeExists = async (code, excludeId = null) => {
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
// Create data baru
// =====================================================

export const createProductionStep = async (values, currentUser = null) => {
  const errors = validateProductionStep(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const codeToCheck = String(values.code || "").trim() || generateProductionStepCode(values.name);
  const isCodeExists = await isProductionStepCodeExists(codeToCheck);
  values = { ...values, code: codeToCheck };

  if (isCodeExists) {
    throw {
      type: "validation",
      errors: {
        code: "Kode tahapan sudah digunakan",
      },
    };
  }

  const payload = normalizePayload(values, currentUser, false);
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);

  return result.id;
};

// =====================================================
// Update data existing
// =====================================================

export const updateProductionStep = async (id, values, currentUser = null) => {
  const errors = validateProductionStep(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const codeToCheck =
    String(values.code || "").trim() ||
    String(values.existingCode || "").trim() ||
    generateProductionStepCode(values.name);
  const isCodeExists = await isProductionStepCodeExists(codeToCheck, id);
  values = { ...values, code: codeToCheck };

  if (isCodeExists) {
    throw {
      type: "validation",
      errors: {
        code: "Kode tahapan sudah digunakan",
      },
    };
  }

  const payload = normalizePayload(values, currentUser, true);
  const ref = doc(db, COLLECTION_NAME, id);

  await updateDoc(ref, payload);

  return id;
};

// =====================================================
// Toggle aktif / nonaktif
// Soft update, bukan delete
// =====================================================

export const toggleProductionStepActive = async (
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
