import { describe, expect, it } from "vitest";
import {
  buildFormValues,
  getRawMaterialMinimumStockDisplay,
  getRawMaterialStatusMeta,
  getRawMaterialStockSummary,
  getSafeRestockLink,
  getSupplierCatalogSummaryForMaterial,
  hasSafeZeroMasterStock,
} from "./rawMaterialsPageHelpers";

describe("rawMaterialsPageHelpers stock summary", () => {
  it("memakai rumus canonical yang sama untuk bahan non-varian", () => {
    expect(getRawMaterialStockSummary({ currentStock: 20, reservedStock: 4 })).toEqual({
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
    })).toEqual({ currentStock: 10, reservedStock: 3, availableStock: 7 });
  });

  it("menolak migrasi mode varian bila snapshot stok masih terisi", () => {
    expect(hasSafeZeroMasterStock({ currentStock: 0, reservedStock: 0 })).toBe(true);
    expect(hasSafeZeroMasterStock({ currentStock: 2, reservedStock: 0 })).toBe(false);
  });

  it("tetap membaca minimum stok dari variantOptions legacy", () => {
    const material = {
      hasVariantOptions: true,
      minStock: 9,
      variants: [],
      variantOptions: [
        { name: "Merah", currentStock: 1, minStockAlert: 3, isActive: true },
        { name: "Kuning", currentStock: 6, minStockAlert: 2, isActive: true },
      ],
    };

    expect(buildFormValues(material)).toEqual(expect.objectContaining({
      hasVariants: true,
      variants: expect.arrayContaining([expect.objectContaining({ name: "Merah", minStockAlert: 3 })]),
    }));
    expect(getRawMaterialMinimumStockDisplay(material)).toBe(5);
    expect(getRawMaterialStatusMeta(material).affectedVariants).toEqual([
      expect.objectContaining({ label: "Merah", threshold: 3, stock: 1 }),
    ]);
  });

  it("menghitung minimum stok per varian dan status dari varian yang terdampak", () => {
    const material = {
      hasVariants: true,
      minStock: 99,
      variants: [
        { name: "Merah", currentStock: 3, reservedStock: 0, minStockAlert: 5, isActive: true },
        { name: "Kuning", currentStock: 8, reservedStock: 0, minStockAlert: 2, isActive: true },
        { name: "Lama", currentStock: 0, minStockAlert: 20, isActive: false },
      ],
    };

    expect(getRawMaterialMinimumStockDisplay(material)).toBe(7);
    expect(getRawMaterialStatusMeta(material).label).toBe("Stok Rendah");
    expect(getRawMaterialStatusMeta(material).affectedVariants).toEqual([
      expect.objectContaining({ label: "Merah", threshold: 5, stock: 3 }),
    ]);
  });
});

describe("rawMaterialsPageHelpers supplier catalog", () => {
  it("meringkas banyak toko dan banyak link untuk satu bahan", () => {
    const suppliers = [
      {
        id: 1,
        name: "Toko A",
        catalogOffers: [
          { id: 11, itemType: "raw_material", itemId: "raw-1", status: "active" },
          { id: 12, itemType: "raw_material", itemId: "raw-1", status: "active" },
        ],
      },
      {
        id: 2,
        name: "Toko B",
        catalogOffers: [
          { id: 21, itemType: "material", itemId: "raw-1", status: "active" },
          { id: 22, itemType: "raw_material", itemId: "raw-2", status: "active" },
        ],
      },
    ];

    expect(getSupplierCatalogSummaryForMaterial(suppliers, "raw-1")).toEqual(
      expect.objectContaining({ supplierCount: 2, offerCount: 3, label: "2 toko · 3 link" }),
    );
  });

  it("hanya mengizinkan link restock http atau https", () => {
    expect(getSafeRestockLink("javascript:alert(1)", "https://toko.example/item")).toBe("https://toko.example/item");
    expect(getSafeRestockLink("data:text/html,test", "not-a-url")).toBeNull();
  });
});
