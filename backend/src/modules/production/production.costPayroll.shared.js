const {
  loadSourceItem,
  resolveInventoryVariantCollection,
  upsertJsonRecord,
  upsertStockReadModel,
} = require("../stock/engine");
const {
  calculatePayrollLineAmounts,
  calculateWeightedVariantCost,
  normalizeSourceType,
  reconcileAverageUnitCost,
  toPositiveNumber,
} = require("./production.calculations");
const {
  fail,
  findVariant,
  listRecords,
  normalizeLower,
  normalizeText,
  nowIso,
  resolveProductionCode,
  toRecord,
} = require("./production.shared");

const getPayrollRule = async (db, workLog = {}) => {
  let step = null;
  if (workLog.stepId) {
    const row = await db.get("SELECT * FROM production_steps WHERE id = ? AND status != 'deleted'", [workLog.stepId]);
    if (row) step = toRecord(row);
  }
  const payrollClassification = step?.payrollClassification
    || workLog.stepPayrollClassification
    || ((step?.processType || workLog.stepProcessType) === "support_process" ? "support_fulfillment" : "direct_labor");
  return {
    step,
    payrollMode: (step?.payrollMode || workLog.stepPayrollMode) === "per_batch" ? "per_batch" : "per_qty",
    payrollRate: toPositiveNumber(step?.payrollRate ?? workLog.stepPayrollRate ?? 0),
    payrollQtyBase: Math.max(1, toPositiveNumber(step?.payrollQtyBase ?? workLog.stepPayrollQtyBase ?? 1)),
    payrollOutputBasis: (step?.payrollOutputBasis || workLog.stepPayrollOutputBasis) === "actual_output_qty" ? "actual_output_qty" : "good_qty",
    payrollClassification,
    includePayrollInHpp: typeof step?.includePayrollInHpp === "boolean"
      ? step.includePayrollInHpp
      : typeof workLog.stepPayrollIncludeInHpp === "boolean"
        ? workLog.stepPayrollIncludeInHpp
        : payrollClassification === "direct_labor",
  };
};

const getWorkersForWorkLog = async (db, workLog = {}) => {
  const ids = Array.isArray(workLog.workerIds) ? workLog.workerIds.filter(Boolean) : [];
  const names = Array.isArray(workLog.workerNames) ? workLog.workerNames.filter(Boolean) : [];
  const codes = Array.isArray(workLog.workerCodes) ? workLog.workerCodes.filter(Boolean) : [];
  const employeeRows = await listRecords(db, "production_employees");
  const workers = [];

  ids.forEach((id, index) => {
    const employee = employeeRows.find((row) => row.id === id);
    workers.push({
      id,
      code: employee?.code || codes[index] || "",
      name: employee?.name || names[index] || id,
    });
  });

  if (!workers.length) {
    names.forEach((name, index) => workers.push({
      id: `name:${normalizeLower(name)}`,
      code: codes[index] || "",
      name,
    }));
  }

  return workers;
};

