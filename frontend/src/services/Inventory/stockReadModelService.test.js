import { describe, expect, it } from "vitest";
import { buildStockItemReadModelDocument } from "./stockReadModelService";

describe("buildStockItemReadModelDocument", () => {
  it("menetralkan angka legacy tidak valid agar read model tidak membawa NaN", () => {
    const row = buildStockItemReadModelDocument({
      id: "product-1",
      currentStock: "invalid",
      reservedStock: "invalid",
      availableStock: "invalid",
      minStockAlert: "invalid",
    }, { sourceType: "product" });

    expect(row.currentStock).toBe(0);
    expect(row.reservedStock).toBe(0);
    expect(row.availableStock).toBe(0);
    expect(row.minStockAlert).toBe(0);
    expect(Number.isNaN(row.currentStock)).toBe(false);
  });

  it("mempertahankan angka finite tanpa pembulatan tersembunyi", () => {
    const row = buildStockItemReadModelDocument({
      id: "product-2",
      currentStock: 12.5,
      reservedStock: 2.25,
    }, { sourceType: "product" });

    expect(row.currentStock).toBe(12.5);
    expect(row.reservedStock).toBe(2.25);
    expect(row.availableStock).toBe(10.25);
  });
});
