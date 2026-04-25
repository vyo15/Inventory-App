// =====================================================
// Production Work Logs Service
// CRUD + helper generate dari BOM / Production Order
// Revisi:
// - Work Log dari PO tetap didukung
// - Start Production memotong stok bahan dari requirement PO
// - Complete Work Log hanya menambah stok output dan menutup PO
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
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  calculateMaterialUsageLine,
  calculateOutputLine,
  calculateProductionMonitoring,
} from "../../constants/productionWorkLogOptions";
import { calculateWeightedAverage, normalizeStockSnapshot, toNumber } from "../../utils/stock/stockHelpers";
import {
  applyStockMutationToItem,
  inferHasVariants,
  resolveVariantSelection,
} from "../../utils/variants/variantStockHelpers";
import {
  applyLockedWorkLogCoreFields,
  assertProductionOrderStartable,
  assertProductionWorkLogCompletable,
  isProductionOrderVisibleInWorkLogReference,
  isProductionWorkLogCompleted,
  sortProductionWorkLogsNewestFirst,
} from "../../utils/produksi/productionFlowGuards";
import { buildProductionStepPayrollSnapshot } from "../../utils/produksi/productionPayrollRuleHelpers";

const COLLECTION_NAME = "production_work_logs";

// =====================================================
// Helper filter aktif yang toleran data lama
// - true -> tampil
// - undefined -> tampil
// - false -> tidak tampil
// =====================================================
const filterActiveLike = (items = []) =>
  items.filter((item) => item?.isActive !== false);

// =====================================================
// Helper format aman
// =====================================================
const safeTrim = (value) => String(value || "").trim();


const normalizeReferenceItem = (item = {}) => ({
  ...item,
  hasVariants: inferHasVariants(item),
  code:
    safeTrim(item.code) ||
    safeTrim(item.itemCode) ||
    safeTrim(item.sku) ||
    safeTrim(item.productCode),
  name:
    safeTrim(item.name) ||
    safeTrim(item.productName) ||
    safeTrim(item.materialName) ||
    safeTrim(item.title),
  unit:
    safeTrim(item.unit) ||
    safeTrim(item.stockUnit) ||
    safeTrim(item.baseUnit) ||
    "pcs",
});

const isProductionOrderLinkedValues = (values = {}) =>
  values.sourceType === "production_order" || Boolean(safeTrim(values.productionOrderId));

// =====================================================
// ACTIVE / FINAL - contract varian PO untuk Work Log.
// Source of truth varian setelah PO dibuat adalah field targetVariantKey /
// targetVariantLabel dari PO. Helper ini memastikan output pertama Work Log
// mengikuti target PO dan tidak kembali ke master/default karena form drawer,
// payload extra, atau output line lama.
// =====================================================
const applyProductionOrderVariantContractToOutputs = (values = {}) => {
  if (!isProductionOrderLinkedValues(values)) return values;

  const targetVariantKey = safeTrim(values.targetVariantKey);
  const targetVariantLabel = safeTrim(values.targetVariantLabel);
  const targetHasVariants = values.targetHasVariants === true || Boolean(targetVariantKey);

  if (targetHasVariants && !targetVariantKey) {
    throw new Error(
      "Work Log dari Production Order wajib membawa target variant. Proses dihentikan agar output tidak masuk ke master/default.",
    );
  }

  const outputs = Array.isArray(values.outputs) ? values.outputs : [];
  const firstOutput = outputs[0] || {};
  const normalizedFirstOutput = {
    ...firstOutput,
    outputType: values.targetType || firstOutput.outputType || "product",
    outputIdRef: values.targetId || firstOutput.outputIdRef || "",
    outputCode: safeTrim(values.targetCode || firstOutput.outputCode),
    outputName: safeTrim(values.targetName || firstOutput.outputName),
    unit: safeTrim(values.targetUnit || firstOutput.unit) || "pcs",
    outputHasVariants: targetHasVariants,
    outputVariantKey: targetVariantKey,
    outputVariantLabel: targetVariantLabel,
    stockSourceType: targetVariantKey ? "variant" : "master",
  };

  return {
    ...values,
    targetHasVariants,
    targetVariantKey,
    targetVariantLabel,
    outputs: outputs.length > 0
      ? [normalizedFirstOutput, ...outputs.slice(1)]
      : [normalizedFirstOutput],
  };
};

// =====================================================
// ACTIVE / FINAL - requirement PO yang masuk Work Log harus sudah resolved.
// Jika material bervarian dan strategi BOM inherit/fixed, Work Log tidak boleh
// membawa line master karena source of truth requirement sudah dihitung di PO.
// =====================================================
const assertFinalMaterialVariantLine = (line = {}) => {
  const strategy = line.materialVariantStrategy || (line.resolvedVariantKey ? "fixed" : "inherit");
  const requiresVariant = line.materialHasVariants === true && strategy !== "none";

  if (requiresVariant && (!safeTrim(line.resolvedVariantKey) || line.stockSourceType === "master")) {
    throw new Error(
      `Material ${line.itemName || "produksi"} wajib punya varian resolved dari PO. Proses dihentikan agar tidak fallback ke master/default.`,
    );
  }
};

const getCollectionNameByItemType = (itemType) => {
  if (itemType === "raw_material") return "raw_materials";
  if (itemType === "semi_finished_material") return "semi_finished_materials";
  if (itemType === "product") return "products";
  return "";
};

// =====================================================
// Safe reader referensi produksi
// Catatan maintainability:
// - Menu Work Log tidak boleh ikut gagal total hanya karena 1 koleksi referensi
//   sedang error / index bermasalah / patch schema lain belum sinkron.
// - Jika satu referensi gagal dibaca, halaman tetap boleh terbuka dengan
//   data lainnya yang berhasil dimuat.
// =====================================================
const readCollectionDocsSafely = async (
  collectionName,
  fallbackItems = [],
  warningLabel = collectionName,
) => {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return {
      items: snapshot.docs.map((documentItem) => ({
        id: documentItem.id,
        ...documentItem.data(),
      })),
      warning: null,
    };
  } catch (error) {
    console.error(`Gagal memuat referensi ${collectionName}`, error);
    return {
      items: fallbackItems,
      warning: `${warningLabel} gagal dimuat. Halaman tetap dibuka dengan data yang tersedia.`,
    };
  }
};

const getItemUnitCost = (itemType, data = {}) => {
  if (itemType === "raw_material") {
    return toNumber(data.averageActualUnitCost || data.costPerUnit || 0);
  }

  if (itemType === "semi_finished_material") {
    return toNumber(
      data.averageCostPerUnit || data.lastProductionCostPerUnit || 0,
    );
  }

  if (itemType === "product") {
    return toNumber(data.hppPerUnit || 0);
  }

  return 0;
};


