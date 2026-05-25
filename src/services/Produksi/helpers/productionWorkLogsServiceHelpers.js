// =====================================================
// Production Work Logs Service Helpers — GUARDED
//
// Behavior-preserving extraction dari productionWorkLogsService.js.
// Helper di file ini murni resolver/normalizer lokal service dan tidak boleh
// melakukan Firestore write, route/menu change, schema change, atau stock mutation.
// =====================================================

import { serverTimestamp } from "firebase/firestore";
import { calculatePayrollAmounts } from "../../../constants/productionPayrollOptions";
import {
  calculateMaterialUsageLine,
  calculateOutputLine,
  calculateProductionMonitoring,
} from "../../../constants/productionWorkLogOptions";
import { toNumber } from "../../../utils/stock/stockHelpers";
import { inferHasVariants } from "../../../utils/variants/variantStockHelpers";

// =====================================================
// Helper filter aktif yang toleran data lama
// - true -> tampil
// - undefined -> tampil
// - false -> tidak tampil
// =====================================================
export const filterActiveLike = (items = []) =>
  items.filter((item) => item?.isActive !== false);

// =====================================================
// Helper format aman
// =====================================================
export const safeTrim = (value) => String(value || "").trim();

export const PRODUCTION_STEPS_COLLECTION_NAME = "production_steps";


// =====================================================
// SECTION: Work Log payload normalizer — GUARDED / behavior-preserving extraction
// Fungsi:
// - menormalisasi material usage, output, monitoring, cost summary, dan audit field payload Work Log;
// - tidak melakukan Firestore write, route/menu change, schema change, atau stock mutation.
// Catatan teknis:
// - serverTimestamp hanya dipakai sebagai value payload agar behavior sama dengan service lama.
// =====================================================
export const normalizeMaterialUsages = (lines = []) =>
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

export const normalizeOutputs = (lines = []) =>
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

