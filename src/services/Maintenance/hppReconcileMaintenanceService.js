import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { reconcileCompletedWorkLogOutputHpp } from "../Produksi/productionWorkLogsService";

// =============================================================================
// HPP Reconcile Maintenance Service — GUARDED
// Fungsi:
// - audit dan repair aman untuk Work Log completed lama yang output/master HPP-nya
//   belum sinkron dengan cost final Work Log;
// - repair hanya memanggil reconcileCompletedWorkLogOutputHpp agar aturan stock/HPP
//   tetap satu sumber di service produksi aktif.
// Guard:
// - tidak menambah qty stok, tidak membuat inventory log baru, tidak membuat transaksi
//   finance, dan tidak mengubah status Work Log/Payroll.
// - Work Log dengan payroll final mismatch ditandai manual, bukan auto-repair.
// =============================================================================

const COLLECTIONS = {
  workLogs: "production_work_logs",
  payrolls: "production_payrolls",
  products: "products",
  semiFinishedMaterials: "semi_finished_materials",
};

const COST_TOLERANCE = 1;
const MAX_REPAIR_COUNT = 120;

const safeTrim = (value) => String(value ?? "").trim();
const normalize = (value) => safeTrim(value).toLowerCase();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isNumberClose = (left, right, tolerance = COST_TOLERANCE) => (
  Math.abs(toNumber(left) - toNumber(right)) <= tolerance
);

const buildDocItem = (itemDoc) => ({
  id: itemDoc.id,
  ...itemDoc.data(),
});

const readCollectionDocs = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map(buildDocItem);
};

const buildMap = (items = []) => new Map(items.map((item) => [safeTrim(item.id), item]));

const getUniqueKeys = (values = []) => Array.from(
  new Set(values.map((value) => safeTrim(value)).filter(Boolean)),
);

const getWorkLogIdentityKeys = (workLog = {}) => getUniqueKeys([
  workLog.id,
  workLog.workLogId,
  workLog.workNumber,
  workLog.code,
  workLog.referenceNumber,
  workLog.sourceRef,
]);

const getPayrollWorkLogKeys = (payroll = {}) => getUniqueKeys([
  payroll.workLogId,
  payroll.workLogRefId,
  payroll.details?.workLogId,
  payroll.details?.workLogRefId,
  payroll.workNumber,
  payroll.workLogCode,
  payroll.referenceNumber,
  payroll.sourceRef,
]);

const isPayrollIncludedInHpp = (payroll = {}) => normalize(payroll.status) !== "cancelled" && payroll.includePayrollInHpp !== false;

const isPayrollFinalForHpp = (payroll = {}) => {
  if (!isPayrollIncludedInHpp(payroll)) return false;
  const status = normalize(payroll.status);
  const paymentStatus = normalize(payroll.paymentStatus);
  if (["confirmed", "paid"].includes(status) || paymentStatus === "paid") return true;
  return !status && !paymentStatus && getPayrollFinalAmount(payroll) > 0;
};

const getPayrollFinalAmount = (payroll = {}) => toNumber(
  payroll.finalAmount ?? payroll.amountCalculated ?? payroll.totalAmount,
);

const getOutputCollectionName = (outputType = "") => {
  const normalized = normalize(outputType);
  if (["product", "products", "finished_product"].includes(normalized)) return COLLECTIONS.products;
  if (["semi_finished", "semi_finished_material", "semi_finished_materials"].includes(normalized)) {
    return COLLECTIONS.semiFinishedMaterials;
  }
  return "";
};

const getOutputCostField = (collectionName = "") => (
  collectionName === COLLECTIONS.products ? "hppPerUnit" : "averageCostPerUnit"
);

const getVariantIdentity = (variant = {}) => safeTrim(
  variant.variantKey ||
    variant.id ||
    variant.variantId ||
    variant.name ||
    variant.label ||
    variant.color ||
    variant.code ||
    variant.sku,
).toLowerCase();

const getLineVariantKey = (line = {}) => safeTrim(
  line.outputVariantKey ||
    line.variantKey ||
    line.resolvedVariantKey ||
    line.targetVariantKey ||
    line.details?.variantKey,
).toLowerCase();

