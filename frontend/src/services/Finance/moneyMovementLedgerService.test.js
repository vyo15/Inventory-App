import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listFinanceLedgerRows: vi.fn(),
}));

vi.mock("./financeService", () => ({
  listFinanceLedgerRows: mocks.listFinanceLedgerRows,
}));

import {
  getMoneyMovementLedger,
  MONEY_MOVEMENT_LEDGER_DEFAULT_LIMIT,
  normalizeMoneyMovementLedgerRow,
} from "./moneyMovementLedgerService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("moneyMovementLedgerService", () => {
  it("menormalisasi sumber, arah, nominal, dan referensi manusiawi", () => {
    expect(normalizeMoneyMovementLedgerRow({
      documentId: "ledger-1",
      record: {
        credit: 1250.6,
        sourceModule: "production_payroll",
        payrollNumber: "PAY-202606-001",
        notes: "Upah produksi",
        status: "posted",
        date: "2026-06-21T10:00:00.000Z",
      },
    })).toEqual(expect.objectContaining({
      id: "money_movement_ledger-ledger-1",
      direction: "out",
      sourceModule: "production_payroll",
      sourceLabel: "Payroll Produksi",
      referenceCode: "PAY-202606-001",
      description: "Upah produksi",
      amount: 1251,
      status: "posted",
    }));
  });

  it("memfilter periode, arah, sumber, pencarian, lalu mengurutkan terbaru", async () => {
    mocks.listFinanceLedgerRows.mockResolvedValue([
      {
        id: "older",
        amount: 1000,
        direction: "in",
        sourceModule: "cash_in_manual",
        sourceRef: "CSH-IN-001",
        description: "Modal Juni",
        date: "2026-06-01T08:00:00.000Z",
      },
      {
        id: "newer",
        amount: 2000,
        direction: "in",
        sourceModule: "cash_in_manual",
        sourceRef: "CSH-IN-002",
        description: "Modal tambahan",
        date: "2026-06-20T08:00:00.000Z",
      },
      {
        id: "outside-period",
        amount: 3000,
        direction: "in",
        sourceModule: "cash_in_manual",
        sourceRef: "CSH-IN-003",
        description: "Modal Mei",
        date: "2026-05-20T08:00:00.000Z",
      },
      {
        id: "wrong-direction",
        amount: 4000,
        direction: "out",
        sourceModule: "cash_out_manual",
        sourceRef: "CSH-OUT-001",
        description: "Biaya",
        date: "2026-06-21T08:00:00.000Z",
      },
    ]);

    const rows = await getMoneyMovementLedger({
      year: 2026,
      month: 5,
      direction: "in",
      source: "cash_in_manual",
      search: "modal",
      limit: 2,
    });

    expect(mocks.listFinanceLedgerRows).toHaveBeenCalledWith({
      limit: MONEY_MOVEMENT_LEDGER_DEFAULT_LIMIT,
    });
    expect(rows.map((row) => row.referenceCode)).toEqual(["CSH-IN-002", "CSH-IN-001"]);
  });

  it("menggunakan fallback aman untuk tahun invalid dan limit minimum", async () => {
    mocks.listFinanceLedgerRows.mockResolvedValue([
      {
        id: "row-1",
        debit: 75,
        sourceModule: "unknown_source",
        code: "LED-001",
        date: { toDate: () => new Date("2026-06-21T00:00:00.000Z") },
      },
    ]);

    await expect(getMoneyMovementLedger({ year: "invalid", limit: 0 })).resolves.toEqual([
      expect.objectContaining({
        direction: "in",
        sourceModule: "unknown_source",
        sourceLabel: "unknown_source",
        referenceCode: "LED-001",
        amount: 75,
      }),
    ]);
  });
});
