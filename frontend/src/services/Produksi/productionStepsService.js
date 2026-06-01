// =====================================================
// Production Steps Service
// CRUD Firestore untuk collection production_steps
// =====================================================

import {
  collection,
  deleteField,
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
import {
  getProductionStepPayrollClassification,
  shouldIncludeProductionStepPayrollInHpp,
} from "../../constants/productionStepOptions";

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
- Membuat kode internal step produksi berurutan dengan format STP-001.
- Kode tidak bergantung nama step agar tetap stabil saat nama proses berubah.

Dipakai oleh:
- createProductionStep dan updateProductionStep untuk data baru/repair code kosong.

Alasan perubahan:
- Standar final IMS mengunci Production Step ke STP-001 agar master step ringkas dan konsisten.

Catatan cleanup:
- Data lama STP-[READABLE] tetap dibaca sebagai compatibility sampai user hapus/reset data lama.

Risiko:
- Jangan ubah processType/inputPolicy/outputType dari section ini.
===================================================== */
const PRODUCTION_STEP_CODE_PATTERN = /^STP-(\d{3,})$/;

const buildProductionStepSequenceCode = (sequence = 1) =>
  `STP-${String(Math.max(1, Number(sequence || 1))).padStart(3, "0")}`;

export const generateProductionStepCode = async (excludeId = null) => {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  const usedSequences = new Set();
  let maxSequence = 0;

  snapshot.docs.forEach((item) => {
    if (excludeId && item.id === excludeId) return;

    const data = item.data() || {};
    [item.id, data.code].forEach((rawValue) => {
      const value = String(rawValue || "").trim().toUpperCase();
      const matched = value.match(PRODUCTION_STEP_CODE_PATTERN);
      if (!matched) return;

      const sequence = Number(matched[1] || 0);
      if (sequence <= 0) return;

      usedSequences.add(sequence);
      if (sequence > maxSequence) maxSequence = sequence;
    });
  });

  let nextSequence = maxSequence + 1;
  while (usedSequences.has(nextSequence)) {
    nextSequence += 1;
  }

  return buildProductionStepSequenceCode(nextSequence);
};

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const normalizedCode = String(values.code || "")
    .trim()
    .toUpperCase();

  const processType = [
    "raw_to_semi",
    "semi_to_semi",
    "semi_to_product",
    "support_process",
  ].includes(values.processType)
    ? values.processType
    : "raw_to_semi";

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
  };

  const derivedConfig = derivedConfigByProcessType[processType];
  const payrollMode = values.payrollMode === "per_batch" ? "per_batch" : "per_qty";
  const payrollClassification = getProductionStepPayrollClassification(processType);

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

    basisType: ["per_meter", "per_rod_40cm", "per_qty", "per_batch"].includes(values.basisType)
      ? values.basisType
      : "per_batch",

    // =====================================================
    // ACTIVE / GUARDED
    // Rule upah operator di master step dipakai untuk generate payroll produksi.
    // Mode aktif hanya per qty dan per batch agar tidak ada layer hitung ganda di UI Step.
    // =====================================================
    payrollMode,
    payrollRate: Number(values.payrollRate || 0),
    payrollOutputBasis:
      payrollMode === "per_qty"
        ? values.payrollOutputBasis || "good_qty"
        : "good_qty",
    payrollClassification,
    includePayrollInHpp: shouldIncludeProductionStepPayrollInHpp(processType),

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

  if (!values.payrollMode) {
    errors.payrollMode = "Mode payroll wajib dipilih";
  }

  if (!["per_qty", "per_batch"].includes(values.payrollMode)) {
    errors.payrollMode = "Mode payroll hanya boleh Per Qty atau Per Batch";
  }

  if (Number(values.payrollRate || 0) < 0) {
    errors.payrollRate = "Tarif payroll tidak boleh negatif";
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

  /* =====================================================
  SECTION: Production Step service auto-generates hidden internal code — AKTIF
  Fungsi:
  - Menjamin Production Step baru tetap memiliki kode STP internal walaupun UI tidak mengirim field code.

  Dipakai oleh:
  - ProductionSteps.jsx saat create Production Step.

  Alasan perubahan:
  - Input code disembunyikan dari UI utama config, tetapi field code tetap wajib tersimpan otomatis.

  Catatan cleanup:
  - Belum ada.

  Risiko:
  - Jangan mengganti dengan input manual atau timestamp karena step dipakai BOM, Work Log, payroll, dan audit produksi.
  ===================================================== */
  const codeToCheck = await generateProductionStepCode();
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
  - Menyimpan step baru dengan document ID sama seperti kode STP-001.

  Dipakai oleh:
  - createProductionStep.

  Alasan perubahan:
  - Data baru step produksi perlu reference audit STP-001 yang stabil dan tidak memakai timestamp/nama.

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

  const ref = doc(db, COLLECTION_NAME, id);
  const existingSnapshot = await getDoc(ref);
  if (!existingSnapshot.exists()) {
    throw new Error("Tahapan produksi tidak ditemukan");
  }

  const existingStep = { id: existingSnapshot.id, ...existingSnapshot.data() };
  // IMS NOTE [AKTIF | immutable-code]: UI tidak mengirim code; update wajib mempertahankan code existing agar edit nama/payroll tidak regenerate kode STP.
  const existingCode = String(existingStep.code || "").trim();
  const submittedCode = String(values.existingCode || values.code || "").trim();
  const codeToCheck = existingCode || submittedCode || (await generateProductionStepCode(id));
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

  await updateDoc(ref, {
    ...payload,
    // IMS CLEANUP: field lama menu Step tidak lagi dipakai UI/rule aktif.
    standardBatchQty: deleteField(),
    estimatedDurationMinutes: deleteField(),
    defaultWorkerCount: deleteField(),
    payrollNotes: deleteField(),
    notes: deleteField(),
    colorTag: deleteField(),
    iconName: deleteField(),
  });

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
