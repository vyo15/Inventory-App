const { createAuditLog } = require("../../utils/auditLog");
const {
  commitStockMutation,
  loadSourceItem,
  resolveInventoryVariantCollection,
  upsertJsonRecord,
  upsertStockReadModel,
} = require("../../utils/sqliteStockEngine");
const { createFinanceMovement } = require("../../utils/sqliteFinanceEngine");
const {
  calculatePayrollLineAmounts,
  calculateWeightedVariantCost,
  getEffectiveLaborCost,
  getMaterialCostTotal,
  normalizeSourceType,
  reconcileAverageUnitCost,
  toNumber,
  toPositiveInteger,
  toPositiveNumber,
} = require("./production.calculations");
const {
  ProductionError,
  fail,
  findVariant,
  getMaterialUnitCost,
  getRecord,
  listRecords,
  normalizeLower,
  normalizeText,
  nowIso,
  resolveProductionCode,
  runProductionTransaction,
  toRecord,
} = require("./production.shared");
const {
  cancelProductionPlan,
  createOrderCommit,
  createOrderFromPlan,
  refreshOrderRequirements,
  startProductionOrder,
} = require("./production.order.service");
const {
  assertDirectCreateAllowed,
  assertDirectUpdateAllowed,
  getProductionRouterDefinitions,
} = require("./production.guards");

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

const ensureLegacyMaterialsConsumed = async (db, workLog, actor) => {
  const lines = Array.isArray(workLog.materialUsages) ? workLog.materialUsages : [];
  const nextLines = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || {};
    if (line.stockDeducted === true) {
      nextLines.push(line);
      continue;
    }
    const sourceType = normalizeSourceType(line.itemType || line.sourceType || "raw_material");
    const sourceId = normalizeText(line.itemId || line.sourceId);
    const quantity = toPositiveInteger(line.actualQty || line.plannedQty || 0);
    if (!sourceId || quantity <= 0) {
      nextLines.push(line);
      continue;
    }
    const variantKey = normalizeText(line.resolvedVariantKey || line.variantKey || "");
    const { payload: item } = await loadSourceItem(db, sourceType, sourceId);
    const cost = getMaterialUnitCost({ sourceType, item, variantKey });
    const mutation = await commitStockMutation(db, {
      sourceType,
      sourceId,
      deltaCurrent: -quantity,
      variantKey,
      referenceNumber: `${workLog.workNumber || workLog.code || workLog.id}-${String(index + 1).padStart(2, "0")}-LEGACY-MATERIAL-OUT`,
      reason: "production_material_usage",
      notes: `Legacy material completion ${workLog.workNumber || workLog.id}`,
      actor,
      transactionType: "production_material_out",
      transactionPayload: { workLogId: workLog.id, productionOrderId: workLog.productionOrderId || "" },
    });
    nextLines.push({
      ...line,
      itemType: sourceType,
      actualQty: quantity,
      costPerUnitSnapshot: toPositiveNumber(line.costPerUnitSnapshot) || cost.unitCost,
      totalCostSnapshot: toPositiveNumber(line.totalCostSnapshot) || (quantity * cost.unitCost),
      costSource: line.costSource || cost.costSource,
      stockDeducted: true,
      stockDeductedAt: nowIso(),
      stockMutationReference: mutation.referenceNumber,
    });
  }
  return nextLines;
};