// =====================================================
// Normalize material usages
// =====================================================
const normalizeMaterialUsages = (lines = []) =>
  lines.map((line, index) =>
    calculateMaterialUsageLine({
      id: line.id || `usage-${Date.now()}-${index}`,
      itemType: line.itemType || "raw_material",
      itemId: line.itemId || "",
      itemCode: safeTrim(line.itemCode),
      itemName: safeTrim(line.itemName),
      unit: safeTrim(line.unit) || "pcs",
      plannedQty: toNumber(line.plannedQty || 0),
      actualQty: toNumber(line.actualQty || 0),
      costPerUnitSnapshot: toNumber(line.costPerUnitSnapshot || 0),
      materialHasVariants: Boolean(line.materialHasVariants),
      materialVariantStrategy: safeTrim(line.materialVariantStrategy) || (line.materialHasVariants ? "fixed" : "none"),
      resolvedVariantKey: safeTrim(line.resolvedVariantKey),
      resolvedVariantLabel: safeTrim(line.resolvedVariantLabel),
      stockSourceType: safeTrim(line.stockSourceType) || (line.resolvedVariantKey ? "variant" : "master"),
      stockDeducted: Boolean(line.stockDeducted),
      stockDeductedAt: line.stockDeductedAt || null,
      notes: safeTrim(line.notes),
    }),
  );

// =====================================================
// Normalize outputs
// =====================================================
const normalizeOutputs = (lines = []) =>
  lines.map((line, index) =>
    calculateOutputLine({
      id: line.id || `output-${Date.now()}-${index}`,
      outputType: line.outputType || "semi_finished_material",
      outputIdRef: line.outputIdRef || "",
      outputCode: safeTrim(line.outputCode),
      outputName: safeTrim(line.outputName),
      unit: safeTrim(line.unit) || "pcs",
      goodQty: toNumber(line.goodQty || 0),
      rejectQty: toNumber(line.rejectQty || 0),
      reworkQty: toNumber(line.reworkQty || 0),
      costPerUnit: toNumber(line.costPerUnit || 0),
      outputHasVariants: Boolean(line.outputHasVariants),
      outputVariantKey: safeTrim(line.outputVariantKey),
      outputVariantLabel: safeTrim(line.outputVariantLabel),
      stockSourceType: safeTrim(line.stockSourceType) || (line.outputVariantKey ? "variant" : "master"),
      stockAdded: Boolean(line.stockAdded),
      stockAddedAt: line.stockAddedAt || null,
      notes: safeTrim(line.notes),
    }),
  );

