import { describe, expect, it } from "vitest";
import {
  getRawMaterialStockSummary,
  hasSafeZeroMasterStock,
} from "./rawMaterialsPageHelpers";

describe("rawMaterialsPageHelpers stock summary", () => {
  it("memakai rumus canonical yang sama untuk bahan non-varian", () => {
    expect(getRawMaterialStockSummary({
      currentStock: 20,
      reservedStock: 4,
    })).toEqual({
      currentStock: 20,
      reservedStock: 4,
      availableStock: 16,
    });
  });

  it("menjaga total varian bahan dan compatibility field stock", () => {
    expect(getRawMaterialStockSummary({
      hasVariants: true,
      variants: [
        { variantKey: "a", currentStock: 6, reservedStock: 1 },
        { variantKey: "b", stock: 4, reservedStock: 2 },
      ],
    })).toEqual({
      currentStock: 10,
      reservedStock: 3,
      availableStock: 7,
    });
  });

  it("menolak migrasi mode varian bila snapshot stok masih terisi", () => {
    expect(hasSafeZeroMasterStock({ currentStock: 0, reservedStock: 0 })).toBe(true);
    expect(hasSafeZeroMasterStock({ currentStock: 2, reservedStock: 0 })).toBe(false);
  });
});
