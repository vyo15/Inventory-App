import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const formSource = fs.readFileSync(
  path.resolve("src/pages/Produksi/components/ProductionStepFormDrawer.jsx"),
  "utf8",
);
const optionsSource = fs.readFileSync(
  path.resolve("src/constants/productionStepOptions.js"),
  "utf8",
);

describe("ProductionSteps monitoring contract", () => {
  it("menyimpan jenis monitoring eksplisit tanpa inferensi nama tahapan", () => {
    expect(formSource).toContain('name="monitoringMetric"');
    expect(formSource).toContain("Sistem tidak lagi menebak dari nama step");
    expect(optionsSource).toContain("PRODUCTION_STEP_MONITORING_METRICS");
    expect(optionsSource).toContain('{ value: "petal"');
    expect(optionsSource).toContain('{ value: "leaf"');
    expect(optionsSource).toContain('{ value: "stem"');
  });

  it("memakai progressive disclosure untuk bantuan form tanpa menghapus konteks", () => {
    expect(formSource).toContain("InfoPopoverButton");
    expect(formSource).toContain('label="Panduan Step"');
    expect(formSource).toContain('tooltip="Menentukan satuan aktivitas proses. Nilai ini berbeda dari Mode Bayar pada aturan upah."');
    expect(formSource).toContain("Ringkasan upah:");
    expect(formSource).not.toContain('<Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>');
  });
});
