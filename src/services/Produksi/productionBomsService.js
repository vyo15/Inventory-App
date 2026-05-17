// =====================================================
// Production BOMs Service
// CRUD Firestore untuk collection production_boms
// Rule final:
// - target product -> material utama semi_finished_material
// - target product boleh raw_material untuk consumable assembly seperti lem tembak
// - target semi_finished_material -> material raw / semi_finished_material
// =====================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteField,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  generateUniqueProductionSequentialCode,
  isProductionBusinessCodeExists,
} from "../../utils/references/productionCodeGenerator";
import { calculateBomTotals } from "../../constants/productionBomOptions";
import { inferHasVariants } from "../../utils/variants/variantStockHelpers";
import {
  calculateBomStepLineCost,
  hydrateBomMaterialLinesWithLiveCost,
  resolveBomStepPayrollSnapshot,
} from "../../utils/produksi/productionBomCostHelpers";

const COLLECTION_NAME = "production_boms";

export const generateProductionBomCode = async (values = {}, excludeId = null) => {
  // IMS NOTE [LEGACY-COMPAT | lint-safe-signature]: values tetap diterima agar caller lama tidak perlu diubah, meski kode BOM sekarang berbasis sequence internal.
  void values;
  // IMS NOTE [AKTIF | internal-sequence-code]: BOM baru memakai kode internal BOM-001; UI menampilkan nama target dan komposisi, bukan kode BOM.
  return generateUniqueProductionSequentialCode({
    db,
    collectionName: COLLECTION_NAME,
    fieldNames: ["code", "bomCode"],
    prefix: "BOM",
    excludeId,
  });
};

// =====================================================
// SECTION: helper filter aktif toleran data lama
// Rule:
// - true -> tampil
// - undefined -> tampil
// - false -> tidak tampil
// =====================================================
const filterActiveLike = (items = []) =>
  items.filter((item) => item?.isActive !== false);

// =====================================================
// SECTION: helper format string aman
// =====================================================
const safeTrim = (value) => String(value || "").trim();

// =====================================================
// SECTION: helper normalisasi reference item
// Tujuan:
// - menyamakan shape antar collection lama dan baru
// - fallback nama/unit/code agar dropdown BOM tetap stabil
// =====================================================
const normalizeReferenceItem = (docItem) => {
  const raw = {
    id: docItem.id,
    ...docItem.data(),
  };

  return {
    ...raw,

    // SECTION: fallback field utama
    code:
      safeTrim(raw.code) ||
      safeTrim(raw.itemCode) ||
      safeTrim(raw.sku) ||
      safeTrim(raw.productCode),

    name:
      safeTrim(raw.name) ||
      safeTrim(raw.productName) ||
      safeTrim(raw.materialName) ||
      safeTrim(raw.stepName) ||
      safeTrim(raw.title),

    unit:
      safeTrim(raw.unit) ||
      safeTrim(raw.stockUnit) ||
      safeTrim(raw.baseUnit) ||
      "pcs",

    hasVariants: inferHasVariants(raw),
    isActive: raw?.isActive,
  };
};

// =====================================================
// SECTION: helper fetch collection aman
// Tujuan:
// - collection referensi yang kosong/tidak siap tidak mematikan loader lain
// - menjaga BOM tetap bisa tampil walau salah satu master belum ada
// =====================================================
const fetchCollectionSafe = async (collectionName) => {
  try {
    const snapshot = await getDocs(collection(db, collectionName));

    return filterActiveLike(
      snapshot.docs.map((docItem) => normalizeReferenceItem(docItem)),
    );
  } catch (error) {
    console.error(`Gagal memuat collection ${collectionName}`, error);
    return [];
  }
};

// =====================================================
// SECTION: ambil master reference BOM
// Penting:
// - products harus tetap terbaca walau master lain kosong
// - hasil sudah dinormalisasi
// =====================================================
export const getActiveBomReferenceData = async () => {
  const [products, rawMaterials, semiFinishedMaterials, productionSteps] =
    await Promise.all([
      fetchCollectionSafe("products"),
      fetchCollectionSafe("raw_materials"),
      fetchCollectionSafe("semi_finished_materials"),
      fetchCollectionSafe("production_steps"),
    ]);

  return {
    products,
    rawMaterials,
    semiFinishedMaterials,
    productionSteps,
  };
};

