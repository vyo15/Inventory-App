import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cashInSource = fs.readFileSync(path.resolve("src/pages/Finance/CashIn.jsx"), "utf8");
const cashOutSource = fs.readFileSync(path.resolve("src/pages/Finance/CashOut.jsx"), "utf8");
const shellSource = fs.readFileSync(
  path.resolve("src/pages/Finance/components/CashFlowPageShell.jsx"),
  "utf8",
);

describe("Cash page contracts", () => {
  it("Cash In dan Cash Out memakai shell presentasi bersama tanpa memindahkan mutation", () => {
    expect(cashInSource).toContain('import CashFlowPageShell from "./components/CashFlowPageShell"');
    expect(cashOutSource).toContain('import CashFlowPageShell from "./components/CashFlowPageShell"');
    expect(shellSource).toContain("CashTransactionFormFields");
    expect(cashInSource).toContain("createCashInTransaction");
    expect(cashOutSource).toContain("createCashOutTransaction");
    expect(shellSource).not.toContain("createCashInTransaction");
    expect(shellSource).not.toContain("createCashOutTransaction");
  });

  it("Cash Out mempertahankan guard transaksi otomatis sebelum action hapus", () => {
    expect(cashOutSource).toContain("sourceModule");
    expect(cashOutSource).toContain("renderCashOutActions");
    expect(cashOutSource).toContain("deleteCashOutTransaction");
    expect(shellSource).not.toContain("deleteCashOutTransaction");
  });
});
