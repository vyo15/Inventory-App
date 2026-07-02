import { describe, expect, it } from "vitest";
import {
  buildPurchaseStockPreview,
  buildPurchaseStockPreviewSnapshot,
} from "./purchaseStockPreviewHelpers";

describe("purchaseStockPreviewHelpers", () => {
  it("menormalisasi stok master tanpa menjadi sumber mutasi", () => {
    expect(buildPurchaseStockPreviewSnapshot({ currentStock: 10, reservedStock: 3 })).toEqual({
      currentStock: 10,
      reservedStock: 3,
      availableStock: 7,
    });
  });

  it("meminta varian sebelum menampilkan stok item bervarian", () => {
    expect(buildPurchaseStockPreview({
      itemId: "mat-1",
      itemType: "material",
      selectedMaterial: { name: "Flanel", hasVariants: true, variantLabel: "Warna" },
    })).toMatchObject({
      status: "needs_variant",
      itemName: "Flanel",
      variantLabel: "Warna",
    });
  });

  it("menampilkan stok varian yang dipilih, bukan total master", () => {
    expect(buildPurchaseStockPreview({
      itemId: "prod-1",
      itemType: "product",
      productVariantKey: "red",
      selectedProductHasVariants: true,
      selectedProduct: { name: "Mawar", stockUnit: "pcs" },
      selectedProductVariant: {
        variantKey: "red",
        variantLabel: "Merah",
        currentStock: 8,
        reservedStock: 2,
      },
    })).toMatchObject({
      status: "ready",
      sourceType: "variant",
      sourceLabel: "Merah",
      currentStock: 8,
      reservedStock: 2,
      availableStock: 6,
      stockUnit: "pcs",
    });
  });
});
