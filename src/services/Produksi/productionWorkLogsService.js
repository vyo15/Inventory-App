// =====================================================
// Production Work Logs Service
// CRUD + helper generate dari BOM / Production Order
// Revisi:
// - Work Log dari PO tetap didukung
// - Completion Work Log sekarang melakukan mutasi stok end-to-end
// - Completion akan consume input, release reserve, add output, lalu close PO
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
  calculateMaterialUsageLine,
  calculateOutputLine,
  calculateProductionMonitoring,
} from "../../constants/productionWorkLogOptions";
import { markProductionOrderInProduction } from "./productionOrdersService";
import { calculateAvailableStock, calculateWeightedAverage, normalizeStockSnapshot, toNumber } from "../../utils/stock/stockHelpers";

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
    bomsSnap,
    ordersSnap,
    employeesSnap,
    rawSnap,
    semiSnap,
    productsSnap,
    stepsSnap,
    profilesSnap,
  ] = await Promise.all([
    getDocs(collection(db, "production_boms")),
    getDocs(collection(db, "production_orders")),
    getDocs(collection(db, "production_employees")),
    getDocs(collection(db, "raw_materials")),
    getDocs(collection(db, "semi_finished_materials")),
    getDocs(collection(db, "products")),
    getDocs(collection(db, "production_steps")),
    getDocs(collection(db, "production_profiles")),
  ]);

  const productionOrders = ordersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((item) => ["reserved", "in_production", "ready"].includes(item.status));

  return {
    boms: filterActiveLike(
      bomsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })),
    ),
    productionOrders,
    employees: filterActiveLike(
      employeesSnap.docs.map((d) =>
        normalizeReferenceItem({
          id: d.id,
          ...d.data(),
        }),
      ),
    ),
    rawMaterials: filterActiveLike(
      rawSnap.docs.map((d) =>
        normalizeReferenceItem({
          id: d.id,
          ...d.data(),
        }),
      ),
    ),
    semiFinishedMaterials: filterActiveLike(
      semiSnap.docs.map((d) =>
        normalizeReferenceItem({
          id: d.id,
          ...d.data(),
        }),
      ),
    ),
    products: filterActiveLike(
      productsSnap.docs.map((d) =>
        normalizeReferenceItem({
          id: d.id,
          ...d.data(),
        }),
      ),
    ),
    productionSteps: filterActiveLike(
      stepsSnap.docs.map((d) =>
        normalizeReferenceItem({
          id: d.id,
          ...d.data(),
        }),
      ),
    ),
    productionProfiles: filterActiveLike(
      profilesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    ),
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
      stockDeducted: false,
      stockDeductedAt: null,
      notes: line.notes || "",
    })),

    outputs,
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

  const bom = {
    id: bomSnap.id,
    ...bomSnap.data(),
  };

  const stepLines = Array.isArray(bom.stepLines) ? bom.stepLines : [];
  const requirementLines = Array.isArray(
    productionOrder.materialRequirementLines,
  )
    ? productionOrder.materialRequirementLines
    : [];

  const chosenStep =
    stepLines.find((item) => item.stepId === selectedStepId) ||
    stepLines[0] ||
    null;

  const outputs = chosenStep
    ? [
        {
          outputType:
            chosenStep.outputType || productionOrder.targetType || "product",
          outputIdRef:
            chosenStep.outputItemId || productionOrder.targetId || "",
          outputCode:
            chosenStep.outputItemCode || productionOrder.targetCode || "",
          outputName:
            chosenStep.outputItemName || productionOrder.targetName || "",
          unit: productionOrder.targetUnit || "pcs",
          goodQty: toNumber(productionOrder.orderQty || 0),
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

    stepId: chosenStep?.stepId || "",
    stepCode: chosenStep?.stepCode || "",
    stepName: chosenStep?.stepName || "",
    sequenceNo: toNumber(chosenStep?.sequenceNo || 1),

    sourceType: "production_order",
    plannedQty: toNumber(productionOrder.orderQty || 0),
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
      stockDeducted: false,
      stockDeductedAt: null,
      notes: "",
    })),

    outputs,
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

    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
  } catch (error) {
    console.error("Query work log utama gagal, pakai fallback", error);
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
  }
};

