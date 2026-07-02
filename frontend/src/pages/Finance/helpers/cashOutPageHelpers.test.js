import { describe, expect, it } from "vitest";
import { getSavingMeta, resolveExpenseSourceMeta } from "./cashOutPageHelpers";

describe("cashOutPageHelpers", () => {
  it("menjaga expense otomatis tidak dapat dihapus dari halaman manual", () => {
    expect(resolveExpenseSourceMeta({ sourceModule: "purchases" })).toMatchObject({
      label: "Pembelian",
      deletable: false,
    });
    expect(resolveExpenseSourceMeta({ sourceModule: "production_payroll" })).toMatchObject({
      label: "Payroll Produksi",
      deletable: false,
    });
    expect(resolveExpenseSourceMeta({ sourceModule: "cash_out_manual" })).toMatchObject({
      label: "Manual",
      deletable: true,
    });
  });

  it("mempertahankan meta saving positif, negatif, dan netral", () => {
    expect(getSavingMeta(10_000)).toMatchObject({ status: "hemat", color: "green" });
    expect(getSavingMeta(-5_000)).toMatchObject({ status: "lebih_mahal", color: "red" });
    expect(getSavingMeta(0)).toEqual({
      status: "normal",
      label: "Sesuai Referensi",
      color: "default",
    });
  });
});