// =====================================================
// SECTION: normalize material lines
// Rule penting:
// - target product boleh memakai semi_finished_material untuk komponen utama
// - target product juga boleh memakai raw_material untuk consumable assembly
//   seperti lem tembak, karena stok tetap harus terpotong dari bahan baku
// =====================================================
const normalizeMaterialLines = (materialLines = [], referenceData = {}) => {
  /*
  =====================================================
  SECTION: BOM save live material cost hydration — GUARDED
  Fungsi:
  - Menormalisasi materialLines dan menghitung ulang biaya dari master cost terbaru sebelum BOM disimpan.

  Dipakai oleh:
  - createProductionBom dan updateProductionBom.

  Alasan perubahan:
  - Edit/simpan BOM lama tidak boleh mempertahankan costPerUnitSnapshot/totalCostSnapshot stale.

  Catatan cleanup:
  - Field snapshot masih dipakai untuk compatibility schema lama, tetapi nilainya selalu direfresh dari master.

  Risiko:
  - Jangan fallback ke line.costPerUnitSnapshot karena akan mengembalikan bug stale BOM estimate.
  =====================================================
  */
  const normalizedLines = materialLines.map((line, index) => {
    const normalizedItemType = ["raw_material", "semi_finished_material"].includes(
      line.itemType,
    )
      ? line.itemType
      : "raw_material";

    return {
      id: line.id || `material-${Date.now()}-${index}`,
      itemType: normalizedItemType,
      itemId: line.itemId || "",
      itemCode: safeTrim(line.itemCode),
      itemName: safeTrim(line.itemName),
      unit: safeTrim(line.unit) || "pcs",
      qtyPerBatch: Number(line.qtyPerBatch || 0),
      wastageQty: Number(line.wastageQty || 0),
      costPerUnitSnapshot: 0,
      costSourceSnapshot: "",
      materialHasVariants: line.materialHasVariants === true,
      materialVariantStrategy:
        line.materialHasVariants === true
          ? line.materialVariantStrategy || 'inherit'
          : 'none',
      fixedVariantKey: safeTrim(line.fixedVariantKey),
      fixedVariantLabel: safeTrim(line.fixedVariantLabel),
      isOptional: false,
      notes: safeTrim(line.notes),
    };
  });

  return hydrateBomMaterialLinesWithLiveCost({
    materialLines: normalizedLines,
    referenceData,
  });
};

// =====================================================
// SECTION: normalize step lines
// =====================================================
const normalizeStepLines = (stepLines = [], header = {}) =>
  stepLines
    .map((line, index) => {
      const payrollSnapshot = resolveBomStepPayrollSnapshot(line);
      const normalizedLine = {
        id: line.id || `step-${Date.now()}-${index}`,
        stepId: line.stepId || "",
        stepCode: safeTrim(line.stepCode),
        stepName: safeTrim(line.stepName),
        sequenceNo: Number(line.sequenceNo || index + 1),
        inputType: line.inputType || "mixed",
        outputType: line.outputType || "none",

        outputItemType: "",
        outputItemId: "",
        outputItemCode: "",
        outputItemName: "",

        expectedOutputQty: 0,
        estimatedDurationMinutes: 0,
        qcRequired: false,
        allowRework: false,

        ...payrollSnapshot,
        notes: safeTrim(line.notes),
      };

      return {
        ...normalizedLine,
        laborCostEstimateSnapshot: calculateBomStepLineCost(normalizedLine, header),
      };
    })
    .sort((a, b) => Number(a.sequenceNo || 0) - Number(b.sequenceNo || 0));

// =====================================================
// SECTION: validasi dasar BOM
// Rule final:
// - target product boleh memakai semi_finished_material dan raw_material
// - raw_material dipakai untuk consumable assembly seperti lem tembak
// =====================================================
export const validateProductionBom = (values = {}) => {
  const errors = {};


  if (!values.targetType) {
    errors.targetType = "Target type wajib dipilih";
  }

  if (!values.targetId) {
    errors.targetId = "Target BOM wajib dipilih";
  }

  if (Number(values.version || 0) <= 0) {
    errors.version = "Versi BOM minimal 1";
  }

  if (Number(values.batchOutputQty || 0) <= 0) {
    errors.batchOutputQty = "Batch output harus lebih dari 0";
  }

  if (
    !Array.isArray(values.materialLines) ||
    values.materialLines.length === 0
  ) {
    errors.materialLines = "Minimal harus ada 1 material line";
  }


  const hasInvalidMaterial = (values.materialLines || []).some(
    (line) =>
      line.itemType &&
      !["raw_material", "semi_finished_material"].includes(line.itemType),
  );

  if (hasInvalidMaterial) {
    errors.materialLines =
      "Material BOM hanya boleh Raw Material atau Semi Finished Material";
  }

  return errors;
};

