import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createProductionRecord: vi.fn(),
  updateProductionRecord: vi.fn(),
  listenProducts: vi.fn(),
  listenRawMaterials: vi.fn(),
  getActiveSemiFinishedMaterials: vi.fn(),
  getActiveProductionSteps: vi.fn(),
}));

vi.mock("../../data/adapters/sqlite/sqliteProductionAdapter", () => ({
  createProductionRecord: mocks.createProductionRecord,
  updateProductionRecord: mocks.updateProductionRecord,
  generateProductionCode: vi.fn(),
  getProductionRecordById: vi.fn(),
  listProductionRecords: vi.fn(),
}));

vi.mock("../MasterData/productsService", () => ({
  listenProducts: mocks.listenProducts,
}));

vi.mock("../MasterData/rawMaterialsService", () => ({
  listenRawMaterials: mocks.listenRawMaterials,
}));

vi.mock("./semiFinishedMaterialsService", () => ({
  getActiveSemiFinishedMaterials: mocks.getActiveSemiFinishedMaterials,
}));

vi.mock("./productionStepsService", () => ({
  getActiveProductionSteps: mocks.getActiveProductionSteps,
}));

import {
  createProductionBom,
  getActiveBomReferenceData,
  validateProductionBom,
} from "./productionBomsService";

const validBom = {
  code: "BOM-001",
  name: "Resep Kelopak Mawar",
  targetId: "semi-1",
  targetType: "semi_finished",
  materialLines: [{ itemId: "raw-1", qtyPerUnit: 1 }],
  stepLines: [{ stepId: "step-1", stepName: "Bentuk Kelopak" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listenProducts.mockImplementation((next) => {
    next([{ id: "product-1" }]);
    return vi.fn();
  });
  mocks.listenRawMaterials.mockImplementation((next) => {
    next([{ id: "raw-1" }]);
    return vi.fn();
  });
  mocks.getActiveSemiFinishedMaterials.mockResolvedValue([{ id: "semi-1" }]);
  mocks.getActiveProductionSteps.mockResolvedValue([{ id: "step-1" }]);
  mocks.createProductionRecord.mockResolvedValue({ id: "bom-1" });
});

describe("productionBomsService single-step contract", () => {
  it("memuat Tahapan Produksi bersama seluruh referensi BOM", async () => {
    await expect(getActiveBomReferenceData()).resolves.toEqual({
      products: [{ id: "product-1" }],
      rawMaterials: [{ id: "raw-1" }],
      semiFinishedMaterials: [{ id: "semi-1" }],
      productionSteps: [{ id: "step-1" }],
    });
  });

  it("mewajibkan tepat satu tahapan", () => {
    expect(validateProductionBom({ ...validBom, stepLines: [] }).stepLines).toMatch(/tepat 1/);
    expect(validateProductionBom({
      ...validBom,
      stepLines: [{ stepId: "step-1" }, { stepId: "step-2" }],
    }).stepLines).toMatch(/tepat 1/);
    expect(validateProductionBom(validBom)).toEqual({});
  });

  it("tidak memotong multi-step secara diam-diam saat service create dipanggil", async () => {
    await expect(createProductionBom({
      ...validBom,
      stepLines: [{ stepId: "step-1" }, { stepId: "step-2" }],
    })).rejects.toThrow(/tepat 1/);
    expect(mocks.createProductionRecord).not.toHaveBeenCalled();
  });

  it("menyimpan routing single-step tanpa mengubah line yang valid", async () => {
    await createProductionBom(validBom, { email: "admin@example.test" });

    expect(mocks.createProductionRecord).toHaveBeenCalledWith(
      "boms",
      expect.objectContaining({
        routingMode: "single_step",
        stepLines: validBom.stepLines,
      }),
    );
  });
});
