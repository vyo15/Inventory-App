import { describe, expect, it } from "vitest";
import { toFiniteNumber, toRoundedInteger } from "./numberNormalization";

describe("numberNormalization", () => {
  it.each([
    [undefined, 0],
    [null, 0],
    ["", 0],
    ["12.5", 12.5],
    [-3.5, -3.5],
    [false, 0],
    ["invalid", 0],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NaN, 0],
  ])("toFiniteNumber(%s)", (value, expected) => {
    expect(toFiniteNumber(value)).toBe(expected);
  });

  it("memakai fallback eksplisit untuk nilai tidak finite", () => {
    expect(toFiniteNumber("invalid", 7)).toBe(7);
  });

  it.each([
    ["1.4", 1],
    ["1.6", 2],
    [-1.6, -2],
    ["invalid", 0],
  ])("toRoundedInteger(%s)", (value, expected) => {
    expect(toRoundedInteger(value)).toBe(expected);
  });
});
