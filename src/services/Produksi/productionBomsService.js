// =====================================================
// Production BOMs Service
// CRUD Firestore untuk collection production_boms
// Rule final:
// - target product -> material hanya semi_finished_material
// - target semi_finished_material -> material raw / semi_finished_material
// =====================================================

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  calculateBomMaterialLine,
  calculateBomTotals,
} from "../../constants/productionBomOptions";
import { inferHasVariants } from "../../utils/variants/variantStockHelpers";

const COLLECTION_NAME = "production_boms";

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
// - target product -> itemType dipaksa semi_finished_material
// =====================================================
const normalizeMaterialLines = (materialLines = [], targetType = "") =>
  materialLines.map((line, index) => {
    const forcedItemType =
      targetType === "product"
        ? "semi_finished_material"
        : line.itemType || "raw_material";

    return calculateBomMaterialLine({
      id: line.id || `material-${Date.now()}-${index}`,
      itemType: forcedItemType,
      itemId: line.itemId || "",
      itemCode: safeTrim(line.itemCode),
      itemName: safeTrim(line.itemName),
      unit: safeTrim(line.unit) || "pcs",
      qtyPerBatch: Number(line.qtyPerBatch || 0),
      wastageQty: Number(line.wastageQty || 0),
      costPerUnitSnapshot: Number(line.costPerUnitSnapshot || 0),
      materialHasVariants: line.materialHasVariants === true,
      materialVariantStrategy:
        line.materialHasVariants === true
          ? line.materialVariantStrategy || 'inherit'
          : 'none',
      fixedVariantKey: safeTrim(line.fixedVariantKey),
      fixedVariantLabel: safeTrim(line.fixedVariantLabel),
      isOptional: false,
      notes: safeTrim(line.notes),
    });
  });

// =====================================================
// SECTION: normalize step lines
// =====================================================
const normalizeStepLines = (stepLines = []) =>
  stepLines
    .map((line, index) => ({
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

      payrollMode: "per_qty",
      payrollRate: 0,
      payrollQtyBase: 1,
      payrollOutputBasis: "good_qty",
      useStepDefaultPayroll: true,

      notes: safeTrim(line.notes),
    }))
    .sort((a, b) => Number(a.sequenceNo || 0) - Number(b.sequenceNo || 0));

// =====================================================
// SECTION: validasi dasar BOM
// Rule final:
// - target product -> semua material wajib semi_finished_material
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


  if (values.targetType === "product") {
    const hasInvalidMaterial = (values.materialLines || []).some(
      (line) => line.itemType && line.itemType !== "semi_finished_material",
    );

    if (hasInvalidMaterial) {
      errors.materialLines =
        "BOM product hanya boleh menggunakan material dari semi finished materials";
    }
  }


  return errors;
};

// =====================================================
// SECTION: normalize payload BOM
// =====================================================
const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const targetType = values.targetType || "product";
  const materialLines = normalizeMaterialLines(
    values.materialLines || [],
    targetType,
  );
  const stepLines = normalizeStepLines(values.stepLines || []);
  const totals = calculateBomTotals(materialLines, stepLines, values);

  const payload = {
    code: safeTrim(values.code).toUpperCase() || safeTrim(values.targetCode).toUpperCase() || `BOM-${Date.now()}`,
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
    overheadCostEstimate: Number(values.overheadCostEstimate || 0),
    totalCostEstimate:
      totals.materialCostEstimate +
      totals.laborCostEstimate +
      Number(values.overheadCostEstimate || 0),

    routingMode: values.routingMode || "multi_step",
    materialLines,
    stepLines,

    notes: safeTrim(values.notes),

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
// SECTION: create BOM
// =====================================================
export const createProductionBom = async (values, currentUser = null) => {
  const errors = validateProductionBom(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const isCodeExists = await isProductionBomCodeExists(values.code);

  if (isCodeExists) {
    throw {
      type: "validation",
      errors: {
        code: "Kode BOM sudah digunakan",
      },
    };
  }

  const payload = normalizePayload(values, currentUser, false);
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);

  return result.id;
};

// =====================================================
// SECTION: update BOM
// =====================================================
export const updateProductionBom = async (id, values, currentUser = null) => {
  const errors = validateProductionBom(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const isCodeExists = await isProductionBomCodeExists(values.code, id);

  if (isCodeExists) {
    throw {
      type: "validation",
      errors: {
        code: "Kode BOM sudah digunakan",
      },
    };
  }

  const payload = normalizePayload(values, currentUser, true);
  const ref = doc(db, COLLECTION_NAME, id);

  await updateDoc(ref, payload);

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
