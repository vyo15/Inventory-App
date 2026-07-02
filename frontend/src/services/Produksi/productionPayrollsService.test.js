import { describe, expect, it } from "vitest";
import {
  buildPayrollDraftFromWorkLog,
  validateProductionPayroll,
} from "./productionPayrollsService";

describe("productionPayrollsService numeric normalization", () => {
  it("menolak nominal negatif tetapi tidak membiarkan NaN melewati payload helper", () => {
    expect(validateProductionPayroll({
      payrollDate: "2026-07-02",
      workLogId: "work-1",
      workerId: "worker-1",
      finalAmount: -1,
    })).toEqual({ finalAmount: "Total payroll tidak boleh negatif" });

    expect(validateProductionPayroll({
      payrollDate: "2026-07-02",
      workLogId: "work-1",
      workerId: "worker-1",
      finalAmount: "invalid",
    })).toEqual({ finalAmount: "Total payroll tidak valid" });
  });

  it("menghasilkan draft finite saat snapshot legacy berisi angka tidak valid", () => {
    const draft = buildPayrollDraftFromWorkLog({
      id: "work-1",
      payrollRate: "invalid",
      payrollQtyBase: "invalid",
      actualOutputQty: "invalid",
      plannedQty: "invalid",
    });

    expect(Number.isFinite(draft.payrollRate)).toBe(true);
    expect(Number.isFinite(draft.payrollQtyBase)).toBe(true);
    expect(Number.isFinite(draft.outputQtyUsed)).toBe(true);
    expect(Number.isFinite(draft.workedQty)).toBe(true);
    expect(draft.payrollQtyBase).toBeGreaterThanOrEqual(1);
  });
});
