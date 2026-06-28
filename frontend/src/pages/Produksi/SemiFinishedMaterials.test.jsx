import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve("src/pages/Produksi/SemiFinishedMaterials.jsx"),
  "utf8",
);

describe("SemiFinishedMaterials reusable component contract", () => {
  it("membolehkan Jenis Bunga kosong untuk komponen reusable", () => {
    const flowerFieldStart = source.indexOf('label="Jenis Bunga"');
    const flowerFieldEnd = source.indexOf("</Form.Item>", flowerFieldStart);
    const flowerField = source.slice(flowerFieldStart, flowerFieldEnd);

    expect(flowerField).toContain('name="flowerTypeId"');
    expect(flowerField).toContain("allowClear");
    expect(flowerField).toContain("Umum / Reusable");
    expect(flowerField).not.toContain("required: true");
  });
});
