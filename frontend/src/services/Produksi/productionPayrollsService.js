import { calculatePayrollAmounts } from "../../constants/productionPayrollOptions";
import { commitProductionPayrollPaidExpense, createProductionRecord, generateProductionCode, getProductionRecordById, listProductionRecords, updateProductionRecord } from "../../data/adapters/sqlite/sqliteProductionAdapter";
import { getActiveProductionEmployees } from "./productionEmployeesService";
import { getActiveProductionSteps } from "./productionStepsService";
import { getCompletedProductionWorkLogs, getProductionWorkLogById } from "./productionWorkLogsService";

const safeTrim = (value) => String(value || "").trim();
const nowIso = () => new Date().toISOString();
const toNumber = (value) => Number(value || 0);

export const validateProductionPayroll = (values = {}) => {
  const errors = {};
  if (!values.payrollDate) errors.payrollDate = "Tanggal payroll wajib diisi";
  if (!values.workLogId) errors.workLogId = "Work log wajib dipilih";
  if (!values.workerName && !values.workerId) errors.workerId = "Karyawan wajib dipilih";
  if (toNumber(values.finalAmount || 0) < 0) errors.finalAmount = "Total payroll tidak boleh negatif";
  return errors;
};
export const getPayrollReferenceData = async () => ({
  completedWorkLogs: await getCompletedProductionWorkLogs().catch(() => []),
  employees: await getActiveProductionEmployees().catch(() => []),
  productionSteps: await getActiveProductionSteps().catch(() => []),
});
export const buildPayrollDraftFromWorkLog = (workLog = {}, employee = null, productionStep = null) => {
  const payrollMode = productionStep?.payrollMode || workLog.payrollMode || "per_qty";
  const payrollRate = toNumber(productionStep?.payrollRate ?? workLog.payrollRate ?? 0);
  const outputQtyUsed = toNumber(workLog.goodQty || workLog.actualOutputQty || 0);
  const workedQty = toNumber(workLog.plannedQty || outputQtyUsed || 1);
  const totals = calculatePayrollAmounts({ payrollMode, payrollRate, payrollQtyBase: 1, outputQtyUsed, workedQty });
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
    payrollQtyBase: 1,
    outputQtyUsed,
    workedQty,
    amountCalculated: totals.amountCalculated,
    finalAmount: totals.finalAmount,
    status: "draft",
    paymentStatus: "unpaid",
    includePayrollInHpp: productionStep?.includePayrollInHpp !== false,
  };
};
export const generatePayrollLinesFromCompletedWorkLog = async (workLogId, currentUser = null) => {
  const workLog = await getProductionWorkLogById(workLogId);
  const refs = await getPayrollReferenceData();
  const workers = (Array.isArray(workLog.workerIds) && workLog.workerIds.length > 0)
    ? refs.employees.filter((employee) => workLog.workerIds.includes(employee.id))
    : refs.employees.slice(0, 1);
  const step = refs.productionSteps.find((item) => item.id === workLog.stepId) || null;
  const created = [];
  for (const employee of workers) {
    const draft = buildPayrollDraftFromWorkLog(workLog, employee, step);
    draft.payrollNumber = await generateProductionPayrollNumber(draft);
    created.push(await createProductionPayroll(draft, currentUser));
  }
  return created;
};
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
  return (await getAllProductionPayrolls()).some((row) => safeTrim(row.payrollNumber || row.code).toUpperCase() === normalized && String(row.id) !== String(excludeId || ""));
};
const normalizePayload = (values = {}, currentUser = null, isEdit = false) => {
  const totals = calculatePayrollAmounts(values);
  const code = safeTrim(values.payrollNumber || values.code || values.referenceNumber).toUpperCase();
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
    transactionDate: values.payrollDate || values.date || nowIso(),
    updatedAt: nowIso(),
    updatedBy: currentUser?.email || currentUser?.displayName || currentUser?.username || currentUser?.uid || "system",
    ...(!isEdit ? { createdAt: nowIso(), createdBy: currentUser?.email || currentUser?.displayName || currentUser?.username || currentUser?.uid || "system" } : {}),
  };
};
export const createProductionPayroll = async (values, currentUser = null) => createProductionRecord("payrolls", normalizePayload(values, currentUser, false));
export const updateProductionPayroll = async (id, values, currentUser = null) => updateProductionRecord("payrolls", id, normalizePayload(values, currentUser, true));
export const updatePayrollStatus = async (id, statusOrPayload, currentUser = null) => {
  const current = await getProductionPayrollById(id);
  const nextValues = typeof statusOrPayload === "string" ? { status: statusOrPayload } : { ...(statusOrPayload || {}) };
  const next = { ...current, ...nextValues };
  if (["paid", "confirmed"].includes(String(next.status || "").toLowerCase()) || String(next.paymentStatus || "").toLowerCase() === "paid") {
    next.status = next.status || "paid";
    next.paymentStatus = "paid";
    next.paidAt = next.paidAt || nowIso();
    next.financeResult = await commitProductionPayrollPaidExpense({ ...next, id });
  }
  return updateProductionPayroll(id, next, currentUser);
};