// =====================================================
// Normalize payload work log
// =====================================================
const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  // ACTIVE / FINAL: sebelum payload dinormalisasi, kunci lagi contract
  // PO target variant -> Work Log output variant di service layer.
  // Ini menjadi guard terakhir jika drawer/form mengirim output master.
  values = applyProductionOrderVariantContractToOutputs(values);

  const materialUsages = normalizeMaterialUsages(values.materialUsages || []);
  const outputs = normalizeOutputs(values.outputs || []);
  const monitoring = calculateProductionMonitoring(values.productionProfile || {}, values);
  const stepPayrollSnapshot = buildProductionStepPayrollSnapshot({
    stepId: values.stepId,
    stepCode: values.stepCode,
    stepName: values.stepName,
    payrollMode: values.stepPayrollMode,
    payrollRate: values.stepPayrollRate,
    payrollQtyBase: values.stepPayrollQtyBase,
    payrollOutputBasis: values.stepPayrollOutputBasis,
    payrollClassification: values.stepPayrollClassification,
    includePayrollInHpp: values.stepPayrollIncludeInHpp,
    processType: values.stepProcessType,
  });

  const materialCostActual = materialUsages.reduce(
    (sum, item) => sum + toNumber(item.totalCostSnapshot || 0),
    0,
  );

  const laborCostActual = toNumber(values.laborCostActual || 0);
  const overheadCostActual = toNumber(values.overheadCostActual || 0);
  const totalCostActual =
    materialCostActual + laborCostActual + overheadCostActual;

  const goodQty = toNumber(values.goodQty || 0);
  const costPerGoodUnit = goodQty > 0 ? totalCostActual / goodQty : 0;

  const payload = {
    workNumber: safeTrim(values.workNumber).toUpperCase(),
    workDate: values.workDate || null,

    // SECTION: link BOM
    bomId: values.bomId || "",
    bomCode: safeTrim(values.bomCode),
    bomName: safeTrim(values.bomName),
    bomVersion: values.bomVersion ?? null,

    // SECTION: link Production Order
    productionOrderId: values.productionOrderId || "",
    productionOrderCode: safeTrim(values.productionOrderCode),
    productionOrderStatusSnapshot: safeTrim(
      values.productionOrderStatusSnapshot,
    ),

    productionProfileId: values.productionProfileId || "",
    productionProfileName: safeTrim(values.productionProfileName),

    baseInputQty: toNumber(monitoring.baseInputQty || values.baseInputQty || 0),
    baseInputUnit: safeTrim(values.baseInputUnit),
    theoreticalOutputQty: toNumber(monitoring.theoreticalOutputQty || values.theoreticalOutputQty || 0),
    theoreticalFlowerEquivalent: toNumber(monitoring.theoreticalFlowerEquivalent || values.theoreticalFlowerEquivalent || 0),
    leftoverLeafQty: toNumber(monitoring.leftoverLeafQty || values.leftoverLeafQty || 0),
    leftoverStemQty: toNumber(monitoring.leftoverStemQty || values.leftoverStemQty || 0),
    leftoverPetalFlowerEquivalent: toNumber(monitoring.leftoverPetalFlowerEquivalent || values.leftoverPetalFlowerEquivalent || 0),
    missPetalFlowerEquivalent: toNumber(monitoring.missPetalFlowerEquivalent || values.missPetalFlowerEquivalent || 0),
    missPetalQty: toNumber(monitoring.missPetalQty || values.missPetalQty || 0),
    missLeafQty: toNumber(monitoring.missLeafQty || values.missLeafQty || 0),
    missStemQty: toNumber(monitoring.missStemQty || values.missStemQty || 0),
    missPercent: toNumber(monitoring.missPercent || values.missPercent || 0),
    missStatus: values.missStatus || monitoring.missStatus || 'normal',

    // SECTION: target
    targetType: values.targetType || "product",
    targetId: values.targetId || "",
    targetCode: safeTrim(values.targetCode),
    targetName: safeTrim(values.targetName),
    targetUnit: safeTrim(values.targetUnit) || "pcs",
    targetHasVariants: values.targetHasVariants === true,
    targetVariantKey: safeTrim(values.targetVariantKey),
    targetVariantLabel: safeTrim(values.targetVariantLabel),

    // SECTION: step
    stepId: values.stepId || "",
    stepCode: safeTrim(values.stepCode),
    stepName: safeTrim(values.stepName),
    sequenceNo: toNumber(values.sequenceNo || 1),

    // =====================================================
    // SECTION: snapshot payroll rule step
    // ACTIVE / GUARDED
    // Fungsi:
    // - menyimpan snapshot rule payroll dari master Tahapan Produksi
    //   ke Work Log saat record dibuat / diupdate.
    // - payroll baru wajib membaca snapshot ini agar audit stabil walau
    //   master step berubah di kemudian hari.
    // =====================================================
    stepPayrollMode: stepPayrollSnapshot.payrollMode,
    stepPayrollRate: stepPayrollSnapshot.payrollRate,
    stepPayrollQtyBase: stepPayrollSnapshot.payrollQtyBase,
    stepPayrollOutputBasis: stepPayrollSnapshot.payrollOutputBasis,
    stepPayrollClassification: stepPayrollSnapshot.payrollClassification,
    stepPayrollIncludeInHpp: stepPayrollSnapshot.includePayrollInHpp,
    stepProcessType: values.stepProcessType || "",
    stepPayrollRuleSource: values.stepPayrollRuleSource || "production_step",

    // SECTION: source
    sourceType: values.sourceType || "manual",
    status: values.status || "draft",

    // SECTION: qty
    plannedQty: toNumber(values.plannedQty || 0),
    actualOutputQty: toNumber(values.actualOutputQty || 0),
    goodQty: toNumber(values.goodQty || 0),
    rejectQty: toNumber(values.rejectQty || 0),
    reworkQty: toNumber(values.reworkQty || 0),
    scrapQty: toNumber(values.scrapQty || 0),

    // SECTION: time
    startedAt: values.startedAt || null,
    completedAt: values.completedAt || null,
    durationMinutesActual: toNumber(values.durationMinutesActual || 0),

    // SECTION: workers
    workerIds: Array.isArray(values.workerIds) ? values.workerIds : [],
    workerCodes: Array.isArray(values.workerCodes) ? values.workerCodes : [],
    workerNames: Array.isArray(values.workerNames) ? values.workerNames : [],
    workerCount: toNumber(values.workerCount || 0),

    // SECTION: costing
    materialCostActual,
    laborCostActual,
    overheadCostActual,
    totalCostActual,
    costPerGoodUnit,

    // SECTION: stock/payroll flags
    stockConsumptionStatus: values.stockConsumptionStatus || "pending",
    stockOutputStatus: values.stockOutputStatus || "pending",
    payrollCalculated: Boolean(values.payrollCalculated),
    payrollCalculationStatus: values.payrollCalculationStatus || "pending",

    // SECTION: lines
    materialUsages,
    outputs,

    notes: safeTrim(values.notes),
    cancellationReason: safeTrim(values.cancellationReason),

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
// Validasi dasar work log
// =====================================================
export const validateProductionWorkLog = (values = {}) => {
  const errors = {};

  if (!safeTrim(values.workNumber)) {
    errors.workNumber = "Nomor work log wajib diisi";
  }

  if (!values.workDate) {
    errors.workDate = "Tanggal work log wajib diisi";
  }

  if (!values.targetType) {
    errors.targetType = "Target type wajib dipilih";
  }

  if (!values.targetId) {
    errors.targetId = "Target item wajib dipilih";
  }

  if (!values.stepId) {
    errors.stepId = "Step wajib dipilih";
  }

  if (toNumber(values.plannedQty || 0) <= 0) {
    errors.plannedQty = "Planned qty harus lebih dari 0";
  }

  if (
    !Array.isArray(values.materialUsages) ||
    values.materialUsages.length === 0
  ) {
    errors.materialUsages = "Minimal harus ada 1 material usage";
  }

  if (!Array.isArray(values.outputs) || values.outputs.length === 0) {
    errors.outputs = "Minimal harus ada 1 output";
  }

  return errors;
};

// =====================================================
// Reference data work log
// =====================================================
export const getWorkLogReferenceData = async () => {
  const [
    bomsResult,
    ordersResult,
    employeesResult,
    rawResult,
    semiResult,
    productsResult,
    stepsResult,
    profilesResult,
  ] = await Promise.all([
    readCollectionDocsSafely("production_boms", [], "Referensi BOM produksi"),
    readCollectionDocsSafely("production_orders", [], "Referensi Production Order"),
    readCollectionDocsSafely("production_employees", [], "Referensi karyawan produksi"),
    readCollectionDocsSafely("raw_materials", [], "Referensi bahan baku"),
    readCollectionDocsSafely("semi_finished_materials", [], "Referensi semi finished"),
    readCollectionDocsSafely("products", [], "Referensi produk"),
    readCollectionDocsSafely("production_steps", [], "Referensi step produksi"),
    readCollectionDocsSafely("production_profiles", [], "Referensi profil produksi"),
  ]);

  const productionOrders = (ordersResult.items || []).filter(
    isProductionOrderVisibleInWorkLogReference,
  );

  return {
    boms: filterActiveLike((bomsResult.items || []).map((item) => ({ ...item }))),
    productionOrders: productionOrders,
    employees: filterActiveLike(
      (employeesResult.items || []).map((item) =>
        normalizeReferenceItem({
          ...item,
        }),
      ),
    ),
    rawMaterials: filterActiveLike(
      (rawResult.items || []).map((item) =>
        normalizeReferenceItem({
          ...item,
        }),
      ),
    ),
    semiFinishedMaterials: filterActiveLike(
      (semiResult.items || []).map((item) =>
        normalizeReferenceItem({
          ...item,
        }),
      ),
    ),
    products: filterActiveLike(
      (productsResult.items || []).map((item) =>
        normalizeReferenceItem({
          ...item,
        }),
      ),
    ),
    productionSteps: filterActiveLike(
      (stepsResult.items || []).map((item) =>
        normalizeReferenceItem({
          ...item,
        }),
      ),
    ),
    productionProfiles: filterActiveLike(
      (profilesResult.items || []).map((item) => ({ ...item })),
    ),
    metaWarnings: [
      bomsResult.warning,
      ordersResult.warning,
      employeesResult.warning,
      rawResult.warning,
      semiResult.warning,
      productsResult.warning,
      stepsResult.warning,
      profilesResult.warning,
    ].filter(Boolean),
  };
};

// =====================================================
// Draft work log dari BOM
// LEGACY / TRANSISI:
// - Jalur planned/manual tidak punya pilihan target variant dari PO.
// - Output default boleh terbentuk tanpa varian, tetapi complete akan tetap
//   memblok item bervarian sampai user memilih varian output secara eksplisit.
// - Jangan pakai jalur ini sebagai source of truth flow final PO variant.
// =====================================================
export const buildWorkLogDraftFromBom = (bom, selectedStepId = "") => {
  const stepLines = Array.isArray(bom?.stepLines) ? bom.stepLines : [];
  const materialLines = Array.isArray(bom?.materialLines)
    ? bom.materialLines
    : [];

  const chosenStep =
    stepLines.find((item) => item.stepId === selectedStepId) ||
    stepLines[0] ||
    null;

  const outputs = chosenStep
    ? [
        {
          outputType: chosenStep.outputType || bom.targetType || "product",
          outputIdRef: chosenStep.outputItemId || bom.targetId || "",
          outputCode: chosenStep.outputItemCode || bom.targetCode || "",
          outputName: chosenStep.outputItemName || bom.targetName || "",
          unit: bom.targetUnit || "pcs",
          goodQty: toNumber(
            chosenStep.expectedOutputQty || bom.batchOutputQty || 0,
          ),
          rejectQty: 0,
          reworkQty: 0,
          costPerUnit: 0,
          stockAdded: false,
          stockAddedAt: null,
          notes: "",
        },
      ]
    : [];

  return {
    bomId: bom?.id || "",
    bomCode: bom?.code || "",
    bomName: bom?.name || "",
    bomVersion: bom?.version ?? null,

    productionOrderId: "",
    productionOrderCode: "",
    productionOrderStatusSnapshot: "",

    targetType: bom?.targetType || "product",
    targetId: bom?.targetId || "",
    targetCode: bom?.targetCode || "",
    targetName: bom?.targetName || "",
    targetUnit: bom?.targetUnit || "pcs",

    stepId: chosenStep?.stepId || "",
    stepCode: chosenStep?.stepCode || "",
    stepName: chosenStep?.stepName || "",
    sequenceNo: toNumber(chosenStep?.sequenceNo || 1),

    sourceType: "planned",
    plannedQty: toNumber(
      chosenStep?.expectedOutputQty || bom?.batchOutputQty || 1,
    ),
    actualOutputQty: 0,
    goodQty: 0,
    rejectQty: 0,
    reworkQty: 0,
    scrapQty: 0,

    materialUsages: materialLines.map((line, index) => ({
      id: line.id || `usage-${Date.now()}-${index}`,
      itemType: line.itemType,
      itemId: line.itemId,
      itemCode: line.itemCode,
      itemName: line.itemName,
      unit: line.unit,
      plannedQty: toNumber(line.totalRequiredQty || line.qtyPerBatch || 0),
      actualQty: toNumber(line.totalRequiredQty || line.qtyPerBatch || 0),
      varianceQty: 0,
      costPerUnitSnapshot: toNumber(line.costPerUnitSnapshot || 0),
      totalCostSnapshot: toNumber(line.totalCostSnapshot || 0),
      materialHasVariants: line.materialHasVariants === true,
      materialVariantStrategy: line.materialHasVariants === true ? line.materialVariantStrategy || "inherit" : "none",
      resolvedVariantKey: line.resolvedVariantKey || "",
      resolvedVariantLabel: line.resolvedVariantLabel || "",
      stockSourceType: line.resolvedVariantKey ? "variant" : "master",
      stockDeducted: false,
      stockDeductedAt: null,
      notes: line.notes || "",
    })),

    outputs: outputs.map((line) => ({
      ...line,
      outputHasVariants: false,
      outputVariantKey: "",
      outputVariantLabel: "",
      stockSourceType: "master",
    })),
  };
};

// =====================================================
// Draft work log dari Production Order
// =====================================================
export const buildWorkLogDraftFromProductionOrder = async (
  productionOrder,
  selectedStepId = "",
) => {
  if (!productionOrder?.bomId) {
    throw new Error("BOM pada production order tidak ditemukan");
  }

  const bomRef = doc(db, "production_boms", productionOrder.bomId);
  const bomSnap = await getDoc(bomRef);

  if (!bomSnap.exists()) {
    throw new Error("BOM dari production order tidak ditemukan");
  }

  const bom = { id: bomSnap.id, ...bomSnap.data() };
  const stepLines = Array.isArray(bom.stepLines) ? bom.stepLines : [];
  const requirementLines = Array.isArray(productionOrder.materialRequirementLines)
    ? productionOrder.materialRequirementLines
    : [];

  const chosenStep =
    stepLines.find((item) => item.stepId === selectedStepId) ||
    stepLines[0] ||
    null;

  // =====================================================
  // Qty work log dibedakan jelas:
  // - plannedQty = qty batch produksi
  // - theoreticalOutputQty = estimasi output BOM x qty batch
  // =====================================================
  const batchCount = toNumber(productionOrder.batchCount || productionOrder.orderQty || 0);
  const expectedOutputQty = toNumber(
    productionOrder.expectedOutputQty ||
      toNumber(productionOrder.batchOutputQty || 0) * batchCount,
  );

  const targetCollectionName = getCollectionNameByItemType(
    productionOrder.targetType || bom.targetType || "product",
  );
  let targetItem = null;

  if (targetCollectionName && (productionOrder.targetId || bom.targetId)) {
    const targetRef = doc(db, targetCollectionName, productionOrder.targetId || bom.targetId);
    const targetSnap = await getDoc(targetRef);
    if (targetSnap.exists()) {
      targetItem = normalizeReferenceItem({ id: targetSnap.id, ...targetSnap.data() });
    }
  }

  const targetHasVariants =
    inferHasVariants(targetItem || {}) ||
    productionOrder.targetHasVariants === true ||
    Boolean(safeTrim(productionOrder.targetVariantKey));

  let resolvedTargetVariantKey = safeTrim(productionOrder.targetVariantKey);
  let resolvedTargetVariantLabel = safeTrim(productionOrder.targetVariantLabel);

  if (targetHasVariants) {
    if (!targetItem) {
      throw new Error("Target output Production Order tidak ditemukan untuk validasi varian");
    }

    const targetResolution = resolveVariantSelection({
      item: targetItem,
      materialVariantStrategy: "fixed",
      targetVariantKey: resolvedTargetVariantKey,
      targetVariantLabel: resolvedTargetVariantLabel,
      fixedVariantKey: resolvedTargetVariantKey,
      fixedVariantLabel: resolvedTargetVariantLabel,
      allowMasterFallback: false,
      contextLabel: "Varian output Production Order",
    });

    resolvedTargetVariantKey = targetResolution.resolvedVariantKey || resolvedTargetVariantKey;
    resolvedTargetVariantLabel = targetResolution.resolvedVariantLabel || resolvedTargetVariantLabel;
  }

  return {
    bomId: bom.id,
    bomCode: bom.code || "",
    bomName: bom.name || "",
    bomVersion: bom.version ?? null,

    productionOrderId: productionOrder.id || "",
    productionOrderCode: productionOrder.code || "",
    productionOrderStatusSnapshot: productionOrder.status || "",

    targetType: productionOrder.targetType || bom.targetType || "product",
    targetId: productionOrder.targetId || bom.targetId || "",
    targetCode: productionOrder.targetCode || bom.targetCode || "",
    targetName: productionOrder.targetName || bom.targetName || "",
    targetUnit: productionOrder.targetUnit || bom.targetUnit || "pcs",
    // ACTIVE / FINAL: snapshot target variant Work Log selalu dari PO.
    // Field ini adalah source of truth turunan untuk output dan audit stok.
    targetHasVariants,
    targetVariantKey: resolvedTargetVariantKey,
    targetVariantLabel: resolvedTargetVariantLabel,

    stepId: chosenStep?.stepId || "",
    stepCode: chosenStep?.stepCode || "",
    stepName: chosenStep?.stepName || "",
    sequenceNo: toNumber(chosenStep?.sequenceNo || 1),

    sourceType: "production_order",
    plannedQty: batchCount,
    theoreticalOutputQty: expectedOutputQty,
    actualOutputQty: 0,
    goodQty: 0,
    rejectQty: 0,
    reworkQty: 0,
    scrapQty: 0,

    materialUsages: requirementLines.map((line, index) => {
      assertFinalMaterialVariantLine(line);

      return {
        id: line.id || `usage-po-${Date.now()}-${index}`,
        itemType: line.itemType || "raw_material",
        itemId: line.itemId || "",
        itemCode: line.itemCode || "",
        itemName: line.itemName || "",
        unit: line.unit || "pcs",
        plannedQty: toNumber(line.qtyRequired || 0),
        actualQty: toNumber(line.qtyRequired || 0),
        varianceQty: 0,
        costPerUnitSnapshot: 0,
        totalCostSnapshot: 0,
        materialHasVariants: line.materialHasVariants === true,
        materialVariantStrategy: line.materialVariantStrategy || (line.materialHasVariants ? "inherit" : "none"),
        resolvedVariantKey: line.resolvedVariantKey || "",
        resolvedVariantLabel: line.resolvedVariantLabel || "",
        stockSourceType: line.stockSourceType || (line.resolvedVariantKey ? "variant" : "master"),
        stockDeducted: false,
        stockDeductedAt: null,
        notes: "",
      };
    }),

    outputs: [
      {
        id: `output-po-${Date.now()}`,
        outputType: productionOrder.targetType || "product",
        outputIdRef: productionOrder.targetId || "",
        outputCode: productionOrder.targetCode || "",
        outputName: productionOrder.targetName || "",
        unit: productionOrder.targetUnit || "pcs",
        goodQty: 0,
        rejectQty: 0,
        reworkQty: 0,
        costPerUnit: 0,
        // ACTIVE / FINAL: output hasil PO wajib mengikuti varian target PO.
        // Tidak ada fallback master jika targetVariantKey sudah dipilih user.
        outputHasVariants: targetHasVariants,
        outputVariantKey: resolvedTargetVariantKey,
        outputVariantLabel: resolvedTargetVariantLabel,
        stockSourceType: resolvedTargetVariantKey ? "variant" : "master",
        stockAdded: false,
        stockAddedAt: null,
        notes: "",
      },
    ],
  };
};

// =====================================================
// Generate nomor work log
// =====================================================
export const generateProductionWorkLogNumber = async () => {
  const snapshot = await getDocs(collection(db, COLLECTION_NAME));
  const nextNumber = snapshot.size + 1;
  return `WL-${String(nextNumber).padStart(4, "0")}`;
};

// =====================================================
// Ambil semua work logs
// =====================================================
export const getAllProductionWorkLogs = async () => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      orderBy("workDate", "desc"),
      orderBy("workNumber", "desc"),
    );

    const snapshot = await getDocs(q);

    return sortProductionWorkLogsNewestFirst(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })),
    );
  } catch (error) {
    console.error("Query work log utama gagal, pakai fallback", error);
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return sortProductionWorkLogsNewestFirst(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })),
    );
  }
};

