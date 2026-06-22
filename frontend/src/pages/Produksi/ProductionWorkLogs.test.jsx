import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve("src/pages/Produksi/ProductionWorkLogs.jsx"), "utf8");

describe("ProductionWorkLogs page contract", () => {
  it("tetap memakai service Work Log dan payroll resmi", () => {
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
});
