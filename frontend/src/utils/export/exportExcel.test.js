import { describe, expect, it } from "vitest";
import { sanitizeSpreadsheetCellValue } from "./exportExcel";

describe("sanitizeSpreadsheetCellValue", () => {
  it.each(["=SUM(A1:A2)", "+cmd", "-1+2", "@IMPORTDATA()", "  =HYPERLINK()"])(
    "menetralkan formula spreadsheet dari nilai %s",
    (value) => {
      expect(sanitizeSpreadsheetCellValue(value)).toBe(`'${value}`);
    },
  );

  it("tidak mengubah angka atau teks biasa", () => {
    expect(sanitizeSpreadsheetCellValue(12500)).toBe(12500);
    expect(sanitizeSpreadsheetCellValue("Bunga Mawar")).toBe("Bunga Mawar");
  });
});