export const normalizeProductionWorkLogPayload = (values = {}, currentUser = null, isEdit = false) => {
  const materialUsages = normalizeMaterialUsages(values.materialUsages || []);
  const outputs = normalizeOutputs(values.outputs || []);
  const monitoring = calculateProductionMonitoring(values.productionProfile || {}, values);

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

  const normalizedWorkNumber = safeTrim(values.workNumber).toUpperCase();
  const payload = {
    workNumber: normalizedWorkNumber,
    code: normalizedWorkNumber,
    referenceNumber: normalizedWorkNumber,
    sourceRef: normalizedWorkNumber,
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

    // SECTION: source
    // IMS NOTE [AKTIF/GUARDED]: Work Log baru default In Progress dari Production Order; UI tidak membuka flow draft/manual.
    sourceType: values.sourceType || "manual",
    status: values.status || "in_progress",

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

export const validateProductionWorkLogPayload = (values = {}) => {
  const errors = {};

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

const normalizeAuditStringArray = (value = []) =>
  (Array.isArray(value) ? value : []).map((item) => safeTrim(item)).filter(Boolean);

export const buildProductionWorkerSummary = ({ workerNames = [], workerCodes = [], workerIds = [], workerCount = 0 } = {}) => {
  const names = normalizeAuditStringArray(workerNames);
  const codes = normalizeAuditStringArray(workerCodes);
  const ids = normalizeAuditStringArray(workerIds);
  const count = Math.max(names.length, ids.length, toNumber(workerCount || 0));

  if (!count && !names.length && !codes.length) return "";

  const displayNames = names.length ? names.join(", ") : `${count} operator`;
  const displayCodes = codes.length ? ` (${codes.join(", ")})` : "";
  return `${displayNames}${displayCodes}`;
};

export const buildProductionOutputAuditMetadata = ({ workLog = {}, productionOrder = null, outputResolution = {} } = {}) => {
  const workerIds = normalizeAuditStringArray(workLog.workerIds);
  const workerNames = normalizeAuditStringArray(workLog.workerNames);
  const workerCodes = normalizeAuditStringArray(workLog.workerCodes);
  const workerCount = Math.max(workerIds.length, workerNames.length, toNumber(workLog.workerCount || 0));
  const stepName = safeTrim(workLog.stepName || productionOrder?.currentStepName || productionOrder?.stepName);
  const stepCode = safeTrim(workLog.stepCode || productionOrder?.currentStepCode || productionOrder?.stepCode);
  const workerSummary = buildProductionWorkerSummary({
    workerNames,
    workerCodes,
    workerIds,
    workerCount,
  });

  return {
    workLogId: workLog.id || "",
    workLogNumber: safeTrim(workLog.workNumber || workLog.code || workLog.referenceNumber),
    productionOrderId: safeTrim(workLog.productionOrderId || productionOrder?.id),
    productionOrderCode: safeTrim(workLog.productionOrderCode || productionOrder?.orderNumber || productionOrder?.code),
    productionStepId: safeTrim(workLog.stepId || productionOrder?.currentStepId || productionOrder?.stepId),
    productionStepCode: stepCode,
    productionStepName: stepName,
    productionStepLabel: [stepCode, stepName].filter(Boolean).join(" - "),
    operatorIds: workerIds,
    operatorNames: workerNames,
    operatorCodes: workerCodes,
    operatorCount: workerCount,
    operatorSummary: workerSummary,
    stockSourceType: outputResolution.stockSourceType || "master",
    resolvedVariantKey: outputResolution.resolvedVariantKey || "",
    resolvedVariantLabel: outputResolution.resolvedVariantLabel || "",
  };
};

export const buildWorkLogReservationMap = (productionOrder = null) => {
  const reservedQtyMap = new Map();
  const reservationLines = Array.isArray(productionOrder?.materialRequirementLines)
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

const normalizePayrollMode = (value = "") => (value === "per_batch" ? "per_batch" : "per_qty");
const normalizePayrollOutputBasis = (value = "") => (
  value === "actual_output_qty" ? "actual_output_qty" : "good_qty"
);

const resolveWorkerCountForHpp = (workLog = {}) => {
  const workerIds = Array.isArray(workLog.workerIds) ? workLog.workerIds.filter(Boolean) : [];
  const workerNames = Array.isArray(workLog.workerNames) ? workLog.workerNames.filter(Boolean) : [];
  return Math.max(workerIds.length, workerNames.length, toNumber(workLog.workerCount || 0));
};

const resolveWorkLogStepPayrollRuleForHpp = ({ workLog = {}, productionStep = null } = {}) => {
  const processType = safeTrim(productionStep?.processType || workLog.stepProcessType);
  const payrollClassification = safeTrim(
    productionStep?.payrollClassification ||
      workLog.stepPayrollClassification ||
      (processType === "support_process" ? "support_fulfillment" : "direct_labor"),
  );
  const includePayrollInHpp =
    typeof productionStep?.includePayrollInHpp === "boolean"
      ? productionStep.includePayrollInHpp
      : typeof workLog.stepPayrollIncludeInHpp === "boolean"
        ? workLog.stepPayrollIncludeInHpp
        : payrollClassification === "direct_labor";

  return {
    stepId: safeTrim(productionStep?.id || workLog.stepId),
    stepCode: safeTrim(productionStep?.code || workLog.stepCode),
    stepName: safeTrim(productionStep?.name || workLog.stepName),
    stepProcessType: processType,
    payrollMode: normalizePayrollMode(productionStep?.payrollMode || workLog.stepPayrollMode),
    payrollRate: Math.max(0, toNumber(productionStep?.payrollRate ?? workLog.stepPayrollRate ?? 0)),
    payrollQtyBase: Math.max(1, toNumber(productionStep?.payrollQtyBase ?? workLog.stepPayrollQtyBase ?? 1)),
    payrollOutputBasis: normalizePayrollOutputBasis(productionStep?.payrollOutputBasis || workLog.stepPayrollOutputBasis),
    payrollClassification,
    includePayrollInHpp,
    source: productionStep?.id ? "production_step_master" : "work_log_step_snapshot",
  };
};

export const resolveCompletedWorkLogAccruedLaborCost = ({
  workLog = {},
  productionStep = null,
  totalGoodQty = 0,
} = {}) => {
  const payrollRule = resolveWorkLogStepPayrollRuleForHpp({ workLog, productionStep });

  if (payrollRule.includePayrollInHpp === false) {
    return {
      amount: 0,
      perWorkerAmount: 0,
      workerCount: resolveWorkerCountForHpp(workLog),
      payrollRule,
      status: "excluded_from_hpp",
    };
  }

  const workerCount = resolveWorkerCountForHpp(workLog);
  if (workerCount <= 0) {
    throw new Error("Operator produksi wajib dipilih sebelum Work Log diselesaikan agar labor HPP tidak 0.");
  }

  if (payrollRule.payrollRate <= 0) {
    throw new Error(
      `Tarif labor tahapan ${payrollRule.stepName || payrollRule.stepCode || "produksi"} masih 0. Isi rate di master Tahapan Produksi sebelum Work Log diselesaikan.`,
    );
  }

  const goodQty = Math.max(0, toNumber(totalGoodQty || workLog.goodQty || 0));
  const actualOutputQty = Math.max(0, toNumber(workLog.actualOutputQty || goodQty));
  const outputQtyUsed = payrollRule.payrollOutputBasis === "actual_output_qty" ? actualOutputQty : goodQty;
  const workedQty = payrollRule.payrollMode === "per_batch" ? Math.max(0, toNumber(workLog.plannedQty || 0)) : outputQtyUsed;

  if (payrollRule.payrollMode === "per_qty" && outputQtyUsed <= 0) {
    throw new Error("Good Qty/Actual Output untuk labor HPP harus lebih dari 0 sebelum Work Log diselesaikan.");
  }

  if (payrollRule.payrollMode === "per_batch" && workedQty <= 0) {
    throw new Error("Qty batch Work Log harus lebih dari 0 untuk labor HPP mode per batch.");
  }

  const calculated = calculatePayrollAmounts({
    payrollMode: payrollRule.payrollMode,
    payrollRate: payrollRule.payrollRate,
    payrollQtyBase: payrollRule.payrollQtyBase,
    outputQtyUsed,
    workedQty,
    bonusAmount: 0,
    deductionAmount: 0,
  });
  const perWorkerAmount = Math.max(0, toNumber(calculated.finalAmount || 0));
  const amount = perWorkerAmount * workerCount;

  if (amount <= 0) {
    throw new Error("Labor HPP hasil perhitungan 0. Cek tarif step, qty output, dan operator sebelum Work Log diselesaikan.");
  }

  return {
    amount,
    perWorkerAmount,
    workerCount,
    payrollRule,
    status: "accrued",
  };
};

export const normalizeReferenceItem = (item = {}) => ({
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

export const getCollectionNameByItemType = (itemType) => {
  if (itemType === "raw_material") return "raw_materials";
  if (itemType === "semi_finished_material") return "semi_finished_materials";
  if (itemType === "product") return "products";
  return "";
};

// =====================================================
// SECTION: Guard strict variant material dari PO
// Fungsi blok:
// - menilai apakah line material Work Log dari PO wajib membaca bucket variant;
// - menjaga Start Production tidak fallback ke master/default saat PO final sudah membawa resolved variant.
// Hubungan flow aplikasi:
// - dipakai saat createProductionWorkLogFromOrder memotong stok bahan dalam transaction yang sama.
// Alasan logic:
// - materialRequirementLines PO menjadi contract final ke materialUsages Work Log.
// Status: AKTIF/GUARDED untuk Start Production; non-PO/internal caller tetap permissive saat strictVariant=false.
// =====================================================
export const normalizeMaterialVariantStrategy = ({ line = {}, stockItem = {} } = {}) => {
  const materialHasVariants = line.materialHasVariants === true || inferHasVariants(stockItem || {});
  if (!materialHasVariants) return "none";

  const normalized = safeTrim(line.materialVariantStrategy).toLowerCase();
  if (["inherit", "fixed", "none"].includes(normalized)) return normalized;
  return line.resolvedVariantKey || line.resolvedVariantLabel ? "fixed" : "inherit";
};

export const shouldLineReadVariantStrictly = ({ line = {}, stockItem = {}, strictVariant = false } = {}) => {
  if (!strictVariant) return false;
  const materialHasVariants = line.materialHasVariants === true || inferHasVariants(stockItem || {});
  const strategy = normalizeMaterialVariantStrategy({ line, stockItem });
  const hasResolvedVariantContract =
    line.stockSourceType === "variant" || safeTrim(line.resolvedVariantKey) || safeTrim(line.resolvedVariantLabel);
  const inheritedTargetRequiresVariant =
    strategy === "inherit" && line.sourceTargetHasVariants === true && safeTrim(line.sourceTargetVariantKey);

  if (!materialHasVariants || strategy === "none") return false;
  if (strategy === "fixed") return true;
  return Boolean(hasResolvedVariantContract || inheritedTargetRequiresVariant);
};

export const assertResolvedVariantContract = ({ line = {}, stockItem = {}, stockResolution = {} } = {}) => {
  if (stockResolution.stockSourceType === "variant") return;

  const itemName = safeTrim(line.itemName || stockItem?.name || stockItem?.code) || "material";
  throw new Error(
    `Material ${itemName} pada Production Order wajib memakai varian tersimpan, tetapi varian tidak ditemukan. Refresh Need/perbaiki BOM sebelum Start Production agar stok tidak fallback ke master/default.`,
  );
};

// =====================================================
// ACTIVE / GUARDED - resolver snapshot biaya material produksi
// Fungsi:
// - mengambil unit cost dari field cost aktual item/varian tanpa memakai harga jual;
// - menjaga Work Log dari PO tidak lagi menyimpan biaya material 0 saat item punya cost.
// Alasan blok ini dipakai:
// - Start Production bisa langsung memotong stok dan menandai line sebagai stockDeducted,
//   sehingga Complete Work Log tidak boleh memutasi stok ulang hanya demi mengisi cost.
// Status:
// - aktif dipakai di Start Production dan Complete Work Log; guarded karena memengaruhi HPP.
// =====================================================
const getCostCandidate = (data = {}, keys = []) => {
  for (const key of keys) {
    const value = toNumber(data?.[key] || 0);
    if (value > 0) {
      return { unitCost: value, costSource: key };
    }
  }

  return { unitCost: 0, costSource: "missing_cost_snapshot" };
};

const findCostVariantSnapshot = (stockItem = {}, resolvedVariantKey = "") => {
  const normalizedKey = safeTrim(resolvedVariantKey).toLowerCase();
  if (!normalizedKey || !Array.isArray(stockItem?.variants)) return null;

  return stockItem.variants.find((variant) => {
    const key = safeTrim(
      variant.variantKey ||
        variant.id ||
        variant.variantId ||
        variant.name ||
        variant.color ||
        variant.code ||
        variant.sku,
    ).toLowerCase();

    return key === normalizedKey;
  }) || null;
};

const getCostCandidateWithSource = (data = {}, keys = [], sourcePrefix = "") => {
  const candidate = getCostCandidate(data, keys);
  if (candidate.unitCost > 0 && sourcePrefix) {
    return {
      ...candidate,
      costSource: `${sourcePrefix}.${candidate.costSource}`,
    };
  }
  return candidate;
};

/*
=====================================================
SECTION: Material cost resolver — GUARDED
Fungsi:
- Mengambil unit cost aktual material/output dari varian lebih dulu lalu fallback ke master cost yang valid.

Dipakai oleh:
- createProductionWorkLogFromOrder dan completeProductionWorkLog.

Alasan perubahan:
- Raw material/semi finished bervarian dapat punya stok varian, tetapi cost aktual masih disimpan di level master.
- Tanpa fallback ini Work Log bisa menyimpan biaya material 0 padahal master average cost valid.

Catatan cleanup:
- Jika semua varian kelak punya field cost resmi, fallback master tetap aman sebagai kompatibilitas data lama.

Risiko:
- Mengubah prioritas field cost sembarangan dapat membuat HPP memakai reference price/harga jual, bukan modal aktual.
=====================================================
*/
export const getItemUnitCostSnapshot = ({ itemType = "", stockItem = {}, stockResolution = {} } = {}) => {
  const variantSnapshot =
    stockResolution.stockSourceType === "variant"
      ? findCostVariantSnapshot(stockItem, stockResolution.resolvedVariantKey)
      : null;

  const resolveWithVariantFallback = (keys = []) => {
    const variantCandidate = variantSnapshot
      ? getCostCandidateWithSource(variantSnapshot, keys, "variant")
      : { unitCost: 0, costSource: "variant_not_selected" };

    if (variantCandidate.unitCost > 0) return variantCandidate;

    const masterCandidate = getCostCandidateWithSource(stockItem || {}, keys, "master");
    if (masterCandidate.unitCost > 0) return masterCandidate;

    return {
      unitCost: 0,
      costSource: variantSnapshot ? "missing_variant_and_master_cost_snapshot" : "missing_master_cost_snapshot",
    };
  };

  if (itemType === "raw_material") {
    return resolveWithVariantFallback([
      "averageActualUnitCost",
      "restockReferencePrice",
    ]);
  }

  if (itemType === "semi_finished_material") {
    return resolveWithVariantFallback([
      "averageCostPerUnit",
      "lastProductionCostPerUnit",
    ]);
  }

  if (itemType === "product") {
    return resolveWithVariantFallback([
      "hppPerUnit",
      "averageCostPerUnit",
      "costPerUnit",
    ]);
  }

  return { unitCost: 0, costSource: "unsupported_item_type" };
};

/*
=====================================================
SECTION: Work Log cost summary calculation — GUARDED
Fungsi:
- Menghitung ulang material, labor, overhead, total cost, dan HPP/unit dari line snapshot Work Log.

Dipakai oleh:
- Start Production dari PO dan Complete Work Log sebelum menyimpan summary cost.

Alasan perubahan:
- Summary Work Log bisa 0 walaupun materialUsages sudah punya costPerUnitSnapshot/totalCostSnapshot.

Catatan cleanup:
- Bisa dipindah ke constants/shared helper jika nanti dibutuhkan oleh report lain.

Risiko:
- Jangan panggil helper ini untuk write back data lama secara massal; helper hanya dipakai di flow aktif yang memang sedang membuat/menyelesaikan Work Log.
=====================================================
*/
const calculateMaterialCostFromUsages = (materialUsages = []) =>
  (Array.isArray(materialUsages) ? materialUsages : []).reduce((sum, line) => {
    const totalSnapshot = toNumber(line.totalCostSnapshot || 0);
    if (totalSnapshot > 0) return sum + totalSnapshot;
    return sum + (toNumber(line.actualQty || 0) * toNumber(line.costPerUnitSnapshot || 0));
  }, 0);

export const buildWorkLogCostSummary = ({ materialUsages = [], laborCostActual = 0, overheadCostActual = 0, goodQty = 0 } = {}) => {
  const materialCostActual = calculateMaterialCostFromUsages(materialUsages);
  const laborCost = toNumber(laborCostActual || 0);
  const overheadCost = toNumber(overheadCostActual || 0);
  const totalCostActual = materialCostActual + laborCost + overheadCost;
  const normalizedGoodQty = toNumber(goodQty || 0);

  return {
    materialCostActual,
    laborCostActual: laborCost,
    overheadCostActual: overheadCost,
    totalCostActual,
    costPerGoodUnit: normalizedGoodQty > 0 && totalCostActual > 0 ? totalCostActual / normalizedGoodQty : 0,
  };
};