export const getCompletedProductionWorkLogs = async () => {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("status", "==", "completed"),
      orderBy("workDate", "desc"),
    );

    const snapshot = await getDocs(q);

    return sortProductionWorkLogsNewestFirst(
      snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
      })),
    );
  } catch (error) {
    console.error("Query work log completed gagal, pakai fallback", error);
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return sortProductionWorkLogsNewestFirst(
      snapshot.docs
        .map((item) => ({
          id: item.id,
          ...item.data(),
        }))
        .filter((item) => item.status === "completed"),
    );
  }
};

export const getProductionWorkLogById = async (id) => {
  const ref = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    throw new Error("Data work log produksi tidak ditemukan");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
};

export const isProductionWorkLogNumberExists = async (
  workNumber,
  excludeId = null,
) => {
  const normalized = safeTrim(workNumber).toUpperCase();

  if (!normalized) return false;

  const q = query(
    collection(db, COLLECTION_NAME),
    where("workNumber", "==", normalized),
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) return false;

  const found = snapshot.docs.find((item) => item.id !== excludeId);
  return Boolean(found);
};

// =====================================================
// Create work log manual / planned
// =====================================================
export const createProductionWorkLog = async (values, currentUser = null) => {
  const errors = validateProductionWorkLog(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const exists = await isProductionWorkLogNumberExists(values.workNumber);

  if (exists) {
    throw {
      type: "validation",
      errors: {
        workNumber: "Nomor work log sudah digunakan",
      },
    };
  }

  const payload = normalizePayload(values, currentUser, false);
  const result = await addDoc(collection(db, COLLECTION_NAME), payload);

  return result.id;
};

// =====================================================
// Inventory log helper
// Catatan maintainability:
// - Dipakai oleh flow aktif produksi untuk jejak mutasi stok.
// - Start Production = log OUT bahan.
// - Complete Work Log = log IN output target.
// =====================================================
const addInventoryLogInTransaction = (transaction, {
  itemId = '',
  itemName = '',
  quantityChange = 0,
  type = '',
  collectionName = '',
  extraData = {},
} = {}) => {
  const logRef = doc(collection(db, 'inventory_logs'));
  transaction.set(logRef, {
    itemId,
    itemName,
    quantityChange: toNumber(quantityChange || 0),
    type,
    collectionName,
    timestamp: Timestamp.now(),
    ...extraData,
  });
};

// =====================================================
// Create work log langsung dari Production Order
// =====================================================
// =====================================================
// Create work log dari PO + langsung mulai produksi
// Catatan maintainability:
// - 1 PO = 1 Work Log
// - Start Production memotong stok bahan dari requirement PO
// - Setelah start, PO -> in_production dan Work Log -> in_progress
// =====================================================
export const createProductionWorkLogFromOrder = async (
  orderId,
  extraValues = {},
  currentUser = null,
) => {
  const actor = currentUser?.email || currentUser?.displayName || currentUser?.uid || "system";
  const orderRef = doc(db, "production_orders", orderId);
  const workNumber = safeTrim(extraValues.workNumber) || (await generateProductionWorkLogNumber());

  return await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error("Production order tidak ditemukan");
    }

    const order = { id: orderSnap.id, ...orderSnap.data() };
    assertProductionOrderStartable(order);

    const draft = await buildWorkLogDraftFromProductionOrder(order);
    const payload = normalizePayload(
      {
        ...draft,
        ...extraValues,
        // ACTIVE / FINAL: field inti PO ditulis ulang dari draft PO setelah
        // extraValues supaya payload drawer tidak bisa mengubah target/output
        // variant ke master/default secara tidak sengaja.
        bomId: draft.bomId,
        bomCode: draft.bomCode,
        bomName: draft.bomName,
        bomVersion: draft.bomVersion,
        productionOrderId: draft.productionOrderId,
        productionOrderCode: draft.productionOrderCode,
        productionOrderStatusSnapshot: draft.productionOrderStatusSnapshot,
        targetType: draft.targetType,
        targetId: draft.targetId,
        targetCode: draft.targetCode,
        targetName: draft.targetName,
        targetUnit: draft.targetUnit,
        targetHasVariants: draft.targetHasVariants,
        targetVariantKey: draft.targetVariantKey,
        targetVariantLabel: draft.targetVariantLabel,
        materialUsages: draft.materialUsages,
        outputs: draft.outputs,
        workNumber,
        workDate: extraValues.workDate || new Date(),
        sourceType: "production_order",
        status: "in_progress",
        stockConsumptionStatus: "applied",
        stockOutputStatus: "pending",
        startedAt: new Date(),
      },
      currentUser,
      false,
    );

    // SECTION: workLogRef dibuat lebih awal karena id-nya dipakai oleh inventory log
    // saat mutasi bahan keluar dalam transaksi start production.
    const workLogRef = doc(collection(db, COLLECTION_NAME));
    const nextMaterialUsages = [];
    for (const line of payload.materialUsages || []) {
      const collectionName = getCollectionNameByItemType(line.itemType);
      if (!collectionName || !line.itemId) {
        nextMaterialUsages.push(line);
        continue;
      }

      const stockRef = doc(db, collectionName, line.itemId);
      const stockSnap = await transaction.get(stockRef);
      if (!stockSnap.exists()) {
        throw new Error(`Item material ${line.itemName || "-"} tidak ditemukan`);
      }

      const stockItem = normalizeReferenceItem({ id: stockSnap.id, ...stockSnap.data() });
      const stockResolution = getResolvedMaterialStock({ line, stockItem });
      const consumeQty = toNumber(line.actualQty || line.plannedQty || 0);
      if (toNumber(stockResolution.currentStock || 0) < consumeQty) {
        throw new Error(`Stok ${line.itemName || "material"} tidak cukup untuk mulai produksi`);
      }

      const updatePayload = applyStockMutationToItem({
        item: stockItem,
        variantKey: stockResolution.resolvedVariantKey || "",
        deltaCurrent: -consumeQty,
      });
      transaction.update(stockRef, { ...updatePayload, updatedAt: serverTimestamp() });

      // SECTION: tulis log mutasi bahan keluar saat mulai produksi
      // Catatan maintainability:
      // - Metadata referensi sengaja dibuat lengkap agar menu Manajemen Stok
      //   bisa menampilkan jejak Produksi -> PO -> Work Log secara jelas.
      if (consumeQty > 0) {
        addInventoryLogInTransaction(transaction, {
          itemId: line.itemId,
          itemName: line.itemName || stockItem.name || '-',
          quantityChange: -consumeQty,
          type: 'production_material_out',
          collectionName,
          extraData: {
            workLogRefId: workLogRef.id,
            workNumber: payload.workNumber || '',
            productionOrderId: order.id,
            productionOrderCode: order.code || '',
            stepName: payload.stepName || order.stepName || '',
            movementSource: 'production',
            variantKey: stockResolution.resolvedVariantKey || '',
            variantLabel: stockResolution.resolvedVariantLabel || '',
          },
        });
      }

      nextMaterialUsages.push(
        calculateMaterialUsageLine({
          ...line,
          actualQty: consumeQty,
          stockDeducted: consumeQty > 0,
          stockDeductedAt: new Date(),
          resolvedVariantKey: stockResolution.resolvedVariantKey || "",
          resolvedVariantLabel: stockResolution.resolvedVariantLabel || "",
          stockSourceType: stockResolution.stockSourceType || "master",
        }),
      );
    }

    transaction.set(workLogRef, {
      ...payload,
      materialUsages: nextMaterialUsages,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actor,
      updatedBy: actor,
    });

    transaction.update(orderRef, {
      status: "in_production",
      workLogIds: [workLogRef.id],
      generatedWorkLogCount: 1,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });

    return workLogRef.id;
  });
};

