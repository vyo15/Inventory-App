import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cashInSource = fs.readFileSync(path.resolve("src/pages/Finance/CashIn.jsx"), "utf8");
const cashOutSource = fs.readFileSync(path.resolve("src/pages/Finance/CashOut.jsx"), "utf8");

describe("Cash page contracts", () => {
  it("Cash In dan Cash Out memakai field form Rupiah bersama tanpa memindahkan service mutation", () => {
    expect(cashInSource).toContain('import CashTransactionFormFields from "./components/CashTransactionFormFields"');
    expect(cashOutSource).toContain('import CashTransactionFormFields from "./components/CashTransactionFormFields"');
    expect(cashInSource).toContain("createCashInTransaction");
    expect(cashOutSource).toContain("createCashOutTransaction");
  });

  it("Cash Out mempertahankan guard transaksi otomatis sebelum action hapus", () => {
    expect(cashOutSource).toContain("sourceModule");
    expect(cashOutSource).toContain("renderCashOutActions");
    expect(cashOutSource).toContain("deleteCashOutTransaction");
  });
});
