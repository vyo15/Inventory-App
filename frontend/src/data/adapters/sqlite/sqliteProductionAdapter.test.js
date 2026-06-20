import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requestSqliteApi: vi.fn() }));

vi.mock("./sqliteApiClient", () => ({ requestSqliteApi: mocks.requestSqliteApi }));
vi.mock("./sqliteJsonRecordAdapterFactory", () => ({
  createSqliteJsonRecordAdapter: () => ({
    list: vi.fn(), getById: vi.fn(), generateCode: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
  }),
}));

import {
  commitProductionOrderFromPlan,
  commitProductionOrderStart,
  commitProductionPayrollPaid,
  commitProductionWorkLogComplete,
} from "./sqliteProductionAdapter";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requestSqliteApi.mockResolvedValue({ data: { ok: true } });
});

describe("sqliteProductionAdapter atomic endpoints", () => {
  it.each([
    [() => commitProductionOrderFromPlan("plan 1", { note: "x" }), "/api/production/planning/plan%201/create-order", { note: "x" }],
    [() => commitProductionOrderStart("order/1", { stepId: "step-1" }), "/api/production/orders/order%2F1/start", { stepId: "step-1" }],
    [() => commitProductionWorkLogComplete("work-1", { goodQty: 2 }), "/api/production/work-logs/work-1/complete", { goodQty: 2 }],
    [() => commitProductionPayrollPaid("pay-1", { paidAt: "2026-06-20" }), "/api/production/payrolls/pay-1/mark-paid", { paidAt: "2026-06-20" }],
  ])("mengirim lifecycle ke endpoint commit resmi", async (invoke, path, body) => {
    await invoke();
    expect(mocks.requestSqliteApi).toHaveBeenCalledWith(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  });
});
