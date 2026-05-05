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
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  buildInventoryLogPayload,
  INVENTORY_LOG_COLLECTION,
} from "../Inventory/inventoryLogService";
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

const getCollectionNameByItemType = (itemType) => {
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
// Status: AKTIF/GUARDED untuk Start Production; manual/legacy tetap dapat memakai resolver permissive jika tidak dipanggil strict.
// =====================================================
const normalizeMaterialVariantStrategy = ({ line = {}, stockItem = {} } = {}) => {
  const materialHasVariants = line.materialHasVariants === true || inferHasVariants(stockItem || {});
  if (!materialHasVariants) return "none";

  const normalized = safeTrim(line.materialVariantStrategy).toLowerCase();
  if (["inherit", "fixed", "none"].includes(normalized)) return normalized;
  return line.resolvedVariantKey || line.resolvedVariantLabel ? "fixed" : "inherit";
};

const shouldLineReadVariantStrictly = ({ line = {}, stockItem = {}, strictVariant = false } = {}) => {
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

const assertResolvedVariantContract = ({ line = {}, stockItem = {}, stockResolution = {} } = {}) => {
  if (stockResolution.stockSourceType === "variant") return;

  const itemName = safeTrim(line.itemName || stockItem?.name || stockItem?.code) || "material";
  throw new Error(
    `Material ${itemName} pada Production Order wajib memakai varian tersimpan, tetapi varian tidak ditemukan. Refresh Need/perbaiki BOM sebelum Start Production agar stok tidak fallback ke master/default.`,
  );
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

const getItemUnitCostSnapshot = ({ itemType = "", stockItem = {}, stockResolution = {} } = {}) => {
  const variantSnapshot =
    stockResolution.stockSourceType === "variant"
      ? findCostVariantSnapshot(stockItem, stockResolution.resolvedVariantKey)
      : null;
  const sourceData = variantSnapshot || stockItem || {};

  if (itemType === "raw_material") {
    return getCostCandidate(sourceData, [
      "averageActualUnitCost",
      "purchaseAverageUnitCost",
      "averageCostPerUnit",
      "costPerUnit",
      "lastPurchasePrice",
    ]);
  }

  if (itemType === "semi_finished_material") {
    return getCostCandidate(sourceData, [
      "averageCostPerUnit",
      "lastProductionCostPerUnit",
      "costPerUnit",
    ]);
  }

  if (itemType === "product") {
    return getCostCandidate(sourceData, [
      "hppPerUnit",
      "averageCostPerUnit",
      "costPerUnit",
    ]);
  }

  return { unitCost: 0, costSource: "unsupported_item_type" };
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
    targetHasVariants: productionOrder.targetHasVariants === true,
    targetVariantKey: productionOrder.targetVariantKey || "",
    targetVariantLabel: productionOrder.targetVariantLabel || "",

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

    materialUsages: requirementLines.map((line, index) => ({
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
      sourceTargetHasVariants: productionOrder.targetHasVariants === true,
      sourceTargetVariantKey: productionOrder.targetVariantKey || "",
      sourceTargetVariantLabel: productionOrder.targetVariantLabel || "",
      // =====================================================
      // SECTION: Contract varian PO -> Work Log
      // Fungsi blok:
      // - menyalin resolved variant dari materialRequirementLines PO final ke materialUsages;
      // - tidak menghitung ulang strategy di UI Work Log.
      // Hubungan flow aplikasi:
      // - Start Production memakai field ini untuk memotong stok bucket variant yang sama dengan preview PO.
      // Alasan logic:
      // - PO final adalah sumber kebenaran requirement; Work Log hanya mengeksekusi.
      // Status: AKTIF/GUARDED untuk 1 PO = 1 Work Log.
      // =====================================================
      resolvedVariantKey: line.resolvedVariantKey || "",
      resolvedVariantLabel: line.resolvedVariantLabel || "",
      stockSourceType: line.stockSourceType || (line.resolvedVariantKey ? "variant" : "master"),
      stockDeducted: false,
      stockDeductedAt: null,
      notes: "",
    })),

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
        outputHasVariants: productionOrder.targetHasVariants === true,
        outputVariantKey: productionOrder.targetVariantKey || "",
        outputVariantLabel: productionOrder.targetVariantLabel || "",
        stockSourceType: productionOrder.targetVariantKey ? "variant" : "master",
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
// Inventory log helper transaksi produksi
// Fungsi:
// - menulis audit trail stok produksi di dalam runTransaction yang sama dengan mutasi stok
// Hubungan flow aplikasi:
// - Start Production = material keluar
// - Complete Work Log = output masuk
// Status:
// - guarded/aktif karena produksi harus atomic
// - payload log memakai buildInventoryLogPayload agar schema transaksi umum dan produksi sama
// =====================================================
const addInventoryLogInTransaction = (transaction, {
  itemId = '',
  itemName = '',
  quantityChange = 0,
  type = '',
  collectionName = '',
  extraData = {},
} = {}) => {
  const logRef = doc(collection(db, INVENTORY_LOG_COLLECTION));
  transaction.set(
    logRef,
    buildInventoryLogPayload({
      itemId,
      itemName,
      quantityChange,
      type,
      collectionName,
      extraData,
    }),
  );
};

// =====================================================
// Helper metadata audit output produksi
// Fungsi:
// - membuat snapshot worker/operator untuk inventory log `production_output_in`;
// - menyimpan label manusiawi Work Log/PO/step/varian tanpa mengubah transaksi stok.
// Hubungan flow aplikasi:
// - Worker sudah dipilih dan disimpan di Work Log sebelum complete; helper ini hanya
//   menyalin snapshot tersebut ke inventory log output supaya Stock Management bisa audit.
// Alasan logic dipakai:
// - Stock Management tidak boleh fetch Work Log per row dan tidak boleh backfill log lama,
//   sehingga metadata audit harus ikut tersimpan saat log produksi baru dibuat.
// Status:
// - AKTIF untuk log produksi baru.
// - GUARDED karena tidak menyentuh quantityChange, stock mutation, HPP, payroll, atau guard complete.
// - LEGACY: log lama yang belum punya worker metadata tetap valid dan dibaca fallback di UI.
// =====================================================
const normalizeAuditStringArray = (value = []) =>
  Array.isArray(value) ? value.map((item) => safeTrim(item)).filter(Boolean) : [];

const buildProductionWorkerSummary = ({ workerNames = [], workerCodes = [], workerIds = [], workerCount = 0 } = {}) => {
  const readableWorkers = workerNames.length ? workerNames : workerCodes.length ? workerCodes : workerIds;

  if (readableWorkers.length) {
    return `Operator: ${readableWorkers.join(', ')}`;
  }

  if (toNumber(workerCount) > 0) {
    return `Operator: ${toNumber(workerCount)} orang`;
  }

  return '';
};

const buildProductionOutputAuditMetadata = ({ workLog = {}, productionOrder = null, outputResolution = {} } = {}) => {
  const workerIds = normalizeAuditStringArray(workLog.workerIds);
  const workerNames = normalizeAuditStringArray(workLog.workerNames);
  const workerCodes = normalizeAuditStringArray(workLog.workerCodes);
  const workerCount = toNumber(
    workLog.workerCount || workerNames.length || workerCodes.length || workerIds.length || 0,
  );
  const workerSummary = buildProductionWorkerSummary({
    workerIds,
    workerNames,
    workerCodes,
    workerCount,
  });
  const workNumber = safeTrim(workLog.workNumber);
  const productionOrderCode = safeTrim(productionOrder?.code || workLog.productionOrderCode);
  const stepName = safeTrim(workLog.stepName);
  const workLogNote = safeTrim(workLog.notes);
  const productionContextParts = [
    workNumber ? `Work Log: ${workNumber}` : '',
    productionOrderCode ? `PO: ${productionOrderCode}` : '',
    stepName ? `Step: ${stepName}` : '',
  ].filter(Boolean);
  const noteParts = [
    workerSummary,
    ...(workerSummary ? productionContextParts : []),
    workLogNote ? `Catatan WL: ${workLogNote}` : '',
  ].filter(Boolean);

  return {
    workLogRefId: workLog.id || '',
    workNumber,
    productionOrderId: productionOrder?.id || workLog.productionOrderId || '',
    productionOrderCode,
    stepName,
    movementSource: 'production',
    variantKey: outputResolution.resolvedVariantKey || '',
    variantLabel: outputResolution.resolvedVariantLabel || '',
    workerIds,
    workerNames,
    workerCodes,
    workerCount,
    workerSummary,
    operatorText: workerSummary,
    workLogNote,
    note: noteParts.join(' | '),
  };
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
      const stockResolution = getResolvedMaterialStock({
        line,
        stockItem,
        strictVariant: payload.sourceType === "production_order",
      });
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

      // =====================================================
      // ACTIVE / GUARDED - snapshot cost material saat Start Production.
      // Fungsi:
      // - mengunci biaya material dari dokumen stok yang benar saat bahan benar-benar keluar;
      // - menghindari Work Log dari PO membawa costPerUnitSnapshot 0 sampai selesai.
      // Alasan blok ini dipakai:
      // - complete flow tidak boleh memotong stok ulang hanya untuk memperbaiki cost.
      // Status:
      // - aktif dipakai; guarded karena nilai ini menjadi dasar material cost dan HPP.
      // =====================================================
      const costSnapshot = getItemUnitCostSnapshot({
        itemType: line.itemType,
        stockItem,
        stockResolution,
      });
      const unitCostSnapshot =
        toNumber(line.costPerUnitSnapshot || 0) || costSnapshot.unitCost;

      nextMaterialUsages.push(
        calculateMaterialUsageLine({
          ...line,
          actualQty: consumeQty,
          costPerUnitSnapshot: unitCostSnapshot,
          costSourceSnapshot:
            unitCostSnapshot > 0
              ? (toNumber(line.costPerUnitSnapshot || 0) > 0 ? 'existing_line_snapshot' : costSnapshot.costSource)
              : costSnapshot.costSource,
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

const getResolvedMaterialStock = ({ line = {}, stockItem = {}, strictVariant = false } = {}) => {
  const materialVariantStrategy = normalizeMaterialVariantStrategy({ line, stockItem });
  const shouldReadVariant = shouldLineReadVariantStrictly({ line, stockItem, strictVariant });

  if (shouldReadVariant && !safeTrim(line.resolvedVariantKey) && !safeTrim(line.resolvedVariantLabel)) {
    const itemName = safeTrim(line.itemName || stockItem?.name || stockItem?.code) || "material";
    throw new Error(
      `Material ${itemName} membutuhkan varian dari PO, tetapi resolvedVariantKey/resolvedVariantLabel kosong. Refresh Need/perbaiki BOM sebelum Start Production.`,
    );
  }

  // =====================================================
  // SECTION: Resolve stok material Start Production
  // Fungsi blok:
  // - memakai resolvedVariantKey/resolvedVariantLabel dari line PO final sebagai sumber utama;
  // - mengirim allowMasterFallback=false hanya saat Start Production dari PO membutuhkan variant.
  // Hubungan flow aplikasi:
  // - hasil resolver langsung dipakai untuk applyStockMutationToItem dan inventory log material keluar.
  // Alasan logic:
  // - preview PO, PO final, dan pemotongan stok Start Production harus membaca bucket variant yang sama.
  // Status: AKTIF/GUARDED untuk production_order start; LEGACY/manual tetap permissive saat strictVariant=false.
  // =====================================================
  const stockResolution = resolveVariantSelection({
    item: stockItem || {},
    materialVariantStrategy,
    targetVariantKey: line.resolvedVariantKey || "",
    targetVariantLabel: line.resolvedVariantLabel || "",
    fixedVariantKey: line.resolvedVariantKey || "",
    fixedVariantLabel: line.resolvedVariantLabel || "",
    allowMasterFallback: !shouldReadVariant,
    contextLabel: `Varian material ${safeTrim(line.itemName || stockItem?.name || "material")}`,
  });

  if (shouldReadVariant) {
    assertResolvedVariantContract({ line, stockItem, stockResolution });
  }

  return stockResolution;
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
    fixedVariantKey: preferredVariantKey,
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

// IMS NOTE [AKTIF/GUARDED] - Helper kecil complete Work Log.
// Fungsi: rapikan actor, output summary, costing summary, dan payload update tanpa read/write Firestore.
// Status: transaction complete tetap satu-satunya tempat posting output, completed status, dan update PO.
const resolveProductionWorkLogActor = (currentUser = null) =>
  currentUser?.email ||
  currentUser?.displayName ||
  currentUser?.uid ||
  "system";

const synchronizeFirstOutputWithWorkLogSummary = (outputs = [], workLog = {}) =>
  outputs.map((line, index) =>
    index === 0
      ? {
          ...line,
          goodQty: toNumber(workLog.goodQty || 0),
          rejectQty: toNumber(workLog.rejectQty || 0),
          reworkQty: toNumber(workLog.reworkQty || 0),
        }
      : line,
  );

const calculateCompletedWorkLogCostSummary = ({ nextMaterialUsages = [], workLog = {}, totalGoodQty = 0 } = {}) => {
  const materialCostActual = nextMaterialUsages.reduce(
    (sum, line) => sum + toNumber(line.totalCostSnapshot || 0),
    0,
  );
  const laborCostActual = toNumber(workLog.laborCostActual || 0);
  const overheadCostActual = toNumber(workLog.overheadCostActual || 0);
  const totalCostActual = materialCostActual + laborCostActual + overheadCostActual;
  const costPerGoodUnit = totalGoodQty > 0 ? totalCostActual / totalGoodQty : 0;

  return {
    materialCostActual,
    laborCostActual,
    overheadCostActual,
    totalCostActual,
    costPerGoodUnit,
  };
};

const buildCompletedWorkLogUpdatePayload = ({
  workLog = {},
  nextMaterialUsages = [],
  nextOutputs = [],
  costSummary = {},
  productionOrder = null,
  completedAtValue,
  actor = "system",
} = {}) => ({
  status: "completed",
  completedAt: workLog.completedAt || completedAtValue,
  materialUsages: nextMaterialUsages,
  outputs: nextOutputs,
  materialCostActual: costSummary.materialCostActual,
  laborCostActual: costSummary.laborCostActual,
  overheadCostActual: costSummary.overheadCostActual,
  totalCostActual: costSummary.totalCostActual,
  costPerGoodUnit: costSummary.costPerGoodUnit,
  stockConsumptionStatus: "applied",
  stockOutputStatus: "applied",
  payrollCalculated: false,
  payrollCalculationStatus: "pending",
  productionOrderStatusSnapshot: productionOrder ? "completed" : workLog.productionOrderStatusSnapshot || "",
  updatedAt: serverTimestamp(),
  updatedBy: actor,
});

// =====================================================
// Complete work log + apply stock mutation
// =====================================================
export const completeProductionWorkLog = async (id, currentUser = null) => {
  const workLogRef = doc(db, COLLECTION_NAME, id);
  const actor = resolveProductionWorkLogActor(currentUser);

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

    // AKTIF / GUARDED: output pertama tetap disinkronkan dari summary qty agar sumber hasil produksi tunggal.
    const synchronizedOutputs = synchronizeFirstOutputWithWorkLogSummary(outputs, workLog);

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
      const actualQty = toNumber(line.actualQty || 0);
      const collectionName = getCollectionNameByItemType(line.itemType);

      if (workLog.stockConsumptionStatus === "applied" || line.stockDeducted === true) {
        // =====================================================
        // ACTIVE / GUARDED - hydrate cost untuk material yang sudah dipotong saat Start Production.
        // Fungsi:
        // - mengisi costPerUnitSnapshot/totalCostSnapshot yang masih 0 tanpa memutasi stok ulang;
        // - menjaga completed Work Log tidak tetap material cost 0 jika item punya cost.
        // Alasan blok ini dipakai:
        // - Work Log dari Production Order menandai stockDeducted=true sejak start,
        //   sehingga cabang complete normal tidak lagi membaca cost dari item stok.
        // Status:
        // - aktif dipakai; guarded karena tidak boleh double posting stok/output.
        // =====================================================
        if (collectionName && line.itemId && toNumber(line.costPerUnitSnapshot || 0) <= 0) {
          const stockRef = doc(db, collectionName, line.itemId);
          const stockSnap = await transaction.get(stockRef);

          if (stockSnap.exists()) {
            const stockItem = normalizeReferenceItem({
              id: stockSnap.id,
              ...stockSnap.data(),
            });
            const stockResolution = getResolvedMaterialStock({ line, stockItem });
            const costSnapshot = getItemUnitCostSnapshot({
              itemType: line.itemType,
              stockItem,
              stockResolution,
            });

            nextMaterialUsages.push(
              calculateMaterialUsageLine({
                ...line,
                actualQty,
                materialHasVariants: stockResolution.materialHasVariants === true,
                materialVariantStrategy: stockResolution.materialVariantStrategy || line.materialVariantStrategy || 'none',
                resolvedVariantKey: stockResolution.resolvedVariantKey || line.resolvedVariantKey || '',
                resolvedVariantLabel: stockResolution.resolvedVariantLabel || line.resolvedVariantLabel || '',
                stockSourceType: stockResolution.stockSourceType || line.stockSourceType || 'master',
                costPerUnitSnapshot: costSnapshot.unitCost,
                costSourceSnapshot: costSnapshot.costSource,
                stockDeducted: true,
                stockDeductedAt: line.stockDeductedAt || completedAtValue,
              }),
            );
            continue;
          }
        }

        nextMaterialUsages.push(calculateMaterialUsageLine({ ...line, actualQty, stockDeducted: true }));
        continue;
      }

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

      // =====================================================
      // ACTIVE / GUARDED - snapshot cost material saat Complete Work Log.
      // Fungsi:
      // - mengisi biaya aktual dari dokumen material/output cost source yang valid;
      // - tidak memakai harga jual dan tidak menambah overhead tanpa business rule.
      // Alasan blok ini dipakai:
      // - material usage manual atau legacy bisa belum punya cost snapshot saat form dibuat.
      // Status:
      // - aktif dipakai; guarded karena menjadi dasar material cost dan HPP.
      // =====================================================
      const costSnapshot = getItemUnitCostSnapshot({
        itemType: line.itemType,
        stockItem,
        stockResolution,
      });
      const unitCostSnapshot =
        toNumber(line.costPerUnitSnapshot || 0) || costSnapshot.unitCost;

      nextMaterialUsages.push(
        calculateMaterialUsageLine({
          ...line,
          materialHasVariants: stockResolution.materialHasVariants === true,
          materialVariantStrategy: stockResolution.materialVariantStrategy || line.materialVariantStrategy || 'none',
          resolvedVariantKey: stockResolution.resolvedVariantKey || '',
          resolvedVariantLabel: stockResolution.resolvedVariantLabel || '',
          stockSourceType: stockResolution.stockSourceType || 'master',
          costPerUnitSnapshot: unitCostSnapshot,
          costSourceSnapshot:
            unitCostSnapshot > 0
              ? (toNumber(line.costPerUnitSnapshot || 0) > 0 ? 'existing_line_snapshot' : costSnapshot.costSource)
              : costSnapshot.costSource,
          stockDeducted: actualQty > 0,
          stockDeductedAt: actualQty > 0 ? completedAtValue : null,
        }),
      );
    }

    const totalGoodQty = synchronizedOutputs.reduce((sum, line) => sum + toNumber(line.goodQty || 0), 0);
    if (totalGoodQty <= 0) {
      throw new Error("Good Qty hasil produksi harus lebih dari 0 sebelum work log diselesaikan");
    }

    // AKTIF / GUARDED: costing final tetap material + labor + overhead, tanpa source biaya baru.
    const costSummary = calculateCompletedWorkLogCostSummary({
      nextMaterialUsages,
      workLog,
      totalGoodQty,
    });
    const fallbackUnitCost =
      costSummary.costPerGoodUnit || toNumber(workLog.costPerGoodUnit || 0);
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
        fallbackVariantKey: workLog.targetVariantKey || '',
        fallbackVariantLabel: workLog.targetVariantLabel || '',
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
          extraData: buildProductionOutputAuditMetadata({
            workLog,
            productionOrder,
            outputResolution,
          }),
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

    transaction.update(
      workLogRef,
      buildCompletedWorkLogUpdatePayload({
        workLog,
        nextMaterialUsages,
        nextOutputs,
        costSummary,
        productionOrder,
        completedAtValue,
        actor,
      }),
    );

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

  return id;
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
