import { normalizeTruthyText as safeTrim } from "../../utils/text/textNormalization";
import { toFiniteNumber } from "../../utils/number/numberNormalization";
import { getCurrentIsoTimestamp, getProductionActorName } from "./helpers/productionAuditMetadata";
import { calculatePayrollAmounts } from "../../constants/productionPayrollOptions";
import {
  commitProductionPayrollFinalize,
  commitProductionPayrollGeneration,
  commitProductionPayrollPaid,
  createProductionRecord,
  generateProductionCode,
  getProductionRecordById,
  listProductionRecords,
  updateProductionRecord,
} from "../../data/adapters/sqlite/sqliteProductionAdapter";
import { getActiveProductionEmployees } from "./productionEmployeesService";
import { getActiveProductionSteps } from "./productionStepsService";
import { getCompletedProductionWorkLogs } from "./productionWorkLogsService";


export const validateProductionPayroll = (values = {}) => {
  const errors = {};
  if (!values.payrollDate) errors.payrollDate = "Tanggal payroll wajib diisi";
  if (!values.workLogId) errors.workLogId = "Work log wajib dipilih";
  if (!values.workerName && !values.workerId) errors.workerId = "Karyawan wajib dipilih";
  const hasFinalAmount = values.finalAmount !== undefined
    && values.finalAmount !== null
    && values.finalAmount !== "";
  const finalAmount = toFiniteNumber(values.finalAmount, Number.NaN);
  if (hasFinalAmount && !Number.isFinite(finalAmount)) {
    errors.finalAmount = "Total payroll tidak valid";
  } else if (finalAmount < 0) {
    errors.finalAmount = "Total payroll tidak boleh negatif";
  }
  return errors;
};

export const getPayrollReferenceData = async () => ({
  completedWorkLogs: await getCompletedProductionWorkLogs().catch(() => []),
  employees: await getActiveProductionEmployees().catch(() => []),
  productionSteps: await getActiveProductionSteps().catch(() => []),
});

export const buildPayrollDraftFromWorkLog = (workLog = {}, employee = null, productionStep = null) => {
  const payrollMode = workLog.stepPayrollMode || workLog.payrollMode || productionStep?.payrollMode || "per_qty";
  const payrollRate = toFiniteNumber(workLog.stepPayrollRate ?? workLog.payrollRate ?? productionStep?.payrollRate ?? 0);
  const payrollQtyBase = Math.max(1, toFiniteNumber(
    workLog.stepPayrollQtyBase ?? workLog.payrollQtyBase ?? productionStep?.payrollQtyBase ?? 1,
  ));
  const payrollOutputBasis = workLog.stepPayrollOutputBasis
    || workLog.payrollOutputBasis
    || productionStep?.payrollOutputBasis
    || "good_qty";
  const outputQtyUsed = toFiniteNumber(
    payrollOutputBasis === "actual_output_qty"
      ? workLog.actualOutputQty || workLog.goodQty || 0
      : workLog.goodQty || workLog.actualOutputQty || 0,
  );
  const workedQty = toFiniteNumber(workLog.plannedQty || outputQtyUsed || 1);
  const totals = calculatePayrollAmounts({
    payrollMode,
    payrollRate,
    payrollQtyBase,
    outputQtyUsed,
    workedQty,
  });

  return {
    workLogId: workLog.id || "",
    workNumber: workLog.workNumber || workLog.code || "",
    payrollDate: new Date().toISOString(),
    targetType: workLog.targetType || "",
    targetId: workLog.targetId || "",
    targetCode: workLog.targetCode || "",
    targetName: workLog.targetName || "",
    stepId: workLog.stepId || productionStep?.id || "",
    stepCode: workLog.stepCode || productionStep?.code || "",
    stepName: workLog.stepName || productionStep?.name || "",
    workerId: employee?.id || "",
    workerCode: employee?.code || employee?.employeeCode || "",
    workerName: employee?.name || "",
    payrollMode,
    payrollRate,
    payrollQtyBase,
    payrollOutputBasis,
    payrollClassification: workLog.stepPayrollClassification
      || productionStep?.payrollClassification
      || "direct_labor",
    payrollRuleSource: workLog.stepPayrollRuleSource || "work_log_step_snapshot",
    outputQtyUsed,
    workedQty,
    amountCalculated: totals.amountCalculated,
    finalAmount: totals.finalAmount,
    status: "draft",
    paymentStatus: "unpaid",
    includePayrollInHpp: typeof workLog.stepPayrollIncludeInHpp === "boolean"
      ? workLog.stepPayrollIncludeInHpp
      : productionStep?.includePayrollInHpp !== false,
  };
};

