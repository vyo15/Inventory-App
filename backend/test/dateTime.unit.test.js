const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { getCurrentIsoTimestamp } = require("../src/utils/dateTime");

test("current ISO timestamp memakai format ISO UTC", () => {
  const value = getCurrentIsoTimestamp();
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});

test("compatibility export nowIso tetap menunjuk helper timestamp canonical", () => {
  const sourceFiles = [
    "../src/modules/finance/finance.engine.js",
    "../src/modules/stock/engine/stockSourceRegistry.js",
    "../src/modules/production/production.shared.js",
  ];

  sourceFiles.forEach((relativePath) => {
    const source = fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");
    assert.match(source, /nowIso:\s*getCurrentIsoTimestamp/);
  });
});
