import { requestSqliteApi } from "./sqliteApiClient";
import { createSqliteJsonRecordAdapter } from "./sqliteJsonRecordAdapterFactory";
import { toRoundedInteger } from "../../../utils/number/numberNormalization";

const makeDateValue = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return {
    raw: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
    toDate: () => (Number.isNaN(date.getTime()) ? new Date() : date),
  };
};

export const normalizeFinanceRecord = (record = {}, sourceCollection = record.sourceCollection || "") => {
  const amount = toRoundedInteger(record.amount ?? record.totalAmount ?? record.total);
  const dateValue = record.date || record.transactionDate || record.createdAt || new Date().toISOString();
  return {
    ...record,
    id: record.id || record.code || record.referenceNumber || "",
    sourceCollection,
    code: record.code || record.referenceNumber || record.cashInNumber || record.cashOutNumber || "",
    cashInNumber: record.cashInNumber || (sourceCollection === "incomes" ? record.referenceNumber || record.code || "" : record.cashInNumber),
    cashOutNumber: record.cashOutNumber || (sourceCollection === "expenses" ? record.referenceNumber || record.code || "" : record.cashOutNumber),
    referenceNumber: record.referenceNumber || record.code || "",
    sourceRef: record.sourceRef || record.referenceNumber || record.code || "",
    amount,
    totalAmount: amount,
    description: record.description || record.name || record.notes || "",
    type: record.type || (sourceCollection === "expenses" ? "Biaya Lain-lain" : "Pendapatan Lain-lain"),
    date: makeDateValue(dateValue),
    transactionDate: dateValue,
    status: record.status || "Tercatat",
  };
};

const incomesAdapter = createSqliteJsonRecordAdapter({
  endpoint: "/api/finance/incomes",
  normalizeRecord: (record) => normalizeFinanceRecord(record, "incomes"),
});
const expensesAdapter = createSqliteJsonRecordAdapter({
  endpoint: "/api/finance/expenses",
  normalizeRecord: (record) => normalizeFinanceRecord(record, "expenses"),
});
const ledgerAdapter = createSqliteJsonRecordAdapter({
  endpoint: "/api/finance/ledger",
  normalizeRecord: (record) => normalizeFinanceRecord(record, "money_movement_ledger"),
});

export const listIncomes = incomesAdapter.list;
export const listExpenses = expensesAdapter.list;
export const listLedger = ledgerAdapter.list;
export const subscribeIncomes = incomesAdapter.subscribe;
export const subscribeExpenses = expensesAdapter.subscribe;
export const subscribeLedger = ledgerAdapter.subscribe;

export const commitCashIn = async (payload = {}) => {
  const result = await requestSqliteApi("/api/finance/cash-in/commit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result?.data?.movement ? normalizeFinanceRecord(result.data.movement, "incomes") : result?.data;
};

export const commitCashOut = async (payload = {}) => {
  const result = await requestSqliteApi("/api/finance/cash-out/commit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result?.data?.movement ? normalizeFinanceRecord(result.data.movement, "expenses") : result?.data;
};

export const deleteCashOut = async (id) => {
  const result = await requestSqliteApi(`/api/finance/cash-out/${encodeURIComponent(id)}`, { method: "DELETE" });
  return result?.data || { id, deleted: true };
};
