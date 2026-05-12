// =====================================================
// Production Steps Service
// CRUD Firestore untuk collection production_steps
// =====================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import { generateUniqueProductionReadableCode } from "../../utils/references/productionCodeGenerator";

// =====================================================
// Nama collection
// =====================================================

const COLLECTION_NAME = "production_steps";

// =====================================================
// Helper normalize payload
// Menjaga data konsisten sebelum disimpan
// =====================================================

/* =====================================================
SECTION: Production Step code generator — AKTIF
Fungsi:
- Membuat kode STP-[READABLE]-001 untuk master tahapan produksi tanpa timestamp.

Dipakai oleh:
- createProductionStep dan updateProductionStep.

Alasan perubahan:
- Standar final IMS mengganti kode step berbasis nama+timestamp menjadi reference readable dengan suffix 3 digit.

Catatan cleanup:
- Data lama STEP/timestamp tetap compatibility sampai ada audit repair khusus.

Risiko:
- Jangan ubah processType/inputPolicy/outputType dari section ini.
===================================================== */
export const generateProductionStepCode = async (name = "", excludeId = null) =>
  generateUniqueProductionReadableCode({
    db,
    collectionName: COLLECTION_NAME,
    fieldNames: ["code"],
    prefix: "STP",
    text: name || "Production Step",
    fallbackText: "Production Step",
    excludeId,
    maxParts: 5,
  });

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
    code: normalizedCode,
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
    // =====================================================
    // ACTIVE / GUARDED
    // Klasifikasi payroll membedakan direct labor inti vs support/fulfillment.
    // Field ini ikut disnapshot ke Work Log dan dipakai lagi saat Payroll & HPP.
    // =====================================================
    payrollClassification:
      values.payrollClassification ||
      (processType === "support_process" ? "support_fulfillment" : "direct_labor"),
    includePayrollInHpp:
      typeof values.includePayrollInHpp === "boolean"
        ? values.includePayrollInHpp
        : processType !== "support_process",
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

  if (!values.payrollClassification) {
    errors.payrollClassification = "Klasifikasi payroll wajib dipilih";
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

  const directSnapshot = await getDoc(doc(db, COLLECTION_NAME, normalizedCode));
  if (directSnapshot.exists() && directSnapshot.id !== excludeId) return true;

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

  const codeToCheck = await generateProductionStepCode(values.name);
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
  /* =====================================================
  SECTION: Production Step document ID = business code — AKTIF
  Fungsi:
  - Menyimpan step baru dengan document ID sama seperti kode STP readable.

  Dipakai oleh:
  - createProductionStep.

  Alasan perubahan:
  - Data baru step produksi perlu reference audit yang stabil dan tidak memakai timestamp.

  Catatan cleanup:
  - Data lama tetap random/timestamp sampai ada repair terpisah.

  Risiko:
  - Jangan mengubah config step produksi dari section ini.
  ===================================================== */
  const resultRef = doc(db, COLLECTION_NAME, codeToCheck);
  await setDoc(resultRef, payload);

  return resultRef.id;
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
    String(values.existingCode || "").trim() ||
    String(values.code || "").trim() ||
    (await generateProductionStepCode(values.name, id));
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
