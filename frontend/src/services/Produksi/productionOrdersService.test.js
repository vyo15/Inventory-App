import { describe, expect, it, vi } from "vitest";

vi.mock("../../data/adapters/sqlite/sqliteProductionAdapter", () => ({
  commitProductionOrder: vi.fn(),
  commitProductionOrderRequirementRefresh: vi.fn(),
  generateProductionCode: vi.fn(),
  getProductionRecordById: vi.fn(),
  listProductionRecords: vi.fn(),
  updateProductionRecord: vi.fn(),
}));
vi.mock("./productionBomsService", () => ({
  getActiveProductionBoms: vi.fn().mockResolvedValue([]),
  getProductionBomById: vi.fn(),
}));
vi.mock("./semiFinishedMaterialsService", () => ({
  getActiveSemiFinishedMaterials: vi.fn().mockResolvedValue([]),
}));
vi.mock("../MasterData/productsService", () => ({
  listenProducts: vi.fn((onNext) => {
    onNext([{ id: "product-target", name: "Bunga Jadi", currentStock: 2, reservedStock: 0, availableStock: 2 }]);
    return vi.fn();
  }),
}));
vi.mock("../MasterData/rawMaterialsService", () => ({
  listenRawMaterials: vi.fn((onNext) => {
    onNext([{ id: "raw-1", name: "Kain Flanel", currentStock: 5, reservedStock: 1, availableStock: 4 }]);
    return vi.fn();
  }),
}));

import { buildProductionOrderRequirementLines } from "./productionOrdersService";

describe("Production Order requirement preview", () => {
  it("menerima kontrak halaman dan menghasilkan kebutuhan, stok, serta shortage", async () => {
    const result = await buildProductionOrderRequirementLines({
      bom: {
        id: "bom-1",
        targetType: "product",
        targetId: "product-target",
        materialLines: [{
          itemType: "raw_material",
          itemId: "raw-1",
          itemName: "Kain Flanel",
          qtyPerUnit: 3,
          unit: "pcs",
        }],
      },
      orderQty: 2,
    });

    expect(result.requirementLines[0]).toEqual(expect.objectContaining({
      qtyRequired: 6,
      availableStockSnapshot: 4,
      shortageQty: 2,
      status: "shortage",
    }));
    expect(result.reservationSummary).toEqual(expect.objectContaining({
      totalLines: 1,
      shortageLines: 1,
      canReserveFully: false,
    }));
    expect(result.targetStockPreview).toEqual(expect.objectContaining({
      targetId: "product-target",
      availableStock: 2,
    }));
  });
});
