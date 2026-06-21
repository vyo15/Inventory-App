const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  isSupportedNodeVersion,
  parseNodeVersion,
} = require("./check-node-version.cjs");

test("runtime guard hanya menerima Node 22.12 sampai sebelum 23", () => {
  assert.deepEqual(parseNodeVersion("22.16.0"), { major: 22, minor: 16, patch: 0 });
  assert.equal(isSupportedNodeVersion("22.12.0"), true);
  assert.equal(isSupportedNodeVersion("22.99.1"), true);
  assert.equal(isSupportedNodeVersion("22.11.0"), false);
  assert.equal(isSupportedNodeVersion("20.19.0"), false);
  assert.equal(isSupportedNodeVersion("23.0.0"), false);
});
