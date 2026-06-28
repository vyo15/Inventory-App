import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commitProductionOrderStart: vi.fn(),
  commitProductionWorkLogComplete: vi.fn(),
  getProductionOrderReferenceData: vi.fn(),
  getAllProductionOrders: vi.fn(),
  getActiveProductionEmployees: vi.fn(),
  getActiveProductionProfiles: vi.fn(),
  getActiveProductionSteps: vi.fn(),
}));

vi.mock("../../data/adapters/sqlite/sqliteProductionAdapter", () => ({
  commitProductionOrderStart: mocks.commitProductionOrderStart,
  commitProductionWorkLogComplete: mocks.commitProductionWorkLogComplete,
  generateProductionCode: vi.fn(),
  getProductionRecordById: vi.fn(),
  listProductionRecords: vi.fn(),
  updateProductionRecord: vi.fn(),
}));

vi.mock("./productionOrdersService", () => ({
  getProductionOrderById: vi.fn(),
  getProductionOrderReferenceData: mocks.getProductionOrderReferenceData,
  getAllProductionOrders: mocks.getAllProductionOrders,
}));

vi.mock("./productionEmployeesService", () => ({
  getActiveProductionEmployees: mocks.getActiveProductionEmployees,
}));

vi.mock("./productionProfilesService", () => ({
  getActiveProductionProfiles: mocks.getActiveProductionProfiles,
}));

vi.mock("./productionStepsService", () => ({
  getActiveProductionSteps: mocks.getActiveProductionSteps,
}));

import {
  completeProductionWorkLog,
  createProductionWorkLogFromOrder,
  getWorkLogReferenceData,
} from "./productionWorkLogsService";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProductionOrderReferenceData.mockResolvedValue({
    boms: [{ id: "bom-1" }],
    products: [{ id: "product-1" }],
    rawMaterials: [{ id: "raw-1" }],
    semiFinishedMaterials: [{ id: "semi-1" }],
  });
  mocks.getAllProductionOrders.mockResolvedValue([{ id: "order-1" }]);
  mocks.getActiveProductionEmployees.mockResolvedValue([{ id: "employee-1" }]);
  mocks.getActiveProductionProfiles.mockResolvedValue([{ id: "profile-1" }]);
  mocks.getActiveProductionSteps.mockResolvedValue([{ id: "step-1" }]);
});

describe("productionWorkLogsService guarded lifecycle", () => {
  it("memuat seluruh reference data Work Log dari service existing", async () => {
    const result = await getWorkLogReferenceData();

    expect(result).toMatchObject({
      boms: [{ id: "bom-1" }],
      productionOrders: [{ id: "order-1" }],
      employees: [{ id: "employee-1" }],
      productionSteps: [{ id: "step-1" }],
      productionProfiles: [{ id: "profile-1" }],
      products: [{ id: "product-1" }],
      rawMaterials: [{ id: "raw-1" }],
      semiFinishedMaterials: [{ id: "semi-1" }],
      metaWarnings: [],
    });
  });

  it("tetap mengembalikan reference parsial dan warning saat satu loader gagal", async () => {
    mocks.getActiveProductionProfiles.mockRejectedValue(new Error("profile gagal"));

    const result = await getWorkLogReferenceData();

    expect(result.productionProfiles).toEqual([]);
    expect(result.employees).toEqual([{ id: "employee-1" }]);
    expect(result.metaWarnings).toHaveLength(1);
  });

  it("menyelesaikan Work Log melalui satu endpoint atomic dan mempertahankan hasil payroll", async () => {
    mocks.commitProductionWorkLogComplete.mockResolvedValue({
      workLog: { id: "work-1", status: "completed" },
      payroll: { createdCount: 1, skippedCount: 0 },
    });
    const payload = {
      goodQty: 2,
      workerIds: ["employee-1"],
      workerNames: ["Operator A"],
      workerCodes: ["EMP-001"],
      notes: "Selesai",
    };

    const result = await completeProductionWorkLog("work-1", payload, { username: "admin" });

    expect(mocks.commitProductionWorkLogComplete).toHaveBeenCalledTimes(1);
    expect(mocks.commitProductionWorkLogComplete).toHaveBeenCalledWith("work-1", payload);
    expect(result).toEqual({
      workLog: { id: "work-1", status: "completed" },
      payroll: { createdCount: 1, skippedCount: 0 },
    });
  });

  it("memulai Work Log hanya melalui endpoint Start Production", async () => {
    mocks.commitProductionOrderStart.mockResolvedValue({ workLog: { id: "work-1" } });

    await createProductionWorkLogFromOrder("order-1", { stepId: "step-1" }, { username: "admin" });

    expect(mocks.commitProductionOrderStart).toHaveBeenCalledTimes(1);
    expect(mocks.commitProductionOrderStart).toHaveBeenCalledWith("order-1", { stepId: "step-1" });
  });
});
