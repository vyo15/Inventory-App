import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  commitProductionOrderStart: vi.fn(),
  commitProductionWorkLogComplete: vi.fn(),
}));

vi.mock("../../data/adapters/sqlite/sqliteProductionAdapter", () => ({
  commitProductionOrderStart: mocks.commitProductionOrderStart,
  commitProductionWorkLogComplete: mocks.commitProductionWorkLogComplete,
  createProductionRecord: vi.fn(),
  generateProductionCode: vi.fn(),
  getProductionRecordById: vi.fn(),
  listProductionRecords: vi.fn(),
  subscribeProductionRecords: vi.fn(),
  updateProductionRecord: vi.fn(),
}));

vi.mock("./productionOrdersService", () => ({
  getProductionOrderById: vi.fn(),
}));

import {
  completeProductionWorkLog,
  createProductionWorkLogFromOrder,
} from "./productionWorkLogsService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("productionWorkLogsService guarded lifecycle", () => {
  it("menyelesaikan Work Log melalui satu endpoint atomic dengan payload completion", async () => {
    mocks.commitProductionWorkLogComplete.mockResolvedValue({
      workLog: { id: "work-1", status: "completed" },
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
    expect(result).toEqual({ id: "work-1", status: "completed" });
  });

  it("memulai Work Log hanya melalui endpoint Start Production", async () => {
    mocks.commitProductionOrderStart.mockResolvedValue({ workLog: { id: "work-1" } });

    await createProductionWorkLogFromOrder("order-1", { stepId: "step-1" }, { username: "admin" });

    expect(mocks.commitProductionOrderStart).toHaveBeenCalledTimes(1);
    expect(mocks.commitProductionOrderStart).toHaveBeenCalledWith("order-1", { stepId: "step-1" });
  });
});