export const generatePayrollLinesFromCompletedWorkLog = async (workLogId) =>
  commitProductionPayrollGeneration(workLogId);

export const getAllProductionPayrolls = async () => listProductionRecords("payrolls");

export const getProductionPayrollsByDateRange = async ({ startDate, endDateExclusive } = {}) => {
  const start = startDate ? new Date(startDate).getTime() : null;
  const end = endDateExclusive ? new Date(endDateExclusive).getTime() : null;

  return (await getAllProductionPayrolls()).filter((row) => {
    const time = new Date(row.payrollDate || row.date || row.createdAt || 0).getTime();
    if (start && time < start) return false;
    if (end && time >= end) return false;
    return true;
  });
};

export const getProductionPayrollById = async (id) => getProductionRecordById("payrolls", id);
export const generateProductionPayrollNumber = async () => generateProductionCode("payrolls");

export const isPayrollNumberExists = async (payrollNumber, excludeId = null) => {
  const normalized = safeTrim(payrollNumber).toUpperCase();
  const rows = await getAllProductionPayrolls();

  return rows.some(
    (row) => safeTrim(row.payrollNumber || row.code).toUpperCase() === normalized
      && String(row.id) !== String(excludeId || "")
  );
};

const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const totals = calculatePayrollAmounts(values);
  const code = safeTrim(values.payrollNumber || values.code || values.referenceNumber).toUpperCase();
  const actorName = getProductionActorName(currentUser);

  return {
    ...values,
    code,
    payrollNumber: code,
    referenceNumber: code,
    name: values.name || values.workerName || code,
    amountCalculated: totals.amountCalculated,
    finalAmount: totals.finalAmount,
    totalAmount: totals.finalAmount,
    status: values.status || "draft",
    paymentStatus: values.paymentStatus || "unpaid",
    transactionDate: values.payrollDate || values.date || getCurrentIsoTimestamp(),
    updatedAt: getCurrentIsoTimestamp(),
    updatedBy: actorName,
    ...(!isEdit ? { createdAt: getCurrentIsoTimestamp(), createdBy: actorName } : {}),
  };
};

export const createProductionPayroll = async (values, currentUser = null) => createProductionRecord(
  "payrolls",
  normalizePayload(values, currentUser, false)
);

export const updateProductionPayroll = async (id, values, currentUser = null) => updateProductionRecord(
  "payrolls",
  id,
  normalizePayload(values, currentUser, true)
);

export const updatePayrollStatus = async (
  id,
  statusOrPayload,
  paymentStatusOrUser = null,
  optionsOrUser = null,
) => {
  const current = await getProductionPayrollById(id);
  const nextValues = typeof statusOrPayload === "string"
    ? { status: statusOrPayload }
    : { ...(statusOrPayload || {}) };

  if (typeof paymentStatusOrUser === "string") {
    nextValues.paymentStatus = paymentStatusOrUser;
  }
  if (optionsOrUser && typeof optionsOrUser === "object") {
    Object.assign(nextValues, optionsOrUser);
  }

  const next = { ...current, ...nextValues };
  const normalizedStatus = String(next.status || "").toLowerCase();
  const normalizedPaymentStatus = String(next.paymentStatus || "").toLowerCase();

  if (normalizedStatus === "paid" || normalizedPaymentStatus === "paid") {
    const result = await commitProductionPayrollPaid(id, next);
    return {
      ...(result?.payroll || result || {}),
      expenseSyncStatus: result?.expenseSyncStatus || result?.payroll?.expenseSyncStatus || "",
      financeResult: result?.financeResult || result?.payroll?.financeResult || null,
    };
  }

  if (normalizedStatus === "confirmed") {
    const result = await commitProductionPayrollFinalize(id, next);
    return result?.payroll || result;
  }

  return updateProductionPayroll(id, next, null);
};
