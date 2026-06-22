import { describe, expect, it } from "vitest";
import {
  getProductStockSummary,
  hasSafeZeroMasterStock,
} from "./productsPageHelpers";

describe("productsPageHelpers stock summary", () => {
  it("menjaga snapshot non-varian dan availableStock tersimpan", () => {
    expect(getProductStockSummary({
      currentStock: 12,
      reservedStock: 3,
      availableStock: 7,
    })).toEqual({
      currentStock: 12,
      reservedStock: 3,
      availableStock: 7,
    });
  });

  it("mendukung field stock legacy untuk master non-varian", () => {
    expect(getProductStockSummary({ stock: 8, reservedStock: 2 })).toEqual({
      currentStock: 8,
      reservedStock: 2,
      availableStock: 6,
    });
  });

  it("menjumlahkan semua varian termasuk label legacy kosong", () => {
    expect(getProductStockSummary({
      hasVariants: true,
      variants: [
        { variantLabel: "Merah", currentStock: 5, reservedStock: 2 },
        { variantLabel: "", stock: 3, reservedStock: 1 },
      ],
    })).toEqual({
      currentStock: 8,
      reservedStock: 3,
      availableStock: 5,
    });
  });

  it("hanya mengizinkan aktivasi mode varian saat seluruh snapshot stok nol", () => {
    expect(hasSafeZeroMasterStock({ stock: 0, reservedStock: 0, availableStock: 0 })).toBe(true);
    expect(hasSafeZeroMasterStock({ stock: 0, reservedStock: 1, availableStock: 0 })).toBe(false);
    expect(hasSafeZeroMasterStock({ stock: 1, reservedStock: 0 })).toBe(false);
  });
});
