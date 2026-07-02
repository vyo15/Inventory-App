import { describe, expect, it } from "vitest";
import { normalizeText, normalizeTruthyText } from "./textNormalization";

describe("textNormalization", () => {
  it.each([
    [undefined, ""],
    [null, ""],
    ["", ""],
    ["  Bunga  ", "Bunga"],
    [0, "0"],
    [false, "false"],
    [-12, "-12"],
  ])("normalizeText(%s)", (value, expected) => {
    expect(normalizeText(value)).toBe(expected);
  });

  it.each([
    [undefined, ""],
    [null, ""],
    ["", ""],
    ["  Bunga  ", "Bunga"],
    [0, ""],
    [false, ""],
    [-12, "-12"],
  ])("normalizeTruthyText(%s)", (value, expected) => {
    expect(normalizeTruthyText(value)).toBe(expected);
  });
});