const findOutputVariant = (stockItem = {}, line = {}) => {
  const lineVariantKey = getLineVariantKey(line);
  if (!lineVariantKey || !Array.isArray(stockItem.variants)) return null;
  return stockItem.variants.find((variant) => getVariantIdentity(variant) === lineVariantKey) || null;
};

const getDisplayReference = (workLog = {}) => (
  safeTrim(workLog.workNumber) || safeTrim(workLog.code) || safeTrim(workLog.referenceNumber) || safeTrim(workLog.id)
);

const calculateMaterialCostFromUsages = (materialUsages = []) => (
  (Array.isArray(materialUsages) ? materialUsages : []).reduce((sum, line = {}) => {
    const totalSnapshot = toNumber(line.totalCostSnapshot);
    if (totalSnapshot > 0) return sum + totalSnapshot;
    return sum + (toNumber(line.actualQty) * toNumber(line.costPerUnitSnapshot));
  }, 0)
);

const getWorkLogExpectedUnitCost = (workLog = {}) => {
  const goodQty = toNumber(workLog.goodQty);
  if (goodQty <= 0) return 0;

  const materialCost = calculateMaterialCostFromUsages(workLog.materialUsages || []);
  const laborCost = toNumber(workLog.laborCostActual);
  const overheadCost = toNumber(workLog.overheadCostActual);
  const totalCost = materialCost + laborCost + overheadCost;

  return totalCost > 0 ? totalCost / goodQty : 0;
};

const buildPayrollRelationMap = (payrolls = []) => payrolls.reduce((map, payroll) => {
  const payrollRecord = { ...payroll };
  getPayrollWorkLogKeys(payroll).forEach((key) => {
    const current = map.get(key) || [];
    if (!current.some((item) => item.id === payrollRecord.id)) current.push(payrollRecord);
    map.set(key, current);
  });
  return map;
}, new Map());

const getRelatedPayrolls = (payrollsByWorkLogKey, workLog = {}) => {
  const seen = new Set();
  const related = [];

  getWorkLogIdentityKeys(workLog).forEach((key) => {
    (payrollsByWorkLogKey.get(key) || []).forEach((payroll) => {
      if (seen.has(payroll.id)) return;
      seen.add(payroll.id);
      related.push(payroll);
    });
  });

  return related;
};

const buildHppIssueState = ({ workLog = {}, productsById, semiFinishedById }) => {
  const outputs = Array.isArray(workLog.outputs) ? workLog.outputs : [];
  const expectedUnitCost = getWorkLogExpectedUnitCost(workLog);
  const issueParts = [];
  const state = {
    expectedUnitCost,
    hasOutputLineIssue: false,
    hasMasterCostIssue: false,
    hasVariantCostIssue: false,
    hasMissingMasterIssue: false,
    issueText: "",
  };

  if (expectedUnitCost <= 0) return state;

  outputs.forEach((line = {}) => {
    const lineGoodQty = toNumber(line.goodQty);
    if (lineGoodQty <= 0 || line.stockAdded !== true) return;

    const collectionName = getOutputCollectionName(line.outputType);
    const outputId = safeTrim(line.outputIdRef || line.outputId || line.itemId);
    if (!collectionName || !outputId) return;

    const outputName = safeTrim(line.outputName || line.itemName) || outputId;
    const outputLineCost = toNumber(line.costPerUnit ?? line.costPerUnitSnapshot ?? line.hppPerUnit);
    if (outputLineCost <= 0 || !isNumberClose(outputLineCost, expectedUnitCost)) {
      state.hasOutputLineIssue = true;
      issueParts.push(`output line ${outputName} ${outputLineCost}, final ${expectedUnitCost}`);
    }

    const stockItem = collectionName === COLLECTIONS.products
      ? productsById.get(outputId)
      : semiFinishedById.get(outputId);
    if (!stockItem) {
      state.hasMasterCostIssue = true;
      state.hasMissingMasterIssue = true;
      issueParts.push(`master ${outputName} tidak ditemukan`);
      return;
    }

    const costField = getOutputCostField(collectionName);
    const lineVariantKey = getLineVariantKey(line);
    if (lineVariantKey) {
      const outputVariant = findOutputVariant(stockItem, line);
      const variantCost = toNumber(outputVariant?.[costField] || 0);
      const variantStock = toNumber(outputVariant?.currentStock ?? outputVariant?.stock ?? 0);
      if (!outputVariant || variantCost <= 0 || (variantStock <= lineGoodQty && !isNumberClose(variantCost, expectedUnitCost))) {
        state.hasVariantCostIssue = true;
        issueParts.push(`variant ${safeTrim(line.outputVariantLabel) || lineVariantKey} ${variantCost || 0}, final ${expectedUnitCost}`);
      }
      return;
    }

    const masterCost = toNumber(stockItem?.[costField] || 0);
    const masterStock = toNumber(stockItem?.currentStock ?? stockItem?.stock ?? 0);
    if (masterCost <= 0 || (masterStock <= lineGoodQty && !isNumberClose(masterCost, expectedUnitCost))) {
      state.hasMasterCostIssue = true;
      issueParts.push(`master ${outputName} ${masterCost}, final ${expectedUnitCost}`);
    }
  });

  state.issueText = issueParts.join("; ");
  return state;
};

