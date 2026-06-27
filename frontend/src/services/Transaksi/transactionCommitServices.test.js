import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commitPurchase: vi.fn(),
  commitReturn: vi.fn(),
  commitSale: vi.fn(),
  updateSaleStatus: vi.fn(),
}));

vi.mock("../../data/adapters/sqlite/sqliteTransactionsAdapter", () => ({
  commitPurchase: mocks.commitPurchase,
  commitReturn: mocks.commitReturn,
  commitSale: mocks.commitSale,
  updateSaleStatus: mocks.updateSaleStatus,
  subscribePurchases: vi.fn(),
  subscribeReturns: vi.fn(),
  subscribeSales: vi.fn(),
}));

vi.mock("../MasterData/productsService", () => ({ listenProducts: vi.fn() }));
vi.mock("../MasterData/rawMaterialsService", () => ({ listenRawMaterials: vi.fn() }));
vi.mock("../MasterData/suppliersService", () => ({
  getSupplierCatalogOffer: (supplier = {}, offerId = "") => (supplier.catalogOffers || [])
    .find((offer) => String(offer.id) === String(offerId)) || null,
  getSupplierDisplayName: (supplier = {}) => supplier.name || "",
  getSupplierReferenceId: (supplier = {}) => supplier.id || "",
}));
vi.mock("../../data/adapters/sqlite/sqliteProductsAdapter", () => ({ listProducts: vi.fn() }));
vi.mock("../../data/adapters/sqlite/sqliteRawMaterialsAdapter", () => ({ listRawMaterials: vi.fn() }));

import { createPurchaseTransaction } from "./purchasesService";
import { createReturnTransaction } from "./returnsService";
import { createSaleTransaction, updateSaleStatusTransaction } from "./salesService";

beforeEach(() => vi.clearAllMocks());

describe("transaction commit services", () => {
  it("purchase memvalidasi input lalu memakai endpoint commit atomic", async () => {
    mocks.commitPurchase.mockResolvedValue({ id: "purchase-1" });

    await expect(createPurchaseTransaction({ values: { quantity: 0 } })).rejects.toThrow("Item pembelian wajib dipilih");

    const result = await createPurchaseTransaction({
      values: {
        type: "product",
        itemId: "product-1",
        supplierId: "supplier-1",
        catalogOfferId: "offer-1",
        quantity: 2,
        subtotalItems: 50000,
        totalCost: 50000,
        priceVerified: true,
        priceVerifiedAt: "2026-06-27T10:00:00.000Z",
        verifiedCatalogPrice: 25000,
      },
      products: [{ id: "product-1", name: "Bunga", stockUnit: "pcs" }],
      suppliers: [{
        id: "supplier-1",
        name: "Supplier A",
        catalogOffers: [{
          id: "offer-1",
          itemType: "product",
          itemId: "product-1",
          supplierItemPrice: 25000,
          productLink: "https://example.com/bunga",
        }],
      }],
    });

    expect(result).toEqual({ id: "purchase-1" });
    expect(mocks.commitPurchase).toHaveBeenCalledTimes(1);
    expect(mocks.commitPurchase).toHaveBeenCalledWith(expect.objectContaining({
      sourceId: "product-1",
      sourceType: "product",
      quantity: 2,
      totalAmount: 50000,
      catalogOfferId: "offer-1",
      priceVerified: true,
      items: [expect.objectContaining({ sourceId: "product-1", quantity: 2 })],
      status: "Selesai",
    }));
  });

  it("purchase bahan baku mengirim total stok hasil konversi ke stock-in", async () => {
    mocks.commitPurchase.mockResolvedValue({ id: "purchase-material-1" });

    await createPurchaseTransaction({
      values: {
        type: "material",
        itemId: "material-1",
        supplierId: "supplier-1",
        catalogOfferId: "offer-material-1",
        quantity: 3,
        conversionValue: 10,
        totalStockIn: 30,
        subtotalItems: 60000,
        totalCost: 65000,
        priceVerified: true,
        priceVerifiedAt: "2026-06-27T10:00:00.000Z",
        verifiedCatalogPrice: 20000,
      },
      materials: [{ id: "material-1", name: "Kain Flanel", stockUnit: "lembar" }],
      suppliers: [{
        id: "supplier-1",
        name: "Supplier A",
        catalogOffers: [{
          id: "offer-material-1",
          itemType: "raw_material",
          itemId: "material-1",
          supplierItemPrice: 20000,
          conversionValue: 10,
          stockUnit: "lembar",
        }],
      }],
    });

    expect(mocks.commitPurchase).toHaveBeenCalledWith(expect.objectContaining({
      sourceType: "raw_material",
      quantity: 3,
      totalStockIn: 30,
      items: [expect.objectContaining({ sourceType: "raw_material", quantity: 30 })],
    }));
  });

  it("sale menolak qty tidak valid dan status cancel sebelum request backend", async () => {
    await expect(createSaleTransaction({
      values: {},
      saleItems: [{ itemId: "product-1", itemName: "Bunga", quantity: 0 }],
    })).rejects.toThrow("Qty Bunga harus lebih dari 0");
    expect(mocks.commitSale).not.toHaveBeenCalled();

    await expect(updateSaleStatusTransaction({ saleId: "sale-1", newStatus: "Dibatalkan" }))
      .rejects.toThrow("Status penjualan tidak valid");
    expect(mocks.updateSaleStatus).not.toHaveBeenCalled();
  });

  it("sale valid hanya memakai commitSale satu kali", async () => {
    mocks.commitSale.mockResolvedValue({ id: "sale-1" });
    await createSaleTransaction({
      values: { total: 30000 },
      saleItems: [{ itemId: "product-1", itemName: "Bunga", quantity: 1 }],
    });

    expect(mocks.commitSale).toHaveBeenCalledTimes(1);
    expect(mocks.commitSale).toHaveBeenCalledWith(expect.objectContaining({
      status: "Diproses",
      totalAmount: 30000,
      items: [expect.objectContaining({ sourceId: "product-1", quantity: 1 })],
    }));
  });

  it("return wajib terkait sales dan tidak boleh melebihi sisa qty", async () => {
    await expect(createReturnTransaction({ values: {} })).rejects.toThrow("Transaksi Sales wajib dipilih");

    const returnableItems = [{
      key: "item-1",
      sourceType: "product",
      sourceId: "product-1",
      itemName: "Bunga",
      remainingQuantity: 1,
    }];
    await expect(createReturnTransaction({
      values: { relatedSaleId: "sale-1", saleItemKey: "item-1", quantity: 2 },
      returnableItems,
    })).rejects.toThrow("Jumlah retur melebihi sisa item Sales");
    expect(mocks.commitReturn).not.toHaveBeenCalled();

    mocks.commitReturn.mockResolvedValue({ id: "return-1" });
    await createReturnTransaction({
      values: { relatedSaleId: "sale-1", saleItemKey: "item-1", quantity: 1 },
      returnableItems,
      selectedSale: { id: "sale-1", saleNumber: "SAL-001" },
    });
    expect(mocks.commitReturn).toHaveBeenCalledTimes(1);
    expect(mocks.commitReturn).toHaveBeenCalledWith(expect.objectContaining({ relatedSaleId: "sale-1", quantity: 1 }));
  });
});