// =====================================================
// Update work log
// Catatan maintainability:
// - Data readonly dari PO tetap dipertahankan dari record lama
// - Summary qty (good/reject/rework) selalu disinkronkan ke output pertama
// =====================================================
export const updateProductionWorkLog = async (
  id,
  values,
  currentUser = null,
) => {
  const ref = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Work log tidak ditemukan");
  }

  const current = { id: snap.id, ...snap.data() };

  // =====================================================
  // Guard update work log produksi
  // Catatan maintainability:
  // - Work log completed dianggap locked agar stok output / payroll / HPP
  //   tidak berubah diam-diam oleh patch UI lain.
  // - Work log yang sudah linked ke PO tetap boleh update biaya/catatan/operator,
  //   tetapi field inti flow produksi dikunci oleh helper guard.
  // =====================================================
  if (isProductionWorkLogCompleted(current)) {
    throw new Error(
      "Work log completed sudah terkunci. Jika perlu perubahan, evaluasi khusus flow produksi harus dilakukan terlebih dahulu.",
    );
  }

  const mergedValues = {
    ...current,
    ...values,
    materialUsages:
      Array.isArray(values.materialUsages) && values.materialUsages.length > 0
        ? values.materialUsages
        : current.materialUsages || [],
    outputs:
      Array.isArray(values.outputs) && values.outputs.length > 0
        ? values.outputs
        : current.outputs || [],
  };

  if (Array.isArray(mergedValues.outputs) && mergedValues.outputs.length > 0) {
    mergedValues.outputs = mergedValues.outputs.map((line, index) =>
      index === 0
        ? {
            ...line,
            goodQty: toNumber(mergedValues.goodQty || 0),
            rejectQty: toNumber(mergedValues.rejectQty || 0),
            reworkQty: toNumber(mergedValues.reworkQty || 0),
          }
        : line,
    );
  }

  const guardedValues = applyLockedWorkLogCoreFields(current, mergedValues);

  const errors = validateProductionWorkLog(guardedValues);
  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const exists = await isProductionWorkLogNumberExists(guardedValues.workNumber, id);
  if (exists) {
    throw { type: "validation", errors: { workNumber: "Nomor work log sudah digunakan" } };
  }

  const payload = normalizePayload(guardedValues, currentUser, true);
  await updateDoc(ref, payload);
  return id;
};

