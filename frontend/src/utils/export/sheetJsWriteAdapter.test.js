import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  aoaToSheet: vi.fn(),
  bookNew: vi.fn(),
  bookAppendSheet: vi.fn(),
  write: vi.fn(),
}));

vi.mock("xlsx", () => ({
  utils: {
    aoa_to_sheet: mocks.aoaToSheet,
    book_new: mocks.bookNew,
    book_append_sheet: mocks.bookAppendSheet,
  },
  write: mocks.write,
}));

import { createWorkbookBuffer } from "./sheetJsWriteAdapter";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.aoaToSheet.mockReturnValue({});
  mocks.bookNew.mockReturnValue({ SheetNames: [], Sheets: {} });
  mocks.write.mockReturnValue(new Uint8Array([1, 2, 3]));
});

describe("sheetJsWriteAdapter", () => {
  it("hanya membuat workbook dari data internal dan menulis buffer XLSX", () => {
    const configureWorksheet = vi.fn();
    const result = createWorkbookBuffer({
      rows: [["Nama"], ["Bunga"]],
      sheetName: "Laporan",
      configureWorksheet,
    });

    expect(mocks.aoaToSheet).toHaveBeenCalledWith([["Nama"], ["Bunga"]]);
    expect(configureWorksheet).toHaveBeenCalledTimes(1);
    expect(mocks.bookAppendSheet).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), "Laporan");
    expect(mocks.write).toHaveBeenCalledWith(expect.any(Object), { bookType: "xlsx", type: "array" });
    expect(result).toEqual(new Uint8Array([1, 2, 3]));
  });
});
