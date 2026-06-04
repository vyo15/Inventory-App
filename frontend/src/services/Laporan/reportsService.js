import * as sqliteTransactionsAdapter from "../../data/adapters/sqlite/sqliteTransactionsAdapter";
import { listFinanceExpenses, listFinanceIncomes } from "../Finance/financeService";

const getDateMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const getBoundsMillis = (dateRangeBounds = null) => {
  if (!dateRangeBounds) return null;
  const start = getDateMillis(dateRangeBounds.startTimestamp || dateRangeBounds.startDate || dateRangeBounds.start);
  const end = getDateMillis(dateRangeBounds.endTimestampExclusive || dateRangeBounds.endDateExclusive || dateRangeBounds.end);
  if (!start || !end) return null;
  return { start, end };
};

const filterByDateRange = (rows = [], dateRangeBounds = null) => {
  const bounds = getBoundsMillis(dateRangeBounds);
  if (!bounds) return rows;
  return rows.filter((item) => {
    const time = getDateMillis(item.date || item.transactionDate || item.createdAt);
    return time >= bounds.start && time < bounds.end;
  });
};

const sortByDateDesc = (rows = []) => rows.sort((left, right) =>
  getDateMillis(right.date || right.transactionDate || right.createdAt) - getDateMillis(left.date || left.transactionDate || left.createdAt),
);

export const fetchSalesReportData = async ({ dateRangeBounds = null } = {}) => {
  const rows = await sqliteTransactionsAdapter.listSales({ limit: 5000 });
  return sortByDateDesc(filterByDateRange(rows, dateRangeBounds));
};

export const fetchPurchasesReportData = async ({ dateRangeBounds = null } = {}) => {
  const rows = await sqliteTransactionsAdapter.listPurchases({ limit: 5000 });
  return sortByDateDesc(filterByDateRange(rows, dateRangeBounds));
};

export const fetchProfitLossReportData = async ({ dateRangeBounds = null } = {}) => {
  const [incomes, expenses] = await Promise.all([
    listFinanceIncomes({ limit: 5000 }),
    listFinanceExpenses({ limit: 5000 }),
  ]);

  const incomeRows = incomes.map((item) => ({
    ...item,
    id: `incomes-${item.id}`,
    sourceCollection: "incomes",
    flow: "Pemasukan",
  }));
  const expenseRows = expenses.map((item) => ({
    ...item,
    id: `expenses-${item.id}`,
    sourceCollection: "expenses",
    flow: "Pengeluaran",
  }));

  return sortByDateDesc(filterByDateRange([...incomeRows, ...expenseRows], dateRangeBounds));
};