const completeProductionWorkLog = async ({ workLogId, payload = {}, actor = "system" } = {}) => runProductionTransaction(async (db) => {
  const current = await getRecord(db, "production_work_logs", workLogId, "Work Log produksi");
  if (normalizeLower(current.status) === "completed") {
    fail("Work Log sudah completed dan tidak dapat diselesaikan ulang.", "PRODUCTION_WORK_LOG_ALREADY_COMPLETED", 409);
  }

  const completionPayload = payload || {};
  const workLog = {
    ...current,
    goodQty: completionPayload.goodQty ?? current.goodQty ?? 0,
    actualOutputQty: completionPayload.actualOutputQty
      ?? completionPayload.goodQty
      ?? current.actualOutputQty
      ?? current.goodQty
      ?? 0,
    rejectQty: completionPayload.rejectQty ?? current.rejectQty ?? 0,
    reworkQty: completionPayload.reworkQty ?? current.reworkQty ?? 0,
    scrapQty: completionPayload.scrapQty ?? current.scrapQty ?? 0,
    workerIds: Array.isArray(completionPayload.workerIds) ? completionPayload.workerIds : current.workerIds,
    workerNames: Array.isArray(completionPayload.workerNames) ? completionPayload.workerNames : current.workerNames,
    workerCodes: Array.isArray(completionPayload.workerCodes) ? completionPayload.workerCodes : current.workerCodes,
    workerCount: Array.isArray(completionPayload.workerIds)
      ? completionPayload.workerIds.length
      : current.workerCount,
    notes: Object.prototype.hasOwnProperty.call(completionPayload, "notes")
      ? completionPayload.notes
      : current.notes,
    id: current.id,
    code: current.code,
    workNumber: current.workNumber || current.code,
    productionOrderId: current.productionOrderId,
    status: "completed",
  };
  workLog.goodQty = toPositiveInteger(workLog.goodQty || 0);
  workLog.actualOutputQty = toPositiveInteger(workLog.actualOutputQty || workLog.goodQty);
  if (workLog.goodQty <= 0) fail("Good Qty wajib lebih dari 0 sebelum Work Log diselesaikan.", "PRODUCTION_GOOD_QTY_INVALID");

  workLog.materialUsages = await ensureLegacyMaterialsConsumed(db, workLog, actor);
  const materialCostActual = getMaterialCostTotal(workLog);
  const completedAt = nowIso();

  const temporaryCompleted = {
    ...workLog,
    status: "completed",
    completedAt,
    materialCostActual,
  };
  const payrollResult = await generatePayrollLinesInTransaction(db, { workLog: temporaryCompleted, actor });
  const laborCostActual = payrollResult.accruedLaborHppAmount;
  const overheadCostActual = toPositiveNumber(workLog.overheadCostActual);
  const totalCostActual = materialCostActual + laborCostActual + overheadCostActual;
  const costPerGoodUnit = workLog.goodQty > 0 ? totalCostActual / workLog.goodQty : 0;

  const sourceOutputs = Array.isArray(workLog.outputs) && workLog.outputs.length
    ? workLog.outputs
    : [{
      outputType: workLog.targetType,
      outputIdRef: workLog.targetId,
      outputCode: workLog.targetCode,
      outputName: workLog.targetName,
      outputVariantKey: workLog.targetVariantKey,
      outputVariantLabel: workLog.targetVariantLabel,
    }];
  const outputs = [];

  for (let index = 0; index < sourceOutputs.length; index += 1) {
    const line = sourceOutputs[index] || {};
    if (line.stockAdded === true) {
      outputs.push(line);
      continue;
    }
    const sourceType = normalizeSourceType(line.outputType || line.sourceType || workLog.targetType || "product");
    const sourceId = normalizeText(line.outputIdRef || line.itemId || workLog.targetId);
    const quantity = toPositiveInteger(line.goodQty || (sourceOutputs.length === 1 ? workLog.goodQty : 0));
    if (!sourceId || quantity <= 0) continue;
    const variantKey = normalizeText(line.outputVariantKey || line.variantKey || workLog.targetVariantKey || "");
    const mutation = await commitStockMutation(db, {
      sourceType,
      sourceId,
      deltaCurrent: quantity,
      variantKey,
      referenceNumber: `${workLog.workNumber || workLog.id}-${String(index + 1).padStart(2, "0")}-OUTPUT-IN`,
      reason: "production_output",
      notes: `Output produksi ${workLog.workNumber || workLog.id}`,
      actor,
      transactionType: "production_output_in",
      transactionPayload: { workLogId: workLog.id, productionOrderId: workLog.productionOrderId || "" },
    });
    await reconcileOutputCost(db, {
      sourceType,
      sourceId,
      variantKey,
      affectedQty: quantity,
      previousUnitCost: 0,
      nextUnitCost: costPerGoodUnit,
    });
    outputs.push({
      ...line,
      outputType: sourceType,
      outputIdRef: sourceId,
      goodQty: quantity,
      outputVariantKey: variantKey,
      stockSourceType: variantKey ? "variant" : "master",
      costPerUnit: costPerGoodUnit,
      stockAdded: true,
      stockAddedAt: completedAt,
      stockMutationReference: mutation.referenceNumber,
      stockBefore: mutation.beforeStock,
      stockAfter: mutation.afterStock,
    });
  }

  if (!outputs.some((line) => line.stockAdded === true)) {
    fail("Output Work Log tidak valid atau qty output masih 0.", "PRODUCTION_OUTPUT_INVALID");
  }

  const savedWorkLog = await upsertJsonRecord(db, "production_work_logs", {
    ...workLog,
    materialUsages: workLog.materialUsages,
    outputs,
    status: "completed",
    completedAt,
    materialCostActual,
    laborCostActual,
    overheadCostActual,
    totalCostActual,
    costPerGoodUnit,
    stockConsumptionStatus: "completed",
    stockOutputStatus: "completed",
    payrollCalculated: true,
    payrollCalculationStatus: "generated",
    payrollIds: payrollResult.payrollIds,
    updatedAt: completedAt,
    updatedBy: actor,
  });

  let savedOrder = null;
  if (workLog.productionOrderId) {
    const order = await getRecord(db, "production_orders", workLog.productionOrderId, "Production Order");
    savedOrder = await upsertJsonRecord(db, "production_orders", {
      ...order,
      status: "completed",
      completedAt,
      workLogId: savedWorkLog.id,
      workNumber: savedWorkLog.workNumber,
      updatedAt: completedAt,
      updatedBy: actor,
    });
  }

  await createAuditLog({
    module: "production",
    action: "complete_work_log",
    entityType: "production_work_log",
    entityId: savedWorkLog.id,
    actor,
    description: `Work Log ${savedWorkLog.workNumber || savedWorkLog.id} completed secara atomic`,
    metadata: {
      productionOrderId: savedWorkLog.productionOrderId || null,
      goodQty: savedWorkLog.goodQty,
      outputCount: outputs.length,
      payrollCreatedCount: payrollResult.createdCount,
      payrollSkippedCount: payrollResult.skippedCount,
      totalCostActual,
      costPerGoodUnit,
    },
  });

  return {
    workLog: savedWorkLog,
    order: savedOrder,
    payroll: {
      createdCount: payrollResult.createdCount,
      skippedCount: payrollResult.skippedCount,
      payrollIds: payrollResult.payrollIds,
    },
  };
});

