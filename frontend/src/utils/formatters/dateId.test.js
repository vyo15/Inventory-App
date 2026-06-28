import { describe, expect, it } from "vitest";
import {
  formatDateId,
  formatDateTimeId,
  getDateAgeDays,
  isDateToday,
  parseDateTimeId,
} from "./dateId";

describe("dateId formatter", () => {
  it("memperlakukan timestamp SQLite CURRENT_TIMESTAMP sebagai UTC", () => {
    const parsed = parseDateTimeId("2026-06-29 00:00:00");
    expect(parsed?.toISOString()).toBe("2026-06-29T00:00:00.000Z");
  });

  it("mempertahankan compatibility boolean withTime", () => {
    expect(formatDateId(new Date(2026, 5, 29, 9, 7), true)).toMatch(/29-06-2026 09:07/);
  });

  it("menggunakan fallback untuk nilai invalid", () => {
    expect(formatDateTimeId("invalid", { fallback: "Belum ada" })).toBe("Belum ada");
  });

  it("menghitung umur dan status hari ini dari parser canonical", () => {
    const reference = new Date("2026-06-29T12:00:00.000Z");
    expect(getDateAgeDays("2026-06-28T12:00:00.000Z", reference)).toBe(1);
    expect(isDateToday(reference, reference)).toBe(true);
  });
});
