const { createAuditLog } = require("../../utils/auditLog");
const {
  commitStockMutation,
  loadSourceItem,
  upsertJsonRecord,
} = require("../stock/engine");
const {
  getMaterialCostTotal,
  normalizeSourceType,
  toPositiveInteger,
  toPositiveNumber,
} = require("./production.calculations");
const {
  fail,
  getMaterialUnitCost,
  getRecord,
  normalizeLower,
  normalizeText,
  nowIso,
  runProductionTransaction,
} = require("./production.shared");
const {
  generatePayrollLinesInTransaction,
  reconcileOutputCost,
} = require("./production.costPayroll.shared");

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


module.exports = { completeProductionWorkLog, ensureLegacyMaterialsConsumed };