// =====================================================
// Helper peta kebutuhan PO untuk referensi qty requirement
// Digunakan saat complete untuk membaca snapshot kebutuhan dari PO
// =====================================================
const buildWorkLogReservationMap = (productionOrder = null) => {
  const reservedQtyMap = new Map();

  if (!productionOrder) return reservedQtyMap;

  const reservationLines = Array.isArray(productionOrder.materialRequirementLines)
    ? productionOrder.materialRequirementLines
    : [];

  reservationLines.forEach((line) => {
    const key = [
      line.itemType || '',
      line.itemId || '',
      line.resolvedVariantKey || '',
    ].join('::');
    const existing = reservedQtyMap.get(key) || 0;
    reservedQtyMap.set(key, existing + toNumber(line.qtyRequired || 0));
  });

  return reservedQtyMap;
};

const getResolvedMaterialStock = ({ line = {}, stockItem = {} }) => {
  const strategy = line.materialHasVariants === true
    ? line.materialVariantStrategy || (line.resolvedVariantKey ? 'fixed' : 'inherit')
    : 'none';

  return resolveVariantSelection({
    item: stockItem || {},
    materialVariantStrategy: strategy,
    targetVariantKey: line.resolvedVariantKey || '',
    targetVariantLabel: line.resolvedVariantLabel || '',
    fixedVariantKey: line.resolvedVariantKey || '',
    fixedVariantLabel: line.resolvedVariantLabel || '',
    // ACTIVE / FINAL: material usage yang bervarian tidak boleh jatuh
    // ke master saat start/complete. Manual legacy harus memilih varian dulu.
    allowMasterFallback: !(line.materialHasVariants === true && strategy !== 'none'),
    contextLabel: `Varian material ${line.itemName || 'produksi'}`,
  });
};

const getOutputStockResolution = ({
  line = {},
  stockItem = {},
  fallbackVariantKey = '',
  fallbackVariantLabel = '',
}) => {
  const outputHasVariants =
    line.outputHasVariants === true || inferHasVariants(stockItem || {});
  const preferredVariantKey = line.outputVariantKey || fallbackVariantKey || '';
  const preferredVariantLabel = line.outputVariantLabel || fallbackVariantLabel || '';

  if (!outputHasVariants) {
    return {
      stockSourceType: 'master',
      materialHasVariants: false,
      resolvedVariantKey: '',
      resolvedVariantLabel: '',
    };
  }

  const resolution = resolveVariantSelection({
    item: stockItem || {},
    materialVariantStrategy: preferredVariantKey ? 'fixed' : 'inherit',
    targetVariantKey: preferredVariantKey,
    targetVariantLabel: preferredVariantLabel,
    fixedVariantKey: preferredVariantKey,
    fixedVariantLabel: preferredVariantLabel,
    // ACTIVE / FINAL: output bervarian wajib masuk variant, bukan master.
    allowMasterFallback: false,
    contextLabel: `Varian output ${line.outputName || stockItem.name || 'produksi'}`,
  });

  // =====================================================
  // Guard output varian.
  // Untuk item semi finished / product yang punya beberapa varian,
  // stok tidak boleh jatuh ke master karena halaman stok semi finished
  // menghitung total dari variants. Jika dibiarkan masuk ke master,
  // inventory log akan terlihat masuk tetapi total stok list tetap 0.
  // =====================================================
  if (resolution.stockSourceType !== 'variant') {
    throw new Error(
      `Output ${line.outputName || stockItem.name || 'produksi'} wajib punya varian target yang jelas sebelum work log diselesaikan`,
    );
  }

  return {
    ...resolution,
    materialHasVariants: true,
    resolvedVariantKey: resolution.resolvedVariantKey || preferredVariantKey,
    resolvedVariantLabel: resolution.resolvedVariantLabel || preferredVariantLabel,
  };
};

