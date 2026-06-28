import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve("src/pages/Produksi/ProductionSteps.jsx"), "utf8");
const optionsSource = fs.readFileSync(
  path.resolve("src/constants/productionStepOptions.js"),
  "utf8",
);

describe("ProductionSteps monitoring contract", () => {
  it("menyimpan jenis monitoring eksplisit tanpa inferensi nama tahapan", () => {
    expect(source).toContain('name="monitoringMetric"');
    expect(source).toContain("Sistem tidak lagi menebak dari nama step");
    expect(optionsSource).toContain("PRODUCTION_STEP_MONITORING_METRICS");
    expect(optionsSource).toContain('{ value: "petal"');
    expect(optionsSource).toContain('{ value: "leaf"');
    expect(optionsSource).toContain('{ value: "stem"');
  });

  it("memakai progressive disclosure untuk bantuan form tanpa menghapus konteks", () => {
    expect(source).toContain("InfoPopoverButton");
    expect(source).toContain('label="Panduan Step"');
    expect(source).toContain('tooltip="Menentukan satuan aktivitas proses. Nilai ini berbeda dari Mode Bayar pada aturan upah."');
    expect(source).toContain("Ringkasan upah:");
    expect(source).not.toContain('<Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>');
  });
});
