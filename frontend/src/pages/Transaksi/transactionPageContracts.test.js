import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("transaction page-service contracts", () => {
  it("Sales mengirim object values canonical ke salesService", () => {
    const source = fs.readFileSync(path.resolve("src/pages/Transaksi/Sales.jsx"), "utf8");
    expect(source).toMatch(/createSaleTransaction\(\{\s*values:\s*\{/);
    expect(source).toMatch(/saleItems,/);
  });

  it("Returns memakai Sales, returnableItems, dan selectedSale tanpa item master bebas", () => {
    const source = fs.readFileSync(path.resolve("src/pages/Transaksi/Returns.jsx"), "utf8");
    expect(source).toMatch(/name="relatedSaleId"/);
    expect(source).toMatch(/name="saleItemKey"/);
    expect(source).toMatch(/createReturnTransaction\(\{\s*values,\s*returnableItems,\s*selectedSale,/);
    expect(source).not.toMatch(/allItems/);
    expect(source).not.toMatch(/name="itemId"/);
  });
});