const generatePayrollLinesInTransaction = async (db, {
  workLog,
  actor = "system",
} = {}) => {
  if (normalizeLower(workLog.status) !== "completed") {
    fail("Payroll hanya dapat dibuat dari Work Log completed.", "PRODUCTION_WORK_LOG_NOT_COMPLETED", 409);
  }

  const rule = await getPayrollRule(db, workLog);
  const workers = await getWorkersForWorkLog(db, workLog);
  if (rule.includePayrollInHpp && workers.length === 0) {
    fail("Operator produksi wajib dipilih sebelum Work Log diselesaikan.", "PRODUCTION_WORKER_REQUIRED");
  }
  if (workers.length > 0 && rule.payrollRate <= 0) {
    fail("Tarif payroll Tahapan Produksi masih 0.", "PRODUCTION_PAYROLL_RATE_INVALID");
  }
  if (workers.length > 0 && toPositiveNumber(workLog.goodQty) <= 0 && rule.payrollMode === "per_qty") {
    fail("Good Qty harus lebih dari 0 untuk payroll per qty.", "PRODUCTION_GOOD_QTY_INVALID");
  }

  const existingPayrolls = await listRecords(db, "production_payrolls");
  const amounts = calculatePayrollLineAmounts({ workLog, rule });
  const created = [];
  const skipped = [];

  for (const worker of workers) {
    const existing = existingPayrolls.find((row) => (
      row.workLogId === workLog.id
      && normalizeText(row.workerId) === normalizeText(worker.id)
      && normalizeText(row.stepId) === normalizeText(workLog.stepId)
    ));
    if (existing) {
      skipped.push(existing);
      continue;
    }

    const payrollNumber = await resolveProductionCode(db, "production_payrolls", "PAY");
    const payroll = {
      id: payrollNumber,
      code: payrollNumber,
      payrollNumber,
      referenceNumber: payrollNumber,
      name: worker.name || payrollNumber,
      payrollDate: nowIso(),
      transactionDate: nowIso(),
      workLogId: workLog.id,
      workNumber: workLog.workNumber || workLog.code || "",
      bomId: workLog.bomId || "",
      bomCode: workLog.bomCode || "",
      targetType: workLog.targetType || "",
      targetId: workLog.targetId || "",
      targetCode: workLog.targetCode || "",
      targetName: workLog.targetName || "",
      stepId: workLog.stepId || "",
      stepCode: workLog.stepCode || "",
      stepName: workLog.stepName || "",
      workerLineKey: `${workLog.id}:${workLog.stepId || "step"}:${worker.id}`,
      workerId: worker.id,
      workerCode: worker.code,
      workerName: worker.name,
      payrollMode: rule.payrollMode,
      payrollRate: rule.payrollRate,
      payrollQtyBase: rule.payrollQtyBase,
      payrollOutputBasis: rule.payrollOutputBasis,
      payrollClassification: rule.payrollClassification,
      includePayrollInHpp: rule.includePayrollInHpp,
      totalWorkLogOutputQty: toPositiveNumber(workLog.goodQty),
      outputQtyUsed: amounts.outputQtyUsed,
      workedQty: amounts.workedQty,
      payableQtyFactor: amounts.payableQtyFactor,
      amountCalculated: amounts.amountCalculated,
      bonusAmount: 0,
      deductionAmount: 0,
      finalAmount: amounts.finalAmount,
      totalAmount: amounts.finalAmount,
      status: "draft",
      paymentStatus: "unpaid",
      payrollRuleSource: rule.step?.id ? "production_step_master" : "work_log_step_snapshot",
      createdAt: nowIso(),
      createdBy: actor,
      updatedAt: nowIso(),
      updatedBy: actor,
    };
    created.push(await upsertJsonRecord(db, "production_payrolls", payroll));
  }

  return {
    created,
    skipped,
    createdCount: created.length,
    skippedCount: skipped.length,
    payrollIds: [...created, ...skipped].map((row) => row.id),
    accruedLaborAmount: workers.length * amounts.finalAmount,
    accruedLaborHppAmount: rule.includePayrollInHpp ? workers.length * amounts.finalAmount : 0,
    rule,
  };
};

const reconcileOutputCost = async (db, {
  sourceType,
  sourceId,
  variantKey = "",
  affectedQty,
  previousUnitCost,
  nextUnitCost,
} = {}) => {
  const normalizedType = normalizeSourceType(sourceType);
  const { tableName, payload: item } = await loadSourceItem(db, normalizedType, sourceId);
  const field = tableName === "products" ? "hppPerUnit" : "averageCostPerUnit";
  const variant = findVariant(item, variantKey);
  let nextItem = { ...item };

  if (variantKey) {
    if (!variant) fail("Varian output produksi tidak ditemukan.", "PRODUCTION_OUTPUT_VARIANT_NOT_FOUND", 409);
    const variants = resolveInventoryVariantCollection(item).variants.map((row) => {
      if (row !== variant) return row;
      return {
        ...row,
        [field]: reconcileAverageUnitCost({
          currentStock: row.currentStock ?? row.stock ?? 0,
          currentUnitCost: row[field] || 0,
          affectedQty,
          previousUnitCost,
          nextUnitCost,
        }),
      };
    });
    nextItem = {
      ...nextItem,
      variants,
      variantOptions: Array.isArray(item.variantOptions) ? variants : item.variantOptions,
      [field]: calculateWeightedVariantCost(variants, field),
    };
  } else {
    nextItem[field] = reconcileAverageUnitCost({
      currentStock: item.currentStock ?? item.stock ?? 0,
      currentUnitCost: item[field] || 0,
      affectedQty,
      previousUnitCost,
      nextUnitCost,
    });
  }

  if (tableName === "semi_finished_materials") {
    nextItem.lastProductionCostPerUnit = toPositiveNumber(nextUnitCost);
  }
  const saved = await upsertJsonRecord(db, tableName, nextItem);
  await upsertStockReadModel(db, saved, {
    sourceCollection: tableName,
    sourceType: normalizedType,
    lastSyncedFrom: "production_hpp_reconcile",
  });
  return saved;
};


module.exports = {
  generatePayrollLinesInTransaction,
  reconcileOutputCost,
};