const buildSummary = ({ rows = [], checkedRecords = 0 }) => ({
  checkedRecords,
  okCount: Math.max(checkedRecords - rows.length, 0),
  issueCount: rows.length,
  safeRepairCount: rows.filter((row) => row.category === "safe_repair").length,
  manualReviewCount: rows.filter((row) => row.category === "manual").length,
  executablePlanCount: rows.filter((row) => row.category === "safe_repair").length,
});

const buildAuditRow = ({ workLog = {}, category = "manual", issue = "", recommendation = "", issueState = {}, payrollFinalAmount = 0 }) => ({
  key: `hpp-reconcile-${workLog.id}`,
  scope: "hpp_output_reconcile",
  code: getDisplayReference(workLog),
  status: normalize(workLog.status) || "work_log",
  category,
  issue,
  recommendation,
  resetScope: "hpp_output_reconcile",
  workLogId: workLog.id,
  workLogCode: getDisplayReference(workLog),
  outputCount: Array.isArray(workLog.outputs) ? workLog.outputs.filter((line) => line?.stockAdded === true && toNumber(line.goodQty) > 0).length : 0,
  goodQty: toNumber(workLog.goodQty ?? workLog.outputGoodQty ?? workLog.completedQty ?? workLog.actualOutputQty),
  expectedUnitCost: issueState.expectedUnitCost || getWorkLogExpectedUnitCost(workLog),
  payrollFinalAmount,
  hasOutputLineIssue: issueState.hasOutputLineIssue === true,
  hasMasterCostIssue: issueState.hasMasterCostIssue === true,
  hasVariantCostIssue: issueState.hasVariantCostIssue === true,
  hasMissingMasterIssue: issueState.hasMissingMasterIssue === true,
});

