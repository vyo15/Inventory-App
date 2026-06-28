import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve("src/pages/Produksi/ProductionBoms.jsx"), "utf8");
const serviceSource = fs.readFileSync(
  path.resolve("src/services/Produksi/productionBomsService.js"),
  "utf8",
);

describe("ProductionBoms page contract", () => {
  it("memuat BOM, item, dan Tahapan Produksi melalui service resmi", () => {
    expect(source).toContain("getAllProductionBoms");
    expect(source).toContain("getActiveBomReferenceData");
    expect(source).toContain("createProductionBom");
    expect(source).toContain("updateProductionBom");
    expect(serviceSource).toContain("getActiveProductionSteps");
    expect(serviceSource).toContain("productionSteps");
  });

  it("aksi material dan step tetap memakai builder bersama dengan handler terpisah", () => {
    expect(source).toContain("buildBomLineActionColumn");
    expect(source).toContain("openMaterialModal");
    expect(source).toContain("openStepModal");
    expect(source).toContain("handleRemoveMaterialLine");
    expect(source).toContain("handleRemoveStepLine");
  });

  it("mengunci satu BOM menjadi satu tahapan pekerjaan", () => {
    expect(source).toContain('title="Tahapan Pekerjaan"');
    expect(source).toContain("Satu resep/BOM mewakili satu perubahan stok");
    expect(source).toContain("addButtonDisabled={stepLines.length >= 1}");
    expect(source).toContain("BOM wajib memiliki tepat 1 Tahapan Produksi aktif");
    expect(serviceSource).toContain('routingMode: "single_step"');
  });
});
