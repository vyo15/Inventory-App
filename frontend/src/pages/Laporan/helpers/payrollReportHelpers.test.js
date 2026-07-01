import { describe, expect, it } from "vitest";
import {
  PAYROLL_DETAIL_CSV_HEADERS,
  buildPayrollDetailCsvRow,
  buildPayrollDetailExcelRow,
} from "./payrollReportHelpers";

describe("payrollReportHelpers export contract", () => {
  const payroll = {
    payrollNumber: "PAY-001",
    payrollDate: "2026-06-30T08:00:00.000Z",
    workNumber: "WL-001",
    workerName: "Ayu",
    stepName: "Potong Kelopak",
    payrollMode: "per_qty",
    workedQty: 12,
    outputQtyUsed: 10,
    finalAmount: 25000,
    status: "paid",
    payrollClassification: "direct_labor",
    includePayrollInHpp: true,
    expenseReferenceNumber: "EXP-001",
    expenseSyncStatus: "synced",
  };

  it("menjaga urutan CSV dan field Excel dari record canonical yang sama", () => {
    const csv = buildPayrollDetailCsvRow(payroll);
    const excel = buildPayrollDetailExcelRow(payroll);

    expect(csv).toHaveLength(PAYROLL_DETAIL_CSV_HEADERS.length);
    expect(csv[0]).toBe("PAY-001");
    expect(csv[6]).toBe(12);
    expect(csv[8]).toBe(25000);
    expect(excel["No. Payroll"]).toBe("PAY-001");
    expect(excel["Worked Qty"]).toContain("12");
    expect(excel["Cash Out Ref"]).toBe("EXP-001");
  });
});
