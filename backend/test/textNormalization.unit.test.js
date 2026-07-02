const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeLowerText,
  normalizeText,
  normalizeTruthyText,
  normalizeUpperText,
  toRoundedInteger,
} = require("../src/utils/textNormalization");

test("normalizeText preserves valid falsy primitive values", () => {
  assert.equal(normalizeText(undefined), "");
  assert.equal(normalizeText(null), "");
  assert.equal(normalizeText("  bunga  "), "bunga");
  assert.equal(normalizeText(0), "0");
  assert.equal(normalizeText(false), "false");
});

test("normalizeTruthyText preserves historical text-only semantics", () => {
  assert.equal(normalizeTruthyText(undefined), "");
  assert.equal(normalizeTruthyText(null), "");
  assert.equal(normalizeTruthyText("  bunga  "), "bunga");
  assert.equal(normalizeTruthyText(0), "");
  assert.equal(normalizeTruthyText(false), "");
});

test("toRoundedInteger preserves finite rounding behavior", () => {
  assert.equal(toRoundedInteger(undefined), 0);
  assert.equal(toRoundedInteger(null), 0);
  assert.equal(toRoundedInteger("1.6"), 2);
  assert.equal(toRoundedInteger(-1.6), -2);
  assert.equal(toRoundedInteger(Number.POSITIVE_INFINITY), 0);
  assert.equal(toRoundedInteger(Number.NaN), 0);
});


test("upper/lower text memakai normalisasi nullish yang sama", () => {
  assert.equal(normalizeUpperText("  cus-01  "), "CUS-01");
  assert.equal(normalizeLowerText("  ACTIVE  "), "active");
  assert.equal(normalizeUpperText(0), "0");
  assert.equal(normalizeLowerText(false), "false");
});


test("compatibility export normalizeLower tetap menunjuk helper canonical", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(
    path.resolve(__dirname, "../src/modules/production/production.shared.js"),
    "utf8",
  );

  assert.match(source, /normalizeLower:\s*normalizeLowerText/);
});
