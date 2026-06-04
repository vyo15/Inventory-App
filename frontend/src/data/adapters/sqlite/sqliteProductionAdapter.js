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
  const amount = Math.round(Number(payload.finalAmount ?? payload.amount ?? payload.totalAmount ?? 0));
  if (amount <= 0) return null;
  const result = await requestSqliteApi("/api/finance/cash-out/commit", {
    method: "POST",
    body: JSON.stringify({
      id: `production_payroll_expense_${payload.id || payload.payrollNumber || Date.now()}`,
      referenceNumber: `CSH-OUT-${payload.payrollNumber || payload.referenceNumber || payload.id || Date.now()}`,
      type: "Payroll Produksi",
      amount,
      totalAmount: amount,
      transactionDate: payload.paidAt || payload.payrollDate || payload.date || new Date().toISOString(),
      sourceModule: "production_payrolls",
      sourceType: "auto_production_payroll",
      sourceId: payload.id || payload.payrollNumber || "",
      sourceRef: payload.payrollNumber || payload.referenceNumber || payload.id || "",
      relatedPayrollId: payload.id || "",
      status: "Tercatat",
      description: `Payroll produksi ${payload.payrollNumber || payload.referenceNumber || payload.id || ""}`.trim(),
    }),
  });
  return result?.data || null;
};
