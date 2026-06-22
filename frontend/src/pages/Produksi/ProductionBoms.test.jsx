import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve("src/pages/Produksi/ProductionBoms.jsx"), "utf8");

describe("ProductionBoms page contract", () => {
  it("memuat BOM dan reference data melalui service resmi", () => {
    expect(source).toContain("getAllProductionBoms");
    expect(source).toContain("getActiveBomReferenceData");
    expect(source).toContain("createProductionBom");
    expect(source).toContain("updateProductionBom");
  });

  it("aksi material dan step tetap memakai builder bersama dengan handler terpisah", () => {
    expect(source).toContain("buildBomLineActionColumn");
    expect(source).toContain("openMaterialModal");
    expect(source).toContain("openStepModal");
    expect(source).toContain("handleRemoveMaterialLine");
    expect(source).toContain("handleRemoveStepLine");
  });
});
