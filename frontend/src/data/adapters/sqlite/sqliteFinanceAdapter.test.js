import { describe, expect, it } from "vitest";
import { normalizeFinanceRecord } from "./sqliteFinanceAdapter";

describe("normalizeFinanceRecord", () => {
  it("membulatkan amount valid dan menetralkan nilai legacy tidak valid", () => {
    expect(normalizeFinanceRecord({ amount: 10.6 }).amount).toBe(11);
    expect(normalizeFinanceRecord({ amount: "invalid" }).amount).toBe(0);
  });
});
