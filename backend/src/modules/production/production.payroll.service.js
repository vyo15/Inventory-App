const { createAuditLog } = require("../../utils/auditLog");
const { upsertJsonRecord } = require("../stock/engine");
const { createFinanceMovement } = require("../finance/finance.engine");
const {
  getEffectiveLaborCost,
  getMaterialCostTotal,
  toNumber,
  toPositiveNumber,
} = require("./production.calculations");
const {
  fail,
  getRecord,
  listRecords,
  normalizeLower,
  normalizeText,
  nowIso,
  runProductionTransaction,
} = require("./production.shared");
const {
  generatePayrollLinesInTransaction,
  reconcileOutputCost,
} = require("./production.costPayroll.shared");

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
  finalizeProductionPayroll,
  generatePayrollLines,
  markProductionPayrollPaid,
  reconcileWorkLogHppFromPayroll,
};
