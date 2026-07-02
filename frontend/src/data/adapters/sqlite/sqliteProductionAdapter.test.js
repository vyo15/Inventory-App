import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  commitProductionOrderFromPlan,
  commitProductionOrderStart,
  commitProductionPayrollPaid,
  commitProductionWorkLogComplete,
} from "./sqliteProductionAdapter";

let fetchMock;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ ok: true, data: { saved: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sqliteProductionAdapter atomic endpoints", () => {
  it.each([
    [() => commitProductionOrderFromPlan("plan 1", { note: "x" }), "/api/production/planning/plan%201/create-order", { note: "x" }],
    [() => commitProductionOrderStart("order/1", { stepId: "step-1" }), "/api/production/orders/order%2F1/start", { stepId: "step-1" }],
    [() => commitProductionWorkLogComplete("work-1", { goodQty: 2 }), "/api/production/work-logs/work-1/complete", { goodQty: 2 }],
    [() => commitProductionPayrollPaid("pay-1", { paidAt: "2026-06-20" }), "/api/production/payrolls/pay-1/mark-paid", { paidAt: "2026-06-20" }],
  ])("mengirim lifecycle ke endpoint commit resmi", async (invoke, path, body) => {
    await invoke();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3001${path}`,
      expect.objectContaining({
        credentials: "include",
        method: "POST",
        body: JSON.stringify(body),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-IMS-Client-ID": expect.any(String),
        }),
      }),
    );
  });
});