// =====================================================
// SECTION: normalize payload BOM
// =====================================================
const normalizePayload = (values = {}, currentUser = null, isEdit = false, referenceData = {}) => {
  const targetType = values.targetType || "product";
  const materialLines = normalizeMaterialLines(values.materialLines || [], referenceData);
  const stepLines = normalizeStepLines(values.stepLines || [], values);
  const totals = calculateBomTotals(materialLines, stepLines, values);

  const payload = {
    code: safeTrim(values.code).toUpperCase(),
    name: safeTrim(values.name) || safeTrim(values.targetName) || "BOM Produksi",
    description: safeTrim(values.description),

    targetType,
    targetId: values.targetId || "",
    targetCode: safeTrim(values.targetCode),
    targetName: safeTrim(values.targetName),
    targetUnit: safeTrim(values.targetUnit) || "pcs",
    targetHasVariants: values.targetHasVariants === true,

    version: Number(values.version || 1),
    isDefault: values.isDefault !== false,
    isActive: values.isActive !== false,
    effectiveDate: values.effectiveDate || null,
    expiredDate: values.expiredDate || null,

    batchOutputQty: Number(values.batchOutputQty || 1),
    yieldPercentage: Number(values.yieldPercentage || 100),
    scrapPercentage: Number(values.scrapPercentage || 0),

    materialCostEstimate: totals.materialCostEstimate,
    laborCostEstimate: totals.laborCostEstimate,
    overheadCostEstimate: totals.overheadCostEstimate,
    totalCostEstimate: totals.totalCostEstimate,

    routingMode: values.routingMode || "multi_step",
    materialLines,
    stepLines,

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
// SECTION: ambil semua BOM
// Catatan:
// - pakai fallback query agar lebih tahan bila orderBy bermasalah
// =====================================================
export const getAllProductionBoms = async () => {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));

  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...item.data(),
    }))
    .sort((a, b) => {
      const targetCompare = String(a?.targetName || "").localeCompare(
        String(b?.targetName || ""),
        "id",
      );

      if (targetCompare !== 0) return targetCompare;
      return Number(b?.version || 0) - Number(a?.version || 0);
    });
};

// =====================================================
// SECTION: ambil BOM aktif
// =====================================================
export const getActiveProductionBoms = async () => {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));

  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...item.data(),
    }))
    .filter((item) => item?.isActive === true)
    .sort((a, b) => {
      const targetCompare = String(a?.targetName || "").localeCompare(
        String(b?.targetName || ""),
        "id",
      );

      if (targetCompare !== 0) return targetCompare;
      return Number(b?.version || 0) - Number(a?.version || 0);
    });
};

// =====================================================
// SECTION: ambil BOM by id
// =====================================================
export const getProductionBomById = async (id) => {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("Data BOM produksi tidak ditemukan");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

// =====================================================
// SECTION: cek kode BOM unik
// =====================================================
export const isProductionBomCodeExists = async (code, excludeId = null) => {
  const normalizedCode = safeTrim(code).toUpperCase();

  if (!normalizedCode) return false;

  return isProductionBusinessCodeExists({
    db,
    collectionName: COLLECTION_NAME,
    fieldNames: ["code", "bomCode"],
    value: normalizedCode,
    excludeId,
  });
};

// =====================================================
// SECTION: create BOM
// =====================================================
export const createProductionBom = async (values, currentUser = null) => {
  const errors = validateProductionBom(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const normalizedCode = await generateProductionBomCode(values);
  const isCodeExists = await isProductionBomCodeExists(normalizedCode);

  if (isCodeExists) {
    throw {
      type: "validation",
      errors: {
        code: "Kode BOM sudah digunakan",
      },
    };
  }

  const referenceData = await getActiveBomReferenceData();
  const payload = normalizePayload({ ...values, code: normalizedCode }, currentUser, false, referenceData);
  /* =====================================================
  SECTION: BOM document ID = business code — AKTIF
  Fungsi:
  - Menyimpan BOM baru memakai document ID sama dengan kode BOM-001.

  Dipakai oleh:
  - createProductionBom.

  Alasan perubahan:
  - Kode BOM final tidak boleh input manual; nama target/komposisi menjadi konteks utama di UI.

  Catatan cleanup:
  - Data lama/manual code tetap compatibility, tidak di-rename.

  Risiko:
  - Jangan mengubah materialLines/stepLines/HPP BOM dari section ini.
  ===================================================== */
  const resultRef = doc(db, COLLECTION_NAME, normalizedCode);
  await setDoc(resultRef, payload);

  return resultRef.id;
};

// =====================================================
// SECTION: update BOM
// =====================================================
export const updateProductionBom = async (id, values, currentUser = null) => {
  const errors = validateProductionBom(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("Data BOM produksi tidak ditemukan");
  }

  const existingBom = { id: snapshot.id, ...snapshot.data() };
  // IMS NOTE [AKTIF | immutable-code]: UI tidak mengirim code; update wajib mempertahankan code/bomCode existing agar edit target/komposisi tidak regenerate kode BOM.
  const existingCode = safeTrim(existingBom.code || existingBom.bomCode).toUpperCase();
  const normalizedCode = existingCode || (await generateProductionBomCode(values, id));
  const isCodeExists = await isProductionBomCodeExists(normalizedCode, id);

  if (isCodeExists) {
    throw {
      type: "validation",
      errors: {
        code: "Kode BOM sudah digunakan",
      },
    };
  }

  const referenceData = await getActiveBomReferenceData();
  const payload = normalizePayload({ ...values, code: normalizedCode }, currentUser, true, referenceData);

  await updateDoc(ref, {
    ...payload,
    // IMS CLEANUP: field header lama tidak lagi dipakai UI/rule aktif.
    notes: deleteField(),
  });

  return id;
};

// =====================================================
// SECTION: toggle aktif/nonaktif BOM
// =====================================================
export const toggleProductionBomActive = async (
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
