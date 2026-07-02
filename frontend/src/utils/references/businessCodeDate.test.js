import { describe, expect, it, vi } from "vitest";
import { formatBusinessCodeDateStamp } from "./businessCodeDate";

describe("formatBusinessCodeDateStamp", () => {
  it("memakai format DDMMYYYY", () => {
    expect(formatBusinessCodeDateStamp(new Date(2026, 6, 2))).toBe("02072026");
  });

  it("memakai tanggal saat ini untuk input tidak valid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 3));
    expect(formatBusinessCodeDateStamp("invalid-date")).toBe("03072026");
    vi.useRealTimers();
  });
});
