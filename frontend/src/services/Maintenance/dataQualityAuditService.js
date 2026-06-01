import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import {
  calculateBomCostSummary,
  hydrateBomMaterialLinesWithLiveCost,
} from "../../utils/produksi/productionBomCostHelpers";
import {
  BOM_COST_COMPARE_TOLERANCE,
  CATEGORY_CONFIGS,
  SAMPLE_LIMIT,
  addIssue,
  createCategoryAccumulator,
  getFirstReferenceValue,
  getPayrollFinalAmount,
  getPurchaseIdentityKeys,
  getPurchaseLinkedKeys,
  getReturnIdentityKeys,
  getReturnLinkedKeys,
  getSalesIdentityKeys,
  getSalesLinkedKeys,
  getUniqueMapRecordsByKeys,
  getWorkLogIdentityKeys,
  hasClearHumanSourceReference,
  hasPrefix,
  hasPositiveTransactionAmount,
  hasPositiveTransactionQuantity,
  isHumanReference,
  isNumberClose,
  isPayrollFinalForHpp,
  isPayrollIncludedInHpp,
  isPurchaseExpenseRecord,
  looksLikeFirestoreId,
  normalizeType,
  pushUniqueMapRecord,
  safeTrim,
  toNumber,
  toSample,
} from "./helpers/dataQualityAuditHelpers";

const readCollectionSafe = async (collectionName) => {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return { collectionName, docs: snapshot.docs, error: "" };
  } catch (error) {
    console.error(error);
    return {
      collectionName,
      docs: [],
      error: error?.message || `Collection ${collectionName} tidak bisa dibaca.`,
    };
  }
};

/*
=====================================================
SECTION: Audit stale estimate BOM — AKTIF / GUARDED
Fungsi:
- Menghitung ulang estimasi BOM secara read-only dari master Raw Material dan Semi Finished terbaru.

Dipakai oleh:
- getDataQualityAudit untuk kategori production_boms_stale_cost_estimate.

Alasan perubahan:
- Reset HPP/modal bisa membuat master cost 0, sementara BOM lama masih menyimpan cost snapshot/estimate lama. Audit harus bisa menandai mismatch tanpa menulis data.

Catatan cleanup:
- Jika Data Quality Audit makin besar, helper ini bisa dipindah ke service khusus audit produksi.

Risiko:
- Jangan menjadikan hasil audit ini auto-fix; update BOM/HPP harus tetap lewat reset/edit guarded agar history transaksi tidak berubah diam-diam.
=====================================================
*/
const buildBomCostReferenceData = (collectionMap = {}) => ({
  hasReadError: Boolean(collectionMap.raw_materials?.error || collectionMap.semi_finished_materials?.error),
  rawMaterials: (collectionMap.raw_materials?.docs || []).map((itemDoc) => ({
    id: itemDoc.id,
    ...itemDoc.data(),
  })),
  semiFinishedMaterials: (collectionMap.semi_finished_materials?.docs || []).map((itemDoc) => ({
    id: itemDoc.id,
    ...itemDoc.data(),
  })),
});

const buildLiveBomCostEstimate = (data = {}, referenceData = {}) => {
  const materialLines = hydrateBomMaterialLinesWithLiveCost({
    materialLines: Array.isArray(data.materialLines) ? data.materialLines : [],
    referenceData,
  });
  const stepLines = Array.isArray(data.stepLines) ? data.stepLines : [];
  const summary = calculateBomCostSummary({
    materialLines,
    stepLines,
    header: data,
  });

  return {
    materialLines,
    ...summary,
  };
};

const getBomStaleCostIssueText = (data = {}, liveEstimate = {}) => {
  const storedMaterial = toNumber(data.materialCostEstimate);
  const storedTotal = toNumber(data.totalCostEstimate);
  const liveMaterial = toNumber(liveEstimate.materialCostEstimate);
  const liveTotal = toNumber(liveEstimate.totalCostEstimate);

  return [
    !isNumberClose(storedMaterial, liveMaterial, BOM_COST_COMPARE_TOLERANCE)
      ? `Material tersimpan ${storedMaterial}, live ${liveMaterial}`
      : "",
    !isNumberClose(storedTotal, liveTotal, BOM_COST_COMPARE_TOLERANCE)
      ? `Total tersimpan ${storedTotal}, live ${liveTotal}`
      : "",
  ].filter(Boolean).join("; ") || "Snapshot material BOM tidak sama dengan master cost terbaru.";
};

