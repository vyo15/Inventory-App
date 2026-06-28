import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve("src/pages/Produksi/ProductionWorkLogs.jsx"), "utf8");
const modalSource = fs.readFileSync(
  path.resolve("src/pages/Produksi/components/WorkLogCompleteModal.jsx"),
  "utf8",
);

describe("ProductionWorkLogs page contract", () => {
  it("tetap memakai service Work Log dan payroll read resmi", () => {
    expect(source).toContain("getAllProductionWorkLogs");
    expect(source).toContain("getWorkLogReferenceData");
    expect(source).toContain("getAllProductionPayrolls");
    expect(source).toContain("completeProductionWorkLog");
  });

  it("menjaga line PO terkunci dan action completion tetap tersedia", () => {
    expect(source).toContain("buildWorkLogLineActionColumn");
    expect(source).toContain("Terkunci dari PO");
    expect(source).toContain("Selesaikan");
    expect(source).not.toContain("Tambah Work Log");
  });

  it("menyelesaikan Work Log dan payroll melalui satu endpoint atomic", () => {
    expect(source).not.toContain("generatePayrollLinesFromCompletedWorkLog");
    expect(source).toContain("completionResult?.payroll?.createdCount");
    expect(source).toContain("line payroll dibuat secara atomic");
  });

  it("membatasi tepat satu operator agar payroll hasil bersama tidak berlipat", () => {
    expect(source).toContain("completionEmployeeState");
    expect(source).toContain("maxCount={1}");
    expect(modalSource).toContain("Pilih tepat 1 operator");
    expect(modalSource).toContain("pisahkan Production Order/Work Log per operator");
  });

  it("memakai monitoring metric eksplisit dan tidak menebak dari nama step", () => {
    expect(source).toContain("step?.monitoringMetric");
    expect(source).toContain("buildMonitoringProfileSnapshot");
    expect(source).not.toContain(".toLowerCase().includes('daun')");
  });
});