export const getHppReconcileMaintenanceAudit = async () => {
  const [workLogs, payrolls, products, semiFinishedMaterials] = await Promise.all([
    readCollectionDocs(COLLECTIONS.workLogs),
    readCollectionDocs(COLLECTIONS.payrolls),
    readCollectionDocs(COLLECTIONS.products),
    readCollectionDocs(COLLECTIONS.semiFinishedMaterials),
  ]);

  const payrollsByWorkLogKey = buildPayrollRelationMap(payrolls);
  const productsById = buildMap(products);
  const semiFinishedById = buildMap(semiFinishedMaterials);

  const rows = workLogs.flatMap((workLog) => {
    const status = normalize(workLog.status);
    const goodQty = toNumber(workLog.goodQty ?? workLog.outputGoodQty ?? workLog.completedQty ?? workLog.actualOutputQty);
    const postedOutputs = (Array.isArray(workLog.outputs) ? workLog.outputs : []).filter((line) => line?.stockAdded === true && toNumber(line.goodQty) > 0);

    if (status !== "completed" || goodQty <= 0 || postedOutputs.length === 0) return [];

    const relatedPayrolls = getRelatedPayrolls(payrollsByWorkLogKey, workLog);
    const activePayrollCount = relatedPayrolls.filter(isPayrollIncludedInHpp).length;
    const finalPayrollAmount = relatedPayrolls
      .filter(isPayrollFinalForHpp)
      .reduce((sum, payroll) => sum + getPayrollFinalAmount(payroll), 0);
    const laborCostActual = toNumber(workLog.laborCostActual);

    if (activePayrollCount > 0 && finalPayrollAmount <= 0) {
      return [buildAuditRow({
        workLog,
        payrollFinalAmount,
        category: "manual",
        issue: "Work Log completed punya payroll aktif tetapi belum ada payroll final. HPP lama belum aman direconcile otomatis.",
        recommendation: "Finalkan payroll dulu, lalu jalankan audit ulang sebelum repair HPP.",
      })];
    }

    if (finalPayrollAmount > 0 && !isNumberClose(laborCostActual, finalPayrollAmount)) {
      return [buildAuditRow({
        workLog,
        payrollFinalAmount,
        category: "manual",
        issue: "laborCostActual Work Log belum sama dengan total payroll final. Repair HPP output ditunda agar tidak memakai cost final yang salah.",
        recommendation: "Perbaiki/sinkronkan payroll final dulu, lalu audit ulang HPP reconcile.",
      })];
    }

    const issueState = buildHppIssueState({ workLog, productsById, semiFinishedById });
    if (!issueState.hasOutputLineIssue && !issueState.hasMasterCostIssue && !issueState.hasVariantCostIssue) return [];

    if (issueState.hasMissingMasterIssue) {
      return [buildAuditRow({
        workLog,
        payrollFinalAmount,
        issueState,
        category: "manual",
        issue: issueState.issueText || "Master output produksi tidak ditemukan. Repair otomatis ditunda.",
        recommendation: "Cek master Product/Semi Finished atau reset scoped data testing sebelum menjalankan repair HPP output.",
      })];
    }

    return [buildAuditRow({
      workLog,
      payrollFinalAmount,
      issueState,
      category: "safe_repair",
      issue: issueState.issueText || "Output/master HPP belum sinkron dengan cost final Work Log.",
      recommendation: "Jalankan Repair HPP Output agar output line dan master HPP/average cost sinkron tanpa posting stok ulang.",
    })];
  });

  return {
    generatedAt: new Date().toISOString(),
    rows,
    summary: buildSummary({ rows, checkedRecords: workLogs.length }),
  };
};

export const repairHppReconcileMaintenance = async (currentUser = null) => {
  const audit = await getHppReconcileMaintenanceAudit();
  const repairRows = (audit.rows || []).filter((row) => row.category === "safe_repair");
  const limitedRows = repairRows.slice(0, MAX_REPAIR_COUNT);
  const skippedByLimit = Math.max(repairRows.length - limitedRows.length, 0);
  const actor = safeTrim(currentUser?.email || currentUser?.displayName || currentUser?.uid || currentUser) || "maintenance-ui";

  const repairedRows = [];
  const skippedRows = [];
  const errorRows = [];

  for (const row of limitedRows) {
    try {
      const result = await reconcileCompletedWorkLogOutputHpp(row.workLogId, {
        actor,
        source: "reset_maintenance_hpp_reconcile",
      });

      if (["reconciled", "already_synced"].includes(result?.status)) {
        repairedRows.push({ ...row, result });
      } else {
        skippedRows.push({ ...row, result });
      }
    } catch (error) {
      errorRows.push({
        ...row,
        errorMessage: error?.message || "Repair HPP output gagal.",
      });
    }
  }

  if (skippedByLimit > 0) {
    skippedRows.push({
      key: "hpp-reconcile-limit",
      issue: `${skippedByLimit} kandidat repair belum diproses karena batas aman ${MAX_REPAIR_COUNT} per eksekusi.`,
      result: { status: "skipped_batch_limit" },
    });
  }

  const summary = {
    ...audit.summary,
    attemptedCount: limitedRows.length,
    repairedCount: repairedRows.length,
    skippedCount: skippedRows.length,
    errorCount: errorRows.length,
    batchLimit: MAX_REPAIR_COUNT,
  };

  return {
    generatedAt: new Date().toISOString(),
    summary,
    updatedCount: repairedRows.length,
    skippedCount: skippedRows.length,
    errorCount: errorRows.length,
    repairedRows,
    skippedRows,
    errorRows,
    message: errorRows.length
      ? `Repair HPP output selesai dengan ${errorRows.length} error. Cek audit log dan ulangi setelah penyebabnya diperbaiki.`
      : `Repair HPP output selesai untuk ${repairedRows.length} Work Log. Tidak ada stok/inventory log baru yang dibuat.`,
  };
};

export default getHppReconcileMaintenanceAudit;
