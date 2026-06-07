import { getRepositoryModeStatus, isSqliteRepositoryModuleEnabled } from "../../data/repositories/repositoryModeService";
import * as sqliteFinanceAdapter from "../../data/adapters/sqlite/sqliteFinanceAdapter";

const shouldUseSqliteFinance = async () => {
  const status = await getRepositoryModeStatus();
  return status.isSqliteSidecar === true && isSqliteRepositoryModuleEnabled("VITE_FINANCE_REPOSITORY_MODE");
};

export const listenCashInRecords = (onNext, onError) => {
  let unsubscribe = () => {};
  let disposed = false;
  (async () => {
    try {
      if (!(await shouldUseSqliteFinance())) {
        throw new Error("Mode finance belum aktif. Pastikan layanan lokal berjalan dan konfigurasi finance sudah benar.");
      }
      const sync = async () => {
        const [incomes] = await Promise.all([sqliteFinanceAdapter.listIncomes({ limit: 1000 })]);
        if (!disposed) onNext(incomes.sort((left, right) => right.date.toDate().getTime() - left.date.toDate().getTime()));
      };
      await sync();
      const timer = window.setInterval(sync, 15000);
      unsubscribe = () => window.clearInterval(timer);
    } catch (error) {
      if (!disposed && typeof onError === "function") onError(error);
    }
  })();
  return () => { disposed = true; unsubscribe?.(); };
};

export const listenCashOutRecords = (onNext, onError) => {
  let unsubscribe = () => {};
  let disposed = false;
  (async () => {
    try {
      if (!(await shouldUseSqliteFinance())) {
        throw new Error("Mode finance belum aktif. Pastikan layanan lokal berjalan dan konfigurasi finance sudah benar.");
      }
      const sync = async () => {
        const expenses = await sqliteFinanceAdapter.listExpenses({ limit: 1000 });
        if (!disposed) onNext(expenses.sort((left, right) => right.date.toDate().getTime() - left.date.toDate().getTime()));
      };
      await sync();
      const timer = window.setInterval(sync, 15000);
      unsubscribe = () => window.clearInterval(timer);
    } catch (error) {
      if (!disposed && typeof onError === "function") onError(error);
    }
  })();
  return () => { disposed = true; unsubscribe?.(); };
};

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