const hasStaleBomCostEstimate = (data = {}, liveEstimate = {}) => {
  const materialLines = Array.isArray(data.materialLines) ? data.materialLines : [];
  const liveLines = Array.isArray(liveEstimate.materialLines) ? liveEstimate.materialLines : [];
  const hasLineMismatch = materialLines.some((line = {}, index) => {
    const liveLine = liveLines[index] || {};
    return (
      !isNumberClose(line.costPerUnitSnapshot, liveLine.costPerUnitSnapshot, BOM_COST_COMPARE_TOLERANCE) ||
      !isNumberClose(line.totalCostSnapshot, liveLine.totalCostSnapshot, BOM_COST_COMPARE_TOLERANCE)
    );
  });

  return (
    hasLineMismatch ||
    !isNumberClose(data.materialCostEstimate, liveEstimate.materialCostEstimate, BOM_COST_COMPARE_TOLERANCE) ||
    !isNumberClose(data.totalCostEstimate, liveEstimate.totalCostEstimate, BOM_COST_COMPARE_TOLERANCE)
  );
};

const getOutputCollectionName = (outputType = "") => {
  const normalized = normalizeType(outputType);
  if (normalized === "product") return "products";
  if (normalized === "semi_finished_material" || normalized === "semi_finished") return "semi_finished_materials";
  return "";
};

const buildDocDataMap = (docs = []) => docs.reduce((acc, itemDoc) => {
  acc.set(itemDoc.id, {
    id: itemDoc.id,
    ...itemDoc.data(),
  });
  return acc;
}, new Map());

