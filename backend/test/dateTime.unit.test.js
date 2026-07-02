const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getCurrentIsoTimestamp } = require("../src/utils/dateTime");

test("current ISO timestamp memakai format ISO UTC", () => {
  const value = getCurrentIsoTimestamp();
  assert.equal(Number.isNaN(Date.parse(value)), false);
  assert.match(value, /^\d{4}-\d{2}-\d{2}T/);
});