const generatePayrollLines = async ({ workLogId, actor = "system" } = {}) => runProductionTransaction(async (db) => {
  const workLog = await getRecord(db, "production_work_logs", workLogId, "Work Log produksi");
  const result = await generatePayrollLinesInTransaction(db, { workLog, actor });
  const savedWorkLog = await upsertJsonRecord(db, "production_work_logs", {
    ...workLog,
    payrollCalculated: true,
    payrollCalculationStatus: "generated",
    payrollIds: result.payrollIds,
    updatedAt: nowIso(),
    updatedBy: actor,
  });
  await createAuditLog({
    module: "production",
    action: "generate_payroll",
    entityType: "production_work_log",
    entityId: workLog.id,
    actor,
    description: `Payroll Work Log ${workLog.workNumber || workLog.id} diproses secara atomic`,
    metadata: { createdCount: result.createdCount, skippedCount: result.skippedCount },
  });
  return {
    workLog: savedWorkLog,
    createdCount: result.createdCount,
    skippedCount: result.skippedCount,
    payrollIds: result.payrollIds,
  };
});

const reconcileWorkLogHppFromPayroll = async (db, workLogId, actor) => {
  if (!workLogId) return null;
  const workLog = await getRecord(db, "production_work_logs", workLogId, "Work Log produksi");
  const payrolls = (await listRecords(db, "production_payrolls")).filter((row) => row.workLogId === workLog.id);
  const previousUnitCost = toPositiveNumber(workLog.costPerGoodUnit);
  const laborCostActual = getEffectiveLaborCost(payrolls);
  const materialCostActual = getMaterialCostTotal(workLog);
  const overheadCostActual = toPositiveNumber(workLog.overheadCostActual);
  const totalCostActual = materialCostActual + laborCostActual + overheadCostActual;
  const goodQty = toPositiveNumber(workLog.goodQty);
  const nextUnitCost = goodQty > 0 ? totalCostActual / goodQty : 0;
  const outputs = [];

  for (const line of Array.isArray(workLog.outputs) ? workLog.outputs : []) {
    const quantity = toPositiveNumber(line.goodQty);
    const sourceId = normalizeText(line.outputIdRef || line.itemId);
    if (line.stockAdded === true && sourceId && quantity > 0) {
      await reconcileOutputCost(db, {
        sourceType: line.outputType || line.sourceType || workLog.targetType,
        sourceId,
        variantKey: line.outputVariantKey || line.variantKey || "",
        affectedQty: quantity,
        previousUnitCost,
        nextUnitCost,
      });
    }
    outputs.push({ ...line, costPerUnit: nextUnitCost });
  }

  const saved = await upsertJsonRecord(db, "production_work_logs", {
    ...workLog,
    outputs,
    materialCostActual,
    laborCostActual,
    overheadCostActual,
    totalCostActual,
    costPerGoodUnit: nextUnitCost,
    hppReconciledAt: nowIso(),
    hppReconciledBy: actor,
    updatedAt: nowIso(),
    updatedBy: actor,
  });
  return saved;
};