const getVariantIdentity = (variant = {}) => safeTrim(
  variant.variantKey ||
    variant.id ||
    variant.variantId ||
    variant.name ||
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

const getOutputCostField = (collectionName = "") => (
  collectionName === "products" ? "hppPerUnit" : "averageCostPerUnit"
);

const getMasterCurrentStock = (data = {}) => toNumber(data.currentStock ?? data.stock ?? 0);

const getMasterCostForAudit = (collectionName = "", data = {}) => {
  if (collectionName === "raw_materials") return toNumber(data.averageActualUnitCost ?? 0);
  if (collectionName === "products") return toNumber(data.hppPerUnit ?? data.hpp ?? data.costPerUnit ?? 0);
  if (collectionName === "semi_finished_materials") return toNumber(data.averageCostPerUnit ?? data.hppPerUnit ?? data.costPerUnit ?? 0);
  return 0;
};

const buildOutputHppReconcileIssues = (data = {}, finalPayrollAmount = 0, masterRefs = {}) => {
  const outputs = Array.isArray(data.outputs) ? data.outputs : [];
  const goodQty = toNumber(data.goodQty ?? data.outputGoodQty ?? data.completedQty ?? data.actualOutputQty);
  const result = {
    hasOutputLineIssue: false,
    hasMasterCostIssue: false,
    hasVariantCostIssue: false,
    issueText: "",
  };

  if (!outputs.length || goodQty <= 0 || finalPayrollAmount <= 0) return result;

  const materialCost = toNumber(data.materialCostActual ?? data.materialCost ?? data.materialTotalCost);
  const overheadCost = toNumber(data.overheadCostActual ?? data.overheadCost ?? data.overheadTotalCost);
  const expectedFinalTotal = materialCost + overheadCost + finalPayrollAmount;
  const expectedCostPerGoodUnit = goodQty > 0 ? expectedFinalTotal / goodQty : 0;

  if (expectedCostPerGoodUnit <= 0) return result;

  const issueParts = [];

  outputs.forEach((line = {}) => {
    const outputGoodQty = toNumber(line.goodQty ?? line.outputQty ?? line.qty ?? line.quantity);
    if (outputGoodQty <= 0 || line.stockAdded !== true) return;

    const outputUnitCost = toNumber(line.costPerUnit ?? line.costPerUnitSnapshot ?? line.hppPerUnit);
    const collectionName = getOutputCollectionName(line.outputType);
    const outputId = safeTrim(line.outputIdRef || line.outputId || line.itemId);

    if (outputUnitCost <= 0 || !isNumberClose(outputUnitCost, expectedCostPerGoodUnit, BOM_COST_COMPARE_TOLERANCE)) {
      result.hasOutputLineIssue = true;
      issueParts.push(`output line ${safeTrim(line.outputName) || outputId || "-"} ${outputUnitCost}, final ${expectedCostPerGoodUnit}`);
    }

    const stockItem = collectionName === "products"
      ? masterRefs.productsById?.get(outputId)
      : masterRefs.semiFinishedById?.get(outputId);
    if (!stockItem) return;

    const costField = getOutputCostField(collectionName);
    const outputVariant = findOutputVariant(stockItem, line);
    const lineVariantKey = getLineVariantKey(line);

    if (lineVariantKey) {
      const variantCost = toNumber(outputVariant?.[costField] || 0);
      const variantStock = toNumber(outputVariant?.currentStock ?? outputVariant?.stock ?? 0);
      if (!outputVariant || variantCost <= 0 || (variantStock <= outputGoodQty && !isNumberClose(variantCost, expectedCostPerGoodUnit, BOM_COST_COMPARE_TOLERANCE))) {
        result.hasVariantCostIssue = true;
        issueParts.push(`variant ${safeTrim(line.outputVariantLabel) || lineVariantKey} ${variantCost || 0}, final ${expectedCostPerGoodUnit}`);
      }
      return;
    }

    const masterCost = toNumber(stockItem?.[costField] || 0);
    const masterStock = toNumber(stockItem?.currentStock ?? stockItem?.stock ?? 0);
    if (masterCost <= 0 || (masterStock <= outputGoodQty && !isNumberClose(masterCost, expectedCostPerGoodUnit, BOM_COST_COMPARE_TOLERANCE))) {
      result.hasMasterCostIssue = true;
      issueParts.push(`master ${safeTrim(line.outputName) || outputId || "-"} ${masterCost}, final ${expectedCostPerGoodUnit}`);
    }
  });

  result.issueText = issueParts.join("; ");
  return result;
};

const isManualCashOutExpense = (data = {}) => {
  const sourceModule = normalizeType(data.sourceModule || data.module || data.sourceType || data.type);
  const hasPurchaseLink = Boolean(
    safeTrim(data.relatedPurchaseId) ||
    safeTrim(data.purchaseId) ||
    safeTrim(data.details?.purchaseId)
  );
  const hasPayrollLink = Boolean(
    safeTrim(data.payrollId) ||
    safeTrim(data.productionPayrollId) ||
    safeTrim(data.relatedPayrollId) ||
    sourceModule.includes("payroll")
  );

  if (hasPurchaseLink || hasPayrollLink) return false;
  if (!sourceModule) return true;
  return sourceModule.includes("cash") || sourceModule.includes("manual") || sourceModule.includes("expense");
};

const isManualCashInRevenue = (data = {}) => {
  const sourceModule = normalizeType(data.sourceModule || data.module || data.sourceType || data.type);
  if (sourceModule.includes("sales") || sourceModule.includes("penjualan")) return false;
  return true;
};

const hasMaterialSnapshotIssue = (data = {}) => {
  const materialUsages = Array.isArray(data.materialUsages)
    ? data.materialUsages
    : Array.isArray(data.materials)
      ? data.materials
      : [];

  if (!materialUsages.length) return true;

  return materialUsages.some((line = {}) => {
    const qty = toNumber(line.actualQty ?? line.qty ?? line.quantity ?? line.plannedQty);
    if (qty <= 0) return false;
    const unitCost = toNumber(line.costPerUnitSnapshot ?? line.unitCostSnapshot ?? line.actualUnitCost ?? line.costPerUnit);
    const totalCost = toNumber(line.totalCostSnapshot ?? line.totalCostActual ?? line.totalCost);
    return unitCost <= 0 && totalCost <= 0;
  });
};

const hasUnclearSource = (data = {}) => {
  const sourceModule = safeTrim(data.sourceModule || data.module || data.sourceType || data.type);
  const sourceRef = getFirstReferenceValue(data, [
    "sourceRef",
    "referenceCode",
    "referenceNumber",
    "cashInNumber",
    "cashOutNumber",
    "saleNumber",
    "purchaseNumber",
    "payrollNumber",
  ]);
  const technicalRef = getFirstReferenceValue(data, [
    "sourceId",
    "relatedId",
    "referenceId",
    "saleId",
    "purchaseId",
    "payrollId",
  ]);

  if (sourceModule && isHumanReference(sourceRef)) return false;
  if (sourceModule && sourceRef && !looksLikeFirestoreId(sourceRef)) return false;
  if (sourceModule && technicalRef && !looksLikeFirestoreId(technicalRef)) return false;

  return !sourceModule || !sourceRef || looksLikeFirestoreId(sourceRef) || looksLikeFirestoreId(technicalRef);
};


export const getDataQualityAudit = async () => {
  const categories = createCategoryAccumulator();
  const collectionNames = [
    "sales",
    "purchases",
    "returns",
    "revenues",
    "expenses",
    "incomes",
    "production_work_logs",
    "production_payrolls",
    "stock_adjustments",
    "inventory_logs",
    "products",
    "raw_materials",
    "semi_finished_materials",
    "production_boms",
    "supplierPurchases",
    "customers",
  ];

  const collectionResults = await Promise.all(collectionNames.map(readCollectionSafe));
  const collectionMap = collectionResults.reduce((acc, item) => {
    acc[item.collectionName] = item;
    return acc;
  }, {});

  const bomCostReferenceData = buildBomCostReferenceData(collectionMap);
  const productionHppMasterRefs = {
    productsById: buildDocDataMap(collectionMap.products?.docs || []),
    semiFinishedById: buildDocDataMap(collectionMap.semi_finished_materials?.docs || []),
  };

  const payrollsByWorkLogKey = new Map();
  (collectionMap.production_payrolls?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const payrollRecord = { id: itemDoc.id, ...data };
    getWorkLogIdentityKeys({
      id: data.workLogId,
      workLogId: data.workLogId,
      workNumber: data.workNumber,
      code: data.workLogCode,
      referenceNumber: data.referenceNumber,
      sourceRef: data.sourceRef,
    }, data.workLogId).forEach((key) => pushUniqueMapRecord(payrollsByWorkLogKey, key, payrollRecord));
  });

  const incomeSaleKeys = new Set();
  (collectionMap.incomes?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const deterministicSaleId = itemDoc.id.startsWith("income_")
      ? safeTrim(itemDoc.id.replace(/^income_/, ""))
      : "";

    getSalesLinkedKeys(data, deterministicSaleId).forEach((saleKey) => {
      incomeSaleKeys.add(saleKey);
    });
  });

  const saleInventoryLogsBySaleKey = new Map();
  const purchaseInventoryLogsByPurchaseKey = new Map();
  const returnInventoryLogsByReturnKey = new Map();
  (collectionMap.inventory_logs?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const logType = normalizeType(data.type || data.details?.type);
    const logRecord = { id: itemDoc.id, ...data };

    if (logType === "sale") {
      getSalesLinkedKeys(data, "").forEach((saleKey) => pushUniqueMapRecord(saleInventoryLogsBySaleKey, saleKey, logRecord));
      return;
    }

    if (logType === "purchase_in") {
      getPurchaseLinkedKeys(data, "").forEach((purchaseKey) => pushUniqueMapRecord(purchaseInventoryLogsByPurchaseKey, purchaseKey, logRecord));
      return;
    }

    if (logType === "return_in") {
      getReturnLinkedKeys(data, "").forEach((returnKey) => pushUniqueMapRecord(returnInventoryLogsByReturnKey, returnKey, logRecord));
      return;
    }
  });

  const purchaseExpenseKeys = new Set();
  (collectionMap.expenses?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!isPurchaseExpenseRecord(data)) return;
    const deterministicPurchaseId = itemDoc.id.includes("__")
      ? safeTrim(itemDoc.id.split("__").slice(1).join("__"))
      : "";

    getPurchaseLinkedKeys(data, deterministicPurchaseId).forEach((purchaseKey) => {
      purchaseExpenseKeys.add(purchaseKey);
    });
  });

  (collectionMap.sales?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const status = safeTrim(data.status);
    const saleItems = Array.isArray(data.items) ? data.items : [];
    const saleIdentityKeys = getSalesIdentityKeys(data, itemDoc.id);
    const hasSaleIncome = saleIdentityKeys.some((saleKey) => incomeSaleKeys.has(saleKey));

    if (!hasPrefix(data, ["ORD"], ["saleNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "sales_missing_sal", toSample({
        collectionName: "sales",
        itemDoc,
        issue: "Belum punya kode Order format ORD.",
        recommendation: categories.sales_missing_sal.recommendation,
      }));
    }


    if (["Diproses", "Dikirim"].includes(status) && hasSaleIncome) {
      addIssue(categories, "sales_pending_income_conflict", toSample({
        collectionName: "sales",
        itemDoc,
        issue: "Sales belum Selesai tetapi sudah memiliki income resmi.",
        recommendation: categories.sales_pending_income_conflict.recommendation,
      }));
    }

    if (status === "Selesai" && toNumber(data.total) > 0 && !hasSaleIncome) {
      addIssue(categories, "sales_completed_income_missing", toSample({
        collectionName: "sales",
        itemDoc,
        issue: "Sales Selesai bernilai lebih dari 0 tetapi belum punya income resmi.",
        recommendation: categories.sales_completed_income_missing.recommendation,
      }));
    }

    const saleInventoryLogs = getUniqueMapRecordsByKeys(saleInventoryLogsBySaleKey, saleIdentityKeys);
    if (["Diproses", "Dikirim", "Selesai"].includes(status) && saleItems.length > 0 && saleInventoryLogs.length === 0) {
      addIssue(categories, "sales_inventory_log_missing", toSample({
        collectionName: "sales",
        itemDoc,
        issue: "Sales aktif/selesai punya item tetapi tidak ditemukan inventory log type sale.",
        recommendation: categories.sales_inventory_log_missing.recommendation,
      }));
    }

  });

  (collectionMap.purchases?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const purchaseIdentityKeys = getPurchaseIdentityKeys(data, itemDoc.id);
    const hasPurchaseExpense = purchaseIdentityKeys.some((purchaseKey) => purchaseExpenseKeys.has(purchaseKey));
    const purchaseInventoryLogs = getUniqueMapRecordsByKeys(purchaseInventoryLogsByPurchaseKey, purchaseIdentityKeys);

    if (!hasPrefix(data, ["PUR"], ["purchaseNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "purchases_missing_pur", toSample({
        collectionName: "purchases",
        itemDoc,
        issue: "Belum punya kode Purchase format PUR.",
        recommendation: categories.purchases_missing_pur.recommendation,
      }));
    }

    if (hasPositiveTransactionAmount(data) && !hasPurchaseExpense) {
      addIssue(categories, "purchases_expense_missing", toSample({
        collectionName: "purchases",
        itemDoc,
        issue: "Purchase bernilai lebih dari 0 tetapi tidak ditemukan expense otomatis terkait.",
        recommendation: categories.purchases_expense_missing.recommendation,
      }));
    }

    if (hasPositiveTransactionQuantity(data) && purchaseInventoryLogs.length === 0) {
      addIssue(categories, "purchases_inventory_log_missing", toSample({
        collectionName: "purchases",
        itemDoc,
        issue: "Purchase punya qty/stock in tetapi tidak ditemukan inventory log type purchase_in.",
        recommendation: categories.purchases_inventory_log_missing.recommendation,
      }));
    }
  });

  (collectionMap.returns?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const returnIdentityKeys = getReturnIdentityKeys(data, itemDoc.id);
    const returnInventoryLogs = getUniqueMapRecordsByKeys(returnInventoryLogsByReturnKey, returnIdentityKeys);

    if (!hasPrefix(data, ["RET"], ["returnNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "returns_missing_ret", toSample({
        collectionName: "returns",
        itemDoc,
        issue: "Belum punya kode Return format RET.",
        recommendation: categories.returns_missing_ret.recommendation,
      }));
    }

    if (hasPositiveTransactionQuantity(data) && returnInventoryLogs.length === 0) {
      addIssue(categories, "returns_inventory_log_missing", toSample({
        collectionName: "returns",
        itemDoc,
        issue: "Return punya qty tetapi tidak ditemukan inventory log type return_in.",
        recommendation: categories.returns_inventory_log_missing.recommendation,
      }));
    }
  });

  (collectionMap.revenues?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (isManualCashInRevenue(data) && !hasPrefix(data, ["CSH-IN"], ["cashInNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "cash_missing_cin_cout", toSample({
        collectionName: "revenues",
        itemDoc,
        issue: "Cash In manual belum punya kode CSH-IN.",
        recommendation: categories.cash_missing_cin_cout.recommendation,
      }));
    }
  });

  (collectionMap.expenses?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (isManualCashOutExpense(data) && !hasPrefix(data, ["CSH-OUT"], ["cashOutNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "cash_missing_cin_cout", toSample({
        collectionName: "expenses",
        itemDoc,
        issue: "Cash Out manual belum punya kode CSH-OUT.",
        recommendation: categories.cash_missing_cin_cout.recommendation,
      }));
    }
  });

  (collectionMap.production_work_logs?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["JOB"], ["workNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "work_logs_missing_wl", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: "Work Log belum punya workNumber format JOB.",
        recommendation: categories.work_logs_missing_wl.recommendation,
      }));
    }

    const status = normalizeType(data.status);
    const goodQty = toNumber(data.goodQty ?? data.outputGoodQty ?? data.completedQty ?? data.actualOutputQty);
    const totalCost = toNumber(data.totalCostActual ?? data.totalActualCost ?? data.costTotalActual);
    if ((status === "completed" || goodQty > 0) && totalCost <= 0) {
      addIssue(categories, "work_logs_zero_cost", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: "Work Log completed/good qty punya total cost 0.",
        recommendation: categories.work_logs_zero_cost.recommendation,
      }));
    }

    const materialUsageLines = Array.isArray(data.materialUsages)
      ? data.materialUsages
      : Array.isArray(data.materials)
        ? data.materials
        : [];
    if ((status === "completed" || materialUsageLines.length > 0) && hasMaterialSnapshotIssue(data)) {
      addIssue(categories, "work_logs_empty_material_snapshot", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: "Material usage belum punya snapshot cost yang jelas.",
        recommendation: categories.work_logs_empty_material_snapshot.recommendation,
      }));
    }

    if (["draft", "cancelled", "canceled"].includes(status)) {
      addIssue(categories, "work_logs_legacy_status", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: `Work Log memakai status legacy ${status || "-"}.`,
        recommendation: categories.work_logs_legacy_status.recommendation,
      }));
    }

    const relatedPayrolls = getUniqueMapRecordsByKeys(payrollsByWorkLogKey, getWorkLogIdentityKeys(data, itemDoc.id));
    const finalPayrollAmount = relatedPayrolls
      .filter(isPayrollFinalForHpp)
      .reduce((sum, line) => sum + getPayrollFinalAmount(line), 0);
    const activePayrollCount = relatedPayrolls.filter(isPayrollIncludedInHpp).length;

    if ((status === "completed" || goodQty > 0) && activePayrollCount > 0 && finalPayrollAmount <= 0) {
      addIssue(categories, "work_logs_payroll_pending", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: "Work Log completed punya payroll aktif tetapi belum ada payroll final untuk HPP.",
        recommendation: categories.work_logs_payroll_pending.recommendation,
      }));
    }

    if ((status === "completed" || goodQty > 0) && finalPayrollAmount > 0 && !isNumberClose(data.laborCostActual, finalPayrollAmount)) {
      addIssue(categories, "work_logs_payroll_cost_mismatch", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: "laborCostActual Work Log tidak sama dengan total payroll final HPP.",
        recommendation: categories.work_logs_payroll_cost_mismatch.recommendation,
      }));
    }

    const outputHppIssues = buildOutputHppReconcileIssues(data, finalPayrollAmount, productionHppMasterRefs);
    if ((status === "completed" || goodQty > 0) && (
      outputHppIssues.hasOutputLineIssue ||
      outputHppIssues.hasMasterCostIssue ||
      outputHppIssues.hasVariantCostIssue
    )) {
      addIssue(categories, "work_logs_output_hpp_reconcile_needed", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: outputHppIssues.issueText || "Output/master HPP terlihat belum ikut final payroll; data lama perlu review/backfill guarded agar master HPP/average cost sinkron.",
        recommendation: categories.work_logs_output_hpp_reconcile_needed.recommendation,
      }));
    }

    if ((status === "completed" || goodQty > 0) && outputHppIssues.hasOutputLineIssue) {
      addIssue(categories, "work_logs_output_cost_stale", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: outputHppIssues.issueText || "Output line cost Work Log belum sama dengan HPP final payroll.",
        recommendation: categories.work_logs_output_cost_stale.recommendation,
      }));
    }

    if ((status === "completed" || goodQty > 0) && outputHppIssues.hasMasterCostIssue) {
      addIssue(categories, "work_logs_master_hpp_stale", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: outputHppIssues.issueText || "Master HPP/average cost output terlihat belum sinkron dengan HPP final payroll.",
        recommendation: categories.work_logs_master_hpp_stale.recommendation,
      }));
    }

    if ((status === "completed" || goodQty > 0) && outputHppIssues.hasVariantCostIssue) {
      addIssue(categories, "work_logs_variant_hpp_stale", toSample({
        collectionName: "production_work_logs",
        itemDoc,
        issue: outputHppIssues.issueText || "Variant HPP/average cost output terlihat belum sinkron dengan HPP final payroll.",
        recommendation: categories.work_logs_variant_hpp_stale.recommendation,
      }));
    }
  });


  (collectionMap.stock_adjustments?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["STK-ADJ"], ["adjustmentNumber", "code", "referenceNumber", "sourceRef"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "stock_adjustments",
        itemDoc,
        issue: "Stock Adjustment belum punya kode STK-ADJ.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }
  });

  (collectionMap.production_payrolls?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const hasPayrollNumber = hasPrefix(data, ["PAY"], ["payrollNumber", "code", "referenceNumber", "sourceRef"]);
    const hasSourceRef = hasClearHumanSourceReference(data, ["sourceRef", "workNumber", "workLogNumber", "referenceCode", "workLogRef"]);
    if (!hasPayrollNumber || !hasSourceRef) {
      addIssue(categories, "payroll_unclear_reference", toSample({
        collectionName: "production_payrolls",
        itemDoc,
        issue: "Payroll belum punya payrollNumber/sourceRef manusiawi yang jelas.",
        recommendation: categories.payroll_unclear_reference.recommendation,
      }));
    }
  });

  (collectionMap.inventory_logs?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const humanRef = getFirstReferenceValue(data, [
      "sourceRef",
      "referenceCode",
      "referenceNumber",
      "displayReference",
      "auditReference",
      "details.sourceRef",
      "details.referenceCode",
      "details.referenceNumber",
    ]);
    const technicalRef = getFirstReferenceValue(data, [
      "referenceId",
      "sourceId",
      "relatedId",
      "workLogId",
      "purchaseId",
      "saleId",
      "returnId",
      "details.referenceId",
      "details.sourceId",
      "details.workLogId",
    ]);

    if (!isHumanReference(humanRef) && (looksLikeFirestoreId(technicalRef) || !safeTrim(humanRef))) {
      addIssue(categories, "inventory_log_random_reference", toSample({
        collectionName: "inventory_logs",
        itemDoc,
        issue: "Inventory Log belum punya reference manusiawi; masih kosong atau ID teknis.",
        recommendation: categories.inventory_log_random_reference.recommendation,
      }));
    }
  });

  ["expenses", "incomes", "revenues"].forEach((collectionName) => {
    (collectionMap[collectionName]?.docs || []).forEach((itemDoc) => {
      const data = itemDoc.data();
      if (hasUnclearSource(data)) {
        addIssue(categories, "cash_source_unclear", toSample({
          collectionName,
          itemDoc,
          issue: "Source/sourceRef income atau expense belum jelas.",
          recommendation: categories.cash_source_unclear.recommendation,
        }));
      }
    });
  });

  (collectionMap.products?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const isRelevant = data.isActive !== false && data.active !== false;
    if (isRelevant && !hasPrefix(data, ["PRD"], ["code", "productCode"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "products",
        itemDoc,
        issue: "Produk belum punya kode PRD.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }
  });

  (collectionMap.raw_materials?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const isRelevant = data.isActive !== false && data.active !== false;
    if (isRelevant && !hasPrefix(data, ["RAW"], ["code", "materialCode"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "raw_materials",
        itemDoc,
        issue: "Raw Material belum punya kode RAW.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }
  });

  (collectionMap.semi_finished_materials?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const isRelevant = data.isActive !== false && data.active !== false;
    if (isRelevant && !hasPrefix(data, ["SFP"], ["code", "itemCode"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "semi_finished_materials",
        itemDoc,
        issue: "Semi Finished belum punya kode SFP.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }

    if (isRelevant && !safeTrim(data.flowerGroup)) {
      addIssue(categories, "semi_finished_missing_flower_group", toSample({
        collectionName: "semi_finished_materials",
        itemDoc,
        issue: "Semi Finished aktif belum punya flowerGroup eksplisit.",
        recommendation: categories.semi_finished_missing_flower_group.recommendation,
      }));
    }
  });

  (collectionMap.production_boms?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["BOM-PRD", "BOM-SFP", "BOM"], ["code", "bomCode"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "production_boms",
        itemDoc,
        issue: "BOM belum punya kode BOM otomatis.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }

    if (!bomCostReferenceData.hasReadError) {
      const liveEstimate = buildLiveBomCostEstimate(data, bomCostReferenceData);
      if (hasStaleBomCostEstimate(data, liveEstimate)) {
        addIssue(categories, "production_boms_stale_cost_estimate", toSample({
          collectionName: "production_boms",
          itemDoc,
          issue: getBomStaleCostIssueText(data, liveEstimate),
          recommendation: categories.production_boms_stale_cost_estimate.recommendation,
        }));
      }
    }
  });

  (collectionMap.supplierPurchases?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["SUP"], ["code", "supplierCode"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "supplierPurchases",
        itemDoc,
        issue: "Supplier belum punya kode SUP.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }
  });

  (collectionMap.customers?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    if (!hasPrefix(data, ["CUS"], ["code", "customerCode"])) {
      addIssue(categories, "master_missing_code", toSample({
        collectionName: "customers",
        itemDoc,
        issue: "Customer belum punya kode CUS.",
        recommendation: categories.master_missing_code.recommendation,
      }));
    }
  });

  [
    ["raw_materials", collectionMap.raw_materials?.docs || []],
    ["semi_finished_materials", collectionMap.semi_finished_materials?.docs || []],
    ["products", collectionMap.products?.docs || []],
  ].forEach(([collectionName, docs]) => {
    docs.forEach((itemDoc) => {
      const data = itemDoc.data();
      const isRelevant = data.isActive !== false && data.active !== false;
      const currentStock = getMasterCurrentStock(data);
      const unitCost = getMasterCostForAudit(collectionName, data);

      if (isRelevant && currentStock > 0 && unitCost <= 0) {
        addIssue(categories, "cost_zero_with_stock", toSample({
          collectionName,
          itemDoc,
          issue: `Stok masih ada (${currentStock}) tetapi cost/HPP master 0.`,
          recommendation: categories.cost_zero_with_stock.recommendation,
        }));
      }
    });
  });

  (collectionMap.products?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const isRelevant = data.isActive !== false && data.active !== false;
    if (isRelevant && toNumber(data.hppPerUnit ?? data.hpp ?? data.costPerUnit) <= 0) {
      addIssue(categories, "hpp_zero_master", toSample({
        collectionName: "products",
        itemDoc,
        issue: "HPP produk jadi masih 0.",
        recommendation: categories.hpp_zero_master.recommendation,
      }));
    }
  });

  (collectionMap.semi_finished_materials?.docs || []).forEach((itemDoc) => {
    const data = itemDoc.data();
    const isRelevant = data.isActive !== false && data.active !== false;
    if (isRelevant && toNumber(data.averageCostPerUnit ?? data.hppPerUnit ?? data.costPerUnit) <= 0) {
      addIssue(categories, "hpp_zero_master", toSample({
        collectionName: "semi_finished_materials",
        itemDoc,
        issue: "Average cost semi finished masih 0.",
        recommendation: categories.hpp_zero_master.recommendation,
      }));
    }
  });

  const categoriesResult = CATEGORY_CONFIGS.map((config) => categories[config.key]);
  const skippedCollections = collectionResults
    .filter((item) => item.error)
    .map((item) => ({ key: item.collectionName, error: item.error }));
  const checkedRecords = collectionResults.reduce((sum, item) => sum + item.docs.length, 0);
  const totalIssueRecords = categoriesResult.reduce((sum, item) => sum + item.count, 0);

  return {
    generatedAt: new Date().toISOString(),
    sampleLimit: SAMPLE_LIMIT,
    summary: {
      checkedRecords,
      totalIssueRecords,
      totalCategoriesWithIssues: categoriesResult.filter((item) => item.count > 0).length,
      skippedCollections: skippedCollections.length,
    },
    skippedCollections,
    categories: categoriesResult,
  };
};



export default getDataQualityAudit;
