import { createSqliteJsonRecordAdapter } from "./sqliteJsonRecordAdapterFactory";
import { requestSqliteApi } from "./sqliteApiClient";

const normalizeDateLike = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return {
    raw: date.toISOString(),
    toDate: () => date,
  };
};

const normalizeProductionRecord = (record = {}) => ({
  ...record,
  id: record.id || record.code || record.referenceNumber || "",
  code: record.code || record.referenceNumber || record.workNumber || record.payrollNumber || "",
  referenceNumber: record.referenceNumber || record.code || record.workNumber || record.payrollNumber || "",
  isActive: record.isActive !== false,
  createdAt: normalizeDateLike(record.createdAt),
  updatedAt: normalizeDateLike(record.updatedAt),
});

const makeAdapter = (endpoint) => createSqliteJsonRecordAdapter({
  endpoint,
  normalizeRecord: normalizeProductionRecord,
});

const steps = makeAdapter("/api/production/steps");
const employees = makeAdapter("/api/production/employees");
const profiles = makeAdapter("/api/production/profiles");
const boms = makeAdapter("/api/production/boms");
const planning = makeAdapter("/api/production/planning");
const orders = makeAdapter("/api/production/orders");
const workLogs = makeAdapter("/api/production/work-logs");
const payrolls = makeAdapter("/api/production/payrolls");


const unwrapData = (result = {}) => result?.data ?? result ?? null;

export const commitProductionOrder = async (payload = {}) => unwrapData(await requestSqliteApi("/api/production/orders/commit", {
  method: "POST",
  body: JSON.stringify(payload),
}));

export const commitProductionOrderFromPlan = async (planId, payload = {}) => unwrapData(await requestSqliteApi(
  `/api/production/planning/${encodeURIComponent(planId)}/create-order`,
  { method: "POST", body: JSON.stringify(payload) },
));

export const commitProductionPlanCancel = async (planId) => unwrapData(await requestSqliteApi(
  `/api/production/planning/${encodeURIComponent(planId)}/cancel`,
  { method: "POST", body: JSON.stringify({}) },
));

export const commitProductionOrderRequirementRefresh = async (orderId) => unwrapData(await requestSqliteApi(
  `/api/production/orders/${encodeURIComponent(orderId)}/refresh-requirements`,
  { method: "POST", body: JSON.stringify({}) },
));

export const commitProductionOrderStart = async (orderId, payload = {}) => unwrapData(await requestSqliteApi(
  `/api/production/orders/${encodeURIComponent(orderId)}/start`,
  { method: "POST", body: JSON.stringify(payload) },
));

export const commitProductionWorkLogComplete = async (workLogId, payload = {}) => unwrapData(await requestSqliteApi(
  `/api/production/work-logs/${encodeURIComponent(workLogId)}/complete`,
  { method: "POST", body: JSON.stringify(payload) },
));

export const commitProductionPayrollGeneration = async (workLogId) => unwrapData(await requestSqliteApi(
  `/api/production/work-logs/${encodeURIComponent(workLogId)}/generate-payrolls`,
  { method: "POST", body: JSON.stringify({}) },
));

export const commitProductionPayrollFinalize = async (payrollId, payload = {}) => unwrapData(await requestSqliteApi(
  `/api/production/payrolls/${encodeURIComponent(payrollId)}/finalize`,
  { method: "POST", body: JSON.stringify(payload) },
));

export const commitProductionPayrollPaid = async (payrollId, payload = {}) => unwrapData(await requestSqliteApi(
  `/api/production/payrolls/${encodeURIComponent(payrollId)}/mark-paid`,
  { method: "POST", body: JSON.stringify(payload) },
));

export const productionAdapters = {
  steps,
  employees,
  profiles,
  boms,
  planning,
  orders,
  workLogs,
  payrolls,
};

export const listProductionRecords = (type, options = {}) => productionAdapters[type].list(options);
export const getProductionRecordById = (type, id) => productionAdapters[type].getById(id);
export const generateProductionCode = (type) => productionAdapters[type].generateCode();
export const createProductionRecord = (type, values = {}) => productionAdapters[type].create(values);
export const updateProductionRecord = (type, id, values = {}) => productionAdapters[type].update(id, values);
export const deleteProductionRecord = (type, id) => productionAdapters[type].remove(id);

export const commitProductionPayrollPaidExpense = async (payload = {}) => {
  const payrollId = payload.id || payload.payrollId || payload.payrollNumber || payload.referenceNumber;
  if (!payrollId) throw new Error("ID payroll produksi tidak valid.");
  return commitProductionPayrollPaid(payrollId, payload);
};
