import * as sqliteFinanceAdapter from "../../data/adapters/sqlite/sqliteFinanceAdapter";

export const listenCashInRecords = (onNext, onError) => (
  sqliteFinanceAdapter.subscribeIncomes(
    (rows) => onNext(rows.sort((left, right) => right.date.toDate().getTime() - left.date.toDate().getTime())),
    onError,
    { limit: 1000 },
  )
);

export const listenCashOutRecords = (onNext, onError) => (
  sqliteFinanceAdapter.subscribeExpenses(
    (rows) => onNext(rows.sort((left, right) => right.date.toDate().getTime() - left.date.toDate().getTime())),
    onError,
    { limit: 1000 },
  )
);

export const createCashInTransaction = async (values = {}) => {
  const transactionDate = values.date?.toDate ? values.date.toDate() : new Date(values.date || Date.now());
  return sqliteFinanceAdapter.commitCashIn({
    amount: Math.round(Number(values.amount || 0)),
    description: values.description || "",
    type: values.type || "Pendapatan Lain-lain",
    transactionDate: transactionDate.toISOString(),
    date: transactionDate.toISOString(),
    sourceModule: "cash_in_manual",
    status: "Tercatat",
  });
};

export const createCashOutTransaction = async (values = {}) => {
  const transactionDate = values.date?.toDate ? values.date.toDate() : new Date(values.date || Date.now());
  return sqliteFinanceAdapter.commitCashOut({
    amount: Math.round(Number(values.amount || 0)),
    description: values.description || "",
    type: values.type || "Biaya Lain-lain",
    transactionDate: transactionDate.toISOString(),
    date: transactionDate.toISOString(),
    sourceModule: "cash_out_manual",
    status: "Tercatat",
  });
};

export const deleteCashOutTransaction = (id) => sqliteFinanceAdapter.deleteCashOut(id);
export const listFinanceLedgerRows = (options = {}) => sqliteFinanceAdapter.listLedger(options);
export const listFinanceIncomes = (options = {}) => sqliteFinanceAdapter.listIncomes(options);
export const listFinanceExpenses = (options = {}) => sqliteFinanceAdapter.listExpenses(options);