export const getCompletedProductionWorkLogs = async () => {
  const q = query(
    collection(db, COLLECTION_NAME),
    where("status", "==", "completed"),
    orderBy("workDate", "desc"),
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
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
// Create work log langsung dari Production Order
// =====================================================
export const createProductionWorkLogFromOrder = async (
  orderId,
  extraValues = {},
  currentUser = null,
) => {
  const orderRef = doc(db, "production_orders", orderId);
  const orderSnap = await getDoc(orderRef);

  if (!orderSnap.exists()) {
    throw new Error("Production order tidak ditemukan");
  }

  const order = {
    id: orderSnap.id,
    ...orderSnap.data(),
  };

  const workNumber =
    safeTrim(extraValues.workNumber) ||
    (await generateProductionWorkLogNumber());

  const draft = await buildWorkLogDraftFromProductionOrder(order);

  const payload = {
    ...draft,
    ...extraValues,
    workNumber,
    workDate: extraValues.workDate || new Date(),
    sourceType: "production_order",
    status: "draft",
  };

  const workLogId = await createProductionWorkLog(payload, currentUser);

  await markProductionOrderInProduction(orderId, workLogId, currentUser);

  return workLogId;
};

export const updateProductionWorkLog = async (
  id,
  values,
  currentUser = null,
) => {
  const errors = validateProductionWorkLog(values);

  if (Object.keys(errors).length > 0) {
    throw { type: "validation", errors };
  }

  const exists = await isProductionWorkLogNumberExists(values.workNumber, id);

  if (exists) {
    throw {
      type: "validation",
      errors: {
        workNumber: "Nomor work log sudah digunakan",
      },
    };
  }

  const payload = normalizePayload(values, currentUser, true);
  const ref = doc(db, COLLECTION_NAME, id);

  await updateDoc(ref, payload);

  return id;
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

    if (
      workLog.status === "completed" &&
      workLog.stockConsumptionStatus === "applied" &&
      workLog.stockOutputStatus === "applied"
    ) {
      throw new Error("Work log ini sudah pernah diselesaikan");
    }

    const materialUsages = Array.isArray(workLog.materialUsages)
      ? workLog.materialUsages
      : [];
    const outputs = Array.isArray(workLog.outputs) ? workLog.outputs : [];

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

    const reservedQtyMap = new Map();
    if (productionOrder) {
      const reservationLines = Array.isArray(productionOrder.materialRequirementLines)
        ? productionOrder.materialRequirementLines
        : [];

      reservationLines.forEach((line) => {
        const key = `${line.itemType || ""}::${line.itemId || ""}`;
        const existing = reservedQtyMap.get(key) || 0;
        reservedQtyMap.set(key, existing + toNumber(line.qtyRequired || 0));
      });
    }

    const completedAtValue = new Date();

    const nextMaterialUsages = [];
    for (const line of materialUsages) {
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

      const stockData = normalizeStockSnapshot(stockSnap.data());
      const key = `${line.itemType || ""}::${line.itemId || ""}`;
      const reservedReleaseQty = Math.min(
        toNumber(reservedQtyMap.get(key) || 0),
        stockData.reservedStock,
      );

      if (stockData.currentStock < actualQty) {
        throw new Error(
          `Stok ${line.itemName || "material"} tidak cukup untuk diselesaikan`,
        );
      }

      const nextCurrentStock = stockData.currentStock - actualQty;
      const nextReservedStock = Math.max(
        stockData.reservedStock - reservedReleaseQty,
        0,
      );
      const nextAvailableStock = calculateAvailableStock(
        nextCurrentStock,
        nextReservedStock,
      );

      const updatePayload = {
        updatedAt: serverTimestamp(),
      };

      if (collectionName === "semi_finished_materials") {
        updatePayload.currentStock = nextCurrentStock;
        updatePayload.reservedStock = nextReservedStock;
        updatePayload.availableStock = nextAvailableStock;
      } else {
        updatePayload.stock = nextCurrentStock;
        updatePayload.currentStock = nextCurrentStock;
        updatePayload.reservedStock = nextReservedStock;
        updatePayload.availableStock = nextAvailableStock;
      }

      transaction.update(stockRef, updatePayload);

      nextMaterialUsages.push(
        calculateMaterialUsageLine({
          ...line,
          costPerUnitSnapshot:
            toNumber(line.costPerUnitSnapshot || 0) ||
            getItemUnitCost(line.itemType, stockData),
          stockDeducted: actualQty > 0,
          stockDeductedAt: actualQty > 0 ? completedAtValue : null,
        }),
      );
    }

    const fallbackUnitCost = toNumber(workLog.costPerGoodUnit || 0);
    const nextOutputs = [];

    for (const line of outputs) {
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

      const stockData = normalizeStockSnapshot(stockSnap.data());
      const unitCost = toNumber(line.costPerUnit || 0) || fallbackUnitCost;
      const nextCurrentStock = stockData.currentStock + goodQty;
      const nextAvailableStock = calculateAvailableStock(
        nextCurrentStock,
        stockData.reservedStock,
      );

      const updatePayload = {
        updatedAt: serverTimestamp(),
      };

      if (collectionName === "semi_finished_materials") {
        const nextAverageCost = calculateWeightedAverage(
          stockData.currentStock,
          stockData.averageCostPerUnit,
          goodQty,
          unitCost,
        );

        updatePayload.currentStock = nextCurrentStock;
        updatePayload.availableStock = nextAvailableStock;
        updatePayload.lastProductionCostPerUnit = unitCost;
        updatePayload.averageCostPerUnit = nextAverageCost;
      } else if (collectionName === "products") {
        const currentProductStock = toNumber(stockSnap.data()?.stock ?? stockData.currentStock);
        const currentHpp = toNumber(stockSnap.data()?.hppPerUnit || 0);
        const nextHpp = calculateWeightedAverage(
          currentProductStock,
          currentHpp,
          goodQty,
          unitCost,
        );

        updatePayload.stock = currentProductStock + goodQty;
        updatePayload.currentStock = currentProductStock + goodQty;
        updatePayload.availableStock = currentProductStock + goodQty;
        updatePayload.hppPerUnit = nextHpp;
      } else {
        updatePayload.stock = nextCurrentStock;
        updatePayload.currentStock = nextCurrentStock;
        updatePayload.availableStock = nextAvailableStock;
      }

      transaction.update(stockRef, updatePayload);

      nextOutputs.push(
        calculateOutputLine({
          ...line,
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
