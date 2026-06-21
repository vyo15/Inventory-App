import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commitCashIn: vi.fn(),
  commitCashOut: vi.fn(),
  deleteCashOut: vi.fn(),
  getRepositoryModeStatus: vi.fn(),
  isSqliteRepositoryModuleEnabled: vi.fn(),
  listExpenses: vi.fn(),
  listIncomes: vi.fn(),
  listLedger: vi.fn(),
}));

vi.mock("../../data/repositories/repositoryModeService", () => ({
  getRepositoryModeStatus: mocks.getRepositoryModeStatus,
  isSqliteRepositoryModuleEnabled: mocks.isSqliteRepositoryModuleEnabled,
}));

vi.mock("../../data/adapters/sqlite/sqliteFinanceAdapter", () => ({
  commitCashIn: mocks.commitCashIn,
  commitCashOut: mocks.commitCashOut,
  deleteCashOut: mocks.deleteCashOut,
  listExpenses: mocks.listExpenses,
  listIncomes: mocks.listIncomes,
  listLedger: mocks.listLedger,
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
  mocks.getRepositoryModeStatus.mockResolvedValue({ isSqliteSidecar: true });
  mocks.isSqliteRepositoryModuleEnabled.mockReturnValue(true);
});

describe("financeService", () => {
  it("listener cash-in membaca SQLite, mengurutkan tanggal terbaru, dan membersihkan timer", async () => {
    const older = { id: "old", date: { toDate: () => new Date("2026-06-20T10:00:00Z") } };
    const newer = { id: "new", date: { toDate: () => new Date("2026-06-21T10:00:00Z") } };
    mocks.listIncomes.mockResolvedValue([older, newer]);
    const onNext = vi.fn();
    const onError = vi.fn();
    const setIntervalSpy = vi.spyOn(window, "setInterval").mockReturnValue(77);
    const clearIntervalSpy = vi.spyOn(window, "clearInterval").mockImplementation(() => {});

    const unsubscribe = listenCashInRecords(onNext, onError);
    await vi.waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));

    expect(onNext).toHaveBeenCalledWith([newer, older]);
    expect(onError).not.toHaveBeenCalled();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 15000);

    unsubscribe();
    expect(clearIntervalSpy).toHaveBeenCalledWith(77);
  });

  it("listener melaporkan konfigurasi finance nonaktif tanpa membuat polling", async () => {
    mocks.getRepositoryModeStatus.mockResolvedValue({ isSqliteSidecar: false });
    const onNext = vi.fn();
    const onError = vi.fn();
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const unsubscribe = listenCashOutRecords(onNext, onError);
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    expect(onNext).not.toHaveBeenCalled();
    expect(onError.mock.calls[0][0].message).toContain("Mode finance belum aktif");
    expect(setIntervalSpy).not.toHaveBeenCalled();
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
