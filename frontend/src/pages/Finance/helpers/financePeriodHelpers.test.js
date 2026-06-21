import { describe, expect, it } from "vitest";
import {
  buildFinanceMonthOptions,
  buildFinanceRecordYearOptions,
  buildFinanceYearSelectOptions,
  filterFinanceRecordsByPeriod,
} from "./financePeriodHelpers";

const timestamp = (value) => ({
  toDate: () => new Date(value),
});

describe("financePeriodHelpers", () => {
  it("membangun opsi bulan canonical dengan opsi semua bila diminta", () => {
    const standardOptions = buildFinanceMonthOptions();
    const optionsWithAll = buildFinanceMonthOptions({ includeAll: true });

    expect(standardOptions).toHaveLength(12);
    expect(standardOptions.map((item) => item.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(optionsWithAll[0]).toEqual({ label: "Semua Bulan", value: "all" });
    expect(optionsWithAll.slice(1)).toEqual(standardOptions);
  });

  it("menggabungkan tahun saat ini dan tahun record tanpa duplikat", () => {
    const records = [
      { date: timestamp("2024-01-02T00:00:00.000Z") },
      { date: timestamp("2026-05-03T00:00:00.000Z") },
      { date: timestamp("2024-09-10T00:00:00.000Z") },
      { date: null },
    ];

    expect(buildFinanceRecordYearOptions(records, 2025)).toEqual([2026, 2025, 2024]);
  });

  it("memfilter record berdasarkan tahun dan bulan tanpa menerima tanggal non-timestamp", () => {
    const records = [
      { id: "jan", date: timestamp("2026-01-10T00:00:00.000Z") },
      { id: "feb", date: timestamp("2026-02-10T00:00:00.000Z") },
      { id: "other-year", date: timestamp("2025-02-10T00:00:00.000Z") },
      { id: "invalid", date: "2026-02-10" },
    ];

    expect(filterFinanceRecordsByPeriod(records, { year: 2026, month: "all" }).map((item) => item.id))
      .toEqual(["jan", "feb"]);
    expect(filterFinanceRecordsByPeriod(records, { year: 2026, month: 1 }).map((item) => item.id))
      .toEqual(["feb"]);
  });

  it("membangun opsi tahun ledger dengan satu tahun ke depan seperti perilaku lama", () => {
    expect(buildFinanceYearSelectOptions({ currentYear: 2026, optionCount: 4, futureYearCount: 1 }))
      .toEqual([
        { label: "2027", value: 2027 },
        { label: "2026", value: 2026 },
        { label: "2025", value: 2025 },
        { label: "2024", value: 2024 },
      ]);
  });
});