// =====================================================
// Complete work log + apply stock mutation
// =====================================================
export const completeProductionWorkLog = async (id, currentUser = null) => {
  const workLogRef = doc(db, COLLECTION_NAME, id);
  const actor =
    currentUser?.email ||
    currentUser?.displayName ||
    currentUser?.uid ||
    "system";

  await runTransaction(db, async (transaction) => {
    const workLogSnap = await transaction.get(workLogRef);

    if (!workLogSnap.exists()) {
      throw new Error("Data work log produksi tidak ditemukan");
    }

    const workLog = {
      id: workLogSnap.id,
      ...workLogSnap.data(),
    };

    assertProductionWorkLogCompletable(workLog);

    const materialUsages = Array.isArray(workLog.materialUsages)
      ? workLog.materialUsages
      : [];
    const outputs = Array.isArray(workLog.outputs) ? workLog.outputs : [];

    // Sinkronkan output pertama dari summary qty agar sumber data hasil produksi tunggal
    const synchronizedOutputs = outputs.map((line, index) =>
      index === 0
        ? {
            ...line,
            goodQty: toNumber(workLog.goodQty || 0),
            rejectQty: toNumber(workLog.rejectQty || 0),
            reworkQty: toNumber(workLog.reworkQty || 0),
          }
        : line,
    );

    const productionOrderRef = workLog.productionOrderId
      ? doc(db, "production_orders", workLog.productionOrderId)
      : null;
    let productionOrder = null;

    if (productionOrderRef) {
      const productionOrderSnap = await transaction.get(productionOrderRef);
      if (productionOrderSnap.exists()) {
        productionOrder = {
          id: productionOrderSnap.id,
          ...productionOrderSnap.data(),
        };
      }
    }

    const reservedQtyMap = buildWorkLogReservationMap(productionOrder);

    const completedAtValue = new Date();

    const nextMaterialUsages = [];
    for (const line of materialUsages) {
      if (workLog.stockConsumptionStatus === "applied" || line.stockDeducted === true) {
        nextMaterialUsages.push(calculateMaterialUsageLine({ ...line, stockDeducted: true }));
        continue;
      }
      const actualQty = toNumber(line.actualQty || 0);
      const collectionName = getCollectionNameByItemType(line.itemType);

      if (!collectionName || !line.itemId) {
        nextMaterialUsages.push({
          ...line,
          stockDeducted: false,
          stockDeductedAt: null,
        });
        continue;
      }

      const stockRef = doc(db, collectionName, line.itemId);
      const stockSnap = await transaction.get(stockRef);

      if (!stockSnap.exists()) {
        throw new Error(`Item material ${line.itemName || "-"} tidak ditemukan`);
      }

      const stockItem = normalizeReferenceItem({
        id: stockSnap.id,
        ...stockSnap.data(),
      });
      const stockData = normalizeStockSnapshot(stockSnap.data());
      const stockResolution = getResolvedMaterialStock({
        line,
        stockItem,
      });
      const reservationKey = [
        line.itemType || '',
        line.itemId || '',
        stockResolution.resolvedVariantKey || '',
      ].join('::');
      const reservedReleaseQty = Math.min(
        toNumber(reservedQtyMap.get(reservationKey) || 0),
        toNumber(stockResolution.reservedStock || 0),
      );

      if (toNumber(stockResolution.currentStock || 0) < actualQty) {
        throw new Error(
          `Stok ${line.itemName || "material"} tidak cukup untuk diselesaikan`,
        );
      }

      const updatePayload = applyStockMutationToItem({
        item: stockItem,
        variantKey: stockResolution.resolvedVariantKey || '',
        deltaCurrent: -actualQty,
        deltaReserved: -reservedReleaseQty,
      });

      transaction.update(stockRef, {
        ...updatePayload,
        updatedAt: serverTimestamp(),
      });

      nextMaterialUsages.push(
        calculateMaterialUsageLine({
          ...line,
          materialHasVariants: stockResolution.materialHasVariants === true,
          materialVariantStrategy: stockResolution.materialVariantStrategy || line.materialVariantStrategy || 'none',
          resolvedVariantKey: stockResolution.resolvedVariantKey || '',
          resolvedVariantLabel: stockResolution.resolvedVariantLabel || '',
          stockSourceType: stockResolution.stockSourceType || 'master',
          costPerUnitSnapshot:
            toNumber(line.costPerUnitSnapshot || 0) ||
            getItemUnitCost(line.itemType, stockData),
          stockDeducted: actualQty > 0,
          stockDeductedAt: actualQty > 0 ? completedAtValue : null,
        }),
      );
    }

    const totalGoodQty = synchronizedOutputs.reduce((sum, line) => sum + toNumber(line.goodQty || 0), 0);
    if (totalGoodQty <= 0) {
      throw new Error("Good Qty hasil produksi harus lebih dari 0 sebelum work log diselesaikan");
    }

    const fallbackUnitCost = toNumber(workLog.costPerGoodUnit || 0);
    const nextOutputs = [];

    for (const line of synchronizedOutputs) {
      const goodQty = toNumber(line.goodQty || 0);
      const collectionName = getCollectionNameByItemType(line.outputType);

      if (!collectionName || !line.outputIdRef) {
        nextOutputs.push(
          calculateOutputLine({
            ...line,
            costPerUnit: toNumber(line.costPerUnit || 0) || fallbackUnitCost,
            stockAdded: false,
            stockAddedAt: null,
          }),
        );
        continue;
      }

      const stockRef = doc(db, collectionName, line.outputIdRef);
      const stockSnap = await transaction.get(stockRef);

      if (!stockSnap.exists()) {
        throw new Error(`Item output ${line.outputName || "-"} tidak ditemukan`);
      }

      const stockItem = normalizeReferenceItem({
        id: stockSnap.id,
        ...stockSnap.data(),
      });
      const stockData = normalizeStockSnapshot(stockSnap.data());
      const outputResolution = getOutputStockResolution({
        line,
        stockItem,
        fallbackVariantKey: productionOrder?.targetVariantKey || workLog.targetVariantKey || '',
        fallbackVariantLabel: productionOrder?.targetVariantLabel || workLog.targetVariantLabel || '',
      });
      const unitCost = toNumber(line.costPerUnit || 0) || fallbackUnitCost;
      const updatePayload = applyStockMutationToItem({
        item: stockItem,
        variantKey: outputResolution.resolvedVariantKey || '',
        deltaCurrent: goodQty,
      });

      if (collectionName === "semi_finished_materials") {
        const baseCurrentStock =
          outputResolution.stockSourceType === 'variant'
            ? toNumber(outputResolution.currentStock || 0)
            : stockData.currentStock;
        const baseAverageCost =
          outputResolution.stockSourceType === 'variant'
            ? toNumber(
                (stockItem.variants || []).find(
                  (variant) => (variant.variantKey || variant.id || variant.name || variant.color || '').toString().trim().toLowerCase() === (outputResolution.resolvedVariantKey || '').toString().trim().toLowerCase(),
                )?.averageCostPerUnit || 0,
              )
            : toNumber(stockData.averageCostPerUnit || 0);
        const nextAverageCost = calculateWeightedAverage(
          baseCurrentStock,
          baseAverageCost,
          goodQty,
          unitCost,
        );

        updatePayload.lastProductionCostPerUnit = unitCost;
        updatePayload.averageCostPerUnit =
          outputResolution.stockSourceType === 'variant'
            ? toNumber(updatePayload.averageCostPerUnit || stockData.averageCostPerUnit || 0)
            : nextAverageCost;
        if (outputResolution.stockSourceType === 'variant') {
          updatePayload.variants = (updatePayload.variants || []).map((variant) => {
            const key = (variant.variantKey || variant.id || variant.name || variant.color || '').toString().trim().toLowerCase();
            if (key !== (outputResolution.resolvedVariantKey || '').toString().trim().toLowerCase()) {
              return variant;
            }
            return {
              ...variant,
              averageCostPerUnit: nextAverageCost,
            };
          });
        }
      } else if (collectionName === "products") {
        const baseCurrentStock =
          outputResolution.stockSourceType === 'variant'
            ? toNumber(outputResolution.currentStock || 0)
            : toNumber(stockSnap.data()?.stock ?? stockData.currentStock);
        const currentHpp =
          outputResolution.stockSourceType === 'variant'
            ? toNumber(
                (stockItem.variants || []).find(
                  (variant) => (variant.variantKey || variant.id || variant.name || variant.color || '').toString().trim().toLowerCase() === (outputResolution.resolvedVariantKey || '').toString().trim().toLowerCase(),
                )?.hppPerUnit || 0,
              )
            : toNumber(stockSnap.data()?.hppPerUnit || 0);
        const nextHpp = calculateWeightedAverage(
          baseCurrentStock,
          currentHpp,
          goodQty,
          unitCost,
        );

        if (outputResolution.stockSourceType === 'variant') {
          updatePayload.variants = (updatePayload.variants || []).map((variant) => {
            const key = (variant.variantKey || variant.id || variant.name || variant.color || '').toString().trim().toLowerCase();
            if (key !== (outputResolution.resolvedVariantKey || '').toString().trim().toLowerCase()) {
              return variant;
            }
            return {
              ...variant,
              hppPerUnit: nextHpp,
            };
          });
        } else {
          updatePayload.hppPerUnit = nextHpp;
        }
      }

      transaction.update(stockRef, {
        ...updatePayload,
        updatedAt: serverTimestamp(),
      });

      // SECTION: tulis log mutasi output masuk saat produksi selesai
      // Catatan maintainability:
      // - Log output wajib menyimpan referensi yang sama dengan log bahan keluar
      //   agar audit trial-error bisa melihat siklus produksi secara utuh.
      if (goodQty > 0) {
        addInventoryLogInTransaction(transaction, {
          itemId: line.outputIdRef,
          itemName: line.outputName || stockItem.name || '-',
          quantityChange: goodQty,
          type: 'production_output_in',
          collectionName,
          extraData: {
            workLogRefId: workLog.id,
            workNumber: workLog.workNumber || '',
            productionOrderId: productionOrder?.id || workLog.productionOrderId || '',
            productionOrderCode: productionOrder?.code || workLog.productionOrderCode || '',
            stepName: workLog.stepName || '',
            movementSource: 'production',
            variantKey: outputResolution.resolvedVariantKey || '',
            variantLabel: outputResolution.resolvedVariantLabel || '',
          },
        });
      }

      nextOutputs.push(
        calculateOutputLine({
          ...line,
          outputHasVariants: outputResolution.materialHasVariants === true || line.outputHasVariants === true,
          outputVariantKey: outputResolution.resolvedVariantKey || '',
          outputVariantLabel: outputResolution.resolvedVariantLabel || '',
          stockSourceType: outputResolution.stockSourceType || 'master',
          costPerUnit: unitCost,
          stockAdded: goodQty > 0,
          stockAddedAt: goodQty > 0 ? completedAtValue : null,
        }),
      );
    }

    transaction.update(workLogRef, {
      status: "completed",
      completedAt: workLog.completedAt || completedAtValue,
      materialUsages: nextMaterialUsages,
      outputs: nextOutputs,
      stockConsumptionStatus: "applied",
      stockOutputStatus: "applied",
      payrollCalculated: false,
      payrollCalculationStatus: "pending",
      productionOrderStatusSnapshot: productionOrder ? "completed" : workLog.productionOrderStatusSnapshot || "",
      // ACTIVE / FINAL: heal snapshot varian Work Log dari PO saat complete
      // agar data lama yang sudah in_progress tetap punya root variant yang sama.
      targetHasVariants:
        productionOrder?.targetHasVariants === true ||
        workLog.targetHasVariants === true ||
        Boolean(productionOrder?.targetVariantKey || workLog.targetVariantKey),
      targetVariantKey: productionOrder?.targetVariantKey || workLog.targetVariantKey || "",
      targetVariantLabel: productionOrder?.targetVariantLabel || workLog.targetVariantLabel || "",
      updatedAt: serverTimestamp(),
      updatedBy: actor,
    });

    if (productionOrderRef && productionOrder) {
      const currentWorkLogIds = Array.isArray(productionOrder.workLogIds)
        ? productionOrder.workLogIds
        : [];
      const nextWorkLogIds = [...new Set([...currentWorkLogIds, workLog.id])];

      transaction.update(productionOrderRef, {
        status: "completed",
        workLogIds: nextWorkLogIds,
        generatedWorkLogCount: nextWorkLogIds.length,
        completedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor,
      });
    }
  });

  // =====================================================
  // ACTIVE / FINAL
  // Setelah stock posting Work Log selesai, flow payroll final tidak boleh
  // berhenti di status pending saja. Service ini langsung memicu handoff ke
  // payroll draft per operator agar Work Log completed masuk ke menu Payroll
  // sebagai draft final, bukan candidate manual.
  // =====================================================
  try {
    const { ensurePayrollDraftsForCompletedWorkLog } = await import("./productionPayrollsService");
    const autoPayrollResult = await ensurePayrollDraftsForCompletedWorkLog(id, currentUser);

    return {
      id,
      autoPayrollResult,
    };
  } catch (error) {
    console.error("Gagal auto-create payroll draft setelah Work Log completed", error);

    return {
      id,
      autoPayrollResult: {
        status: "error",
        createdCount: 0,
        blockingReasons: [],
        warningReasons: [
          "Work Log selesai, tetapi auto-create payroll draft gagal. Buka menu Payroll untuk review dan cek log error.",
        ],
        createdPayrollIds: [],
        createdPayrollNumbers: [],
        createdWorkerNames: [],
      },
    };
  }
};

export const updateWorkLogStatus = async (
  id,
  status,
  currentUser = null,
  extra = {},
) => {
  const ref = doc(db, COLLECTION_NAME, id);

  await updateDoc(ref, {
    status,
    ...extra,
    updatedAt: serverTimestamp(),
    updatedBy:
      currentUser?.email ||
      currentUser?.displayName ||
      currentUser?.uid ||
      "system",
  });

  return id;
};