const finalizeProductionPayroll = async ({ payrollId, payload = {}, actor = "system" } = {}) => runProductionTransaction(async (db) => {
  const current = await getRecord(db, "production_payrolls", payrollId, "Payroll produksi");
  if (normalizeLower(current.paymentStatus) === "paid") {
    fail("Payroll yang sudah paid tidak dapat di-finalisasi ulang.", "PRODUCTION_PAYROLL_ALREADY_PAID", 409);
  }
  const savedPayroll = await upsertJsonRecord(db, "production_payrolls", {
    ...current,
    ...(payload || {}),
    id: current.id,
    code: current.code,
    payrollNumber: current.payrollNumber || current.code,
    status: "confirmed",
    confirmedAt: payload.confirmedAt || current.confirmedAt || nowIso(),
    updatedAt: nowIso(),
    updatedBy: actor,
  });
  const workLog = await reconcileWorkLogHppFromPayroll(db, savedPayroll.workLogId, actor);
  await createAuditLog({
    module: "production",
    action: "confirm_payroll",
    entityType: "production_payroll",
    entityId: savedPayroll.id,
    actor,
    description: `Payroll ${savedPayroll.payrollNumber || savedPayroll.id} dikonfirmasi dan HPP direconcile`,
    metadata: { workLogId: savedPayroll.workLogId || null, finalAmount: savedPayroll.finalAmount },
  });
  return { payroll: savedPayroll, workLog };
});

const markProductionPayrollPaid = async ({ payrollId, payload = {}, actor = "system" } = {}) => runProductionTransaction(async (db) => {
  const current = await getRecord(db, "production_payrolls", payrollId, "Payroll produksi");
  const finalAmount = Math.round(toNumber(payload.finalAmount ?? current.finalAmount ?? current.amountCalculated ?? 0));
  const paidAt = payload.paidAt || current.paidAt || nowIso();
  const expenseId = `production_payroll_expense_${current.id}`;
  const existingExpense = await db.get(
    `SELECT id
     FROM expenses
     WHERE status != 'deleted'
       AND (
         id = ?
         OR (
           source_id = ?
           AND (
             source_type IN ('production_payroll', 'production_payrolls', 'auto_production_payroll')
             OR json_extract(payload_json, '$.sourceModule') IN ('production_payroll', 'production_payrolls')
           )
         )
       )
     LIMIT 1`,
    [expenseId, current.id],
  );
  let financeResult = null;
  let expenseSyncStatus = existingExpense ? "already_exists" : "skipped_zero_amount";

  if (finalAmount > 0 && !existingExpense) {
    financeResult = await createFinanceMovement(db, {
      direction: "out",
      actor,
      sourceModule: "production_payroll",
      sourceId: current.id,
      sourceRef: current.payrollNumber || current.code || current.id,
      description: `Payroll produksi ${current.payrollNumber || current.code || current.id}`,
      payload: {
        id: expenseId,
        referenceNumber: `CSH-OUT-${current.payrollNumber || current.code || current.id}`,
        type: "Payroll Produksi",
        amount: finalAmount,
        totalAmount: finalAmount,
        transactionDate: paidAt,
        sourceModule: "production_payroll",
        sourceType: "auto_production_payroll",
        sourceId: current.id,
        sourceRef: current.payrollNumber || current.code || current.id,
        relatedPayrollId: current.id,
        status: "Tercatat",
        description: `Payroll produksi ${current.payrollNumber || current.code || current.id}`,
      },
    });
    expenseSyncStatus = "created";
  }

  const savedPayroll = await upsertJsonRecord(db, "production_payrolls", {
    ...current,
    ...(payload || {}),
    id: current.id,
    code: current.code,
    payrollNumber: current.payrollNumber || current.code,
    finalAmount,
    totalAmount: finalAmount,
    status: "paid",
    paymentStatus: "paid",
    paidAt,
    financeExpenseId: expenseId,
    expenseSyncStatus,
    financeResult: financeResult ? {
      movementId: financeResult.movement?.id || expenseId,
      ledgerId: financeResult.ledger?.id || `ledger_${expenseId}`,
    } : current.financeResult || null,
    updatedAt: nowIso(),
    updatedBy: actor,
  });
  const workLog = await reconcileWorkLogHppFromPayroll(db, savedPayroll.workLogId, actor);

  await createAuditLog({
    module: "production",
    action: "payroll_paid",
    entityType: "production_payroll",
    entityId: savedPayroll.id,
    actor,
    description: `Payroll ${savedPayroll.payrollNumber || savedPayroll.id} ditandai paid secara atomic`,
    metadata: {
      workLogId: savedPayroll.workLogId || null,
      finalAmount,
      expenseId,
      expenseSyncStatus,
    },
  });

  return { payroll: savedPayroll, workLog, financeResult, expenseSyncStatus };
});


module.exports = {
  ProductionError,
  assertDirectCreateAllowed,
  assertDirectUpdateAllowed,
  cancelProductionPlan,
  completeProductionWorkLog,
  createOrderCommit,
  createOrderFromPlan,
  finalizeProductionPayroll,
  generatePayrollLines,
  getProductionRouterDefinitions,
  markProductionPayrollPaid,
  refreshOrderRequirements,
  runProductionTransaction,
  startProductionOrder,
};
