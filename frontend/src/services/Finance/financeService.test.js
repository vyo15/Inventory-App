import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commitCashIn: vi.fn(),
  commitCashOut: vi.fn(),
  deleteCashOut: vi.fn(),
  subscribeExpenses: vi.fn(),
  subscribeIncomes: vi.fn(),
  listExpenses: vi.fn(),
  listIncomes: vi.fn(),
  listLedger: vi.fn(),
}));

vi.mock("../../data/adapters/sqlite/sqliteFinanceAdapter", () => ({
  commitCashIn: mocks.commitCashIn,
  commitCashOut: mocks.commitCashOut,
  deleteCashOut: mocks.deleteCashOut,
  listExpenses: mocks.listExpenses,
  listIncomes: mocks.listIncomes,
  listLedger: mocks.listLedger,
  subscribeExpenses: mocks.subscribeExpenses,
  subscribeIncomes: mocks.subscribeIncomes,
}));

import {
  createCashInTransaction,
  createCashOutTransaction,
  deleteCashOutTransaction,
  listFinanceExpenses,
  listFinanceIncomes,
  listFinanceLedgerRows,
  listenCashInRecords,
  listenCashOutRecords,
} from "./financeService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("financeService", () => {
  it("listener cash-in memakai subscription SQLite dan mengurutkan tanggal terbaru", () => {
    const older = { id: "old", date: { toDate: () => new Date("2026-06-20T10:00:00Z") } };
    const newer = { id: "new", date: { toDate: () => new Date("2026-06-21T10:00:00Z") } };
    const unsubscribeAdapter = vi.fn();
    mocks.subscribeIncomes.mockImplementation((onNext) => {
      onNext([older, newer]);
      return unsubscribeAdapter;
    });
    const onNext = vi.fn();
    const onError = vi.fn();

    const unsubscribe = listenCashInRecords(onNext, onError);

    expect(onNext).toHaveBeenCalledWith([newer, older]);
    expect(onError).not.toHaveBeenCalled();
    expect(mocks.subscribeIncomes).toHaveBeenCalledWith(expect.any(Function), onError, { limit: 1000 });
    unsubscribe();
    expect(unsubscribeAdapter).toHaveBeenCalledTimes(1);
  });

  it("listener cash-out meneruskan error subscription SQLite", () => {
    const subscribeError = new Error("Layanan finance belum tersedia");
    mocks.subscribeExpenses.mockImplementation((_onNext, onError) => {
      onError(subscribeError);
      return vi.fn();
    });
    const onNext = vi.fn();
    const onError = vi.fn();

    const unsubscribe = listenCashOutRecords(onNext, onError);

    expect(onNext).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(subscribeError);
    expect(mocks.subscribeExpenses).toHaveBeenCalledWith(expect.any(Function), onError, { limit: 1000 });
    unsubscribe();
  });

  it("cash-in dan cash-out menormalisasi nominal, tanggal, serta source module", async () => {
    mocks.commitCashIn.mockResolvedValue({ id: "income-1" });
    mocks.commitCashOut.mockResolvedValue({ id: "expense-1" });
    const date = { toDate: () => new Date("2026-06-21T12:30:00.000Z") };

    await expect(createCashInTransaction({
      amount: 1250.6,
      description: "Pendapatan toko",
      type: "Penjualan Lain",
      date,
    })).resolves.toEqual({ id: "income-1" });
    expect(mocks.commitCashIn).toHaveBeenCalledWith(expect.objectContaining({
      amount: 1251,
      transactionDate: "2026-06-21T12:30:00.000Z",
      sourceModule: "cash_in_manual",
      status: "Tercatat",
    }));

    await expect(createCashOutTransaction({
      amount: "2000.4",
      description: "Biaya toko",
      date,
    })).resolves.toEqual({ id: "expense-1" });
    expect(mocks.commitCashOut).toHaveBeenCalledWith(expect.objectContaining({
      amount: 2000,
      type: "Biaya Lain-lain",
      sourceModule: "cash_out_manual",
    }));
  });

  it("wrapper list dan delete tidak mengubah opsi atau ID", async () => {
    const options = { limit: 25, status: "active" };
    mocks.listLedger.mockResolvedValue(["ledger"]);
    mocks.listIncomes.mockResolvedValue(["income"]);
    mocks.listExpenses.mockResolvedValue(["expense"]);
    mocks.deleteCashOut.mockResolvedValue({ deleted: true });

    await expect(listFinanceLedgerRows(options)).resolves.toEqual(["ledger"]);
    await expect(listFinanceIncomes(options)).resolves.toEqual(["income"]);
    await expect(listFinanceExpenses(options)).resolves.toEqual(["expense"]);
    await expect(deleteCashOutTransaction("expense-1")).resolves.toEqual({ deleted: true });

    expect(mocks.listLedger).toHaveBeenCalledWith(options);
    expect(mocks.listIncomes).toHaveBeenCalledWith(options);
    expect(mocks.listExpenses).toHaveBeenCalledWith(options);
    expect(mocks.deleteCashOut).toHaveBeenCalledWith("expense-1");
  });
});
