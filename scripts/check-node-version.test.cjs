const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const {
  isSupportedNodeVersion,
  assertSupportedNodeVersion,
  getUnsupportedNodeMessage,
  parseNodeVersion,
} = require("./check-node-version.cjs");

test("runtime guard hanya menerima Node 22.12 sampai sebelum 23", () => {
  assert.deepEqual(parseNodeVersion("22.16.0"), { major: 22, minor: 16, patch: 0 });
  assert.equal(isSupportedNodeVersion("22.12.0"), true);
  assert.equal(isSupportedNodeVersion("22.99.1"), true);
  assert.equal(isSupportedNodeVersion("22.11.0"), false);
  assert.equal(isSupportedNodeVersion("20.19.0"), false);
  assert.equal(isSupportedNodeVersion("23.0.0"), false);
  assert.equal(assertSupportedNodeVersion("22.16.0"), true);
  assert.throws(
    () => assertSupportedNodeVersion("20.20.2"),
    (error) => error?.code === "UNSUPPORTED_NODE_VERSION"
      && error.message === getUnsupportedNodeMessage("20.20.2"),
  );

  const rootDir = path.resolve(__dirname, "..");
  const rootPackage = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const backendPackage = JSON.parse(fs.readFileSync(path.join(rootDir, "backend/package.json"), "utf8"));
  const frontendPackage = JSON.parse(fs.readFileSync(path.join(rootDir, "frontend/package.json"), "utf8"));

  const gitCheckSource = fs.readFileSync(path.join(rootDir, "scripts/git-check.cjs"), "utf8");

  assert.match(rootPackage.scripts.dev, /dev-all\.cjs/);
  assert.match(rootPackage.scripts.test, /check:runtime/);
  assert.match(gitCheckSource, /check-node-version\.cjs/);
  for (const scriptName of ["dev", "start", "check", "test"]) {
    assert.match(backendPackage.scripts[scriptName], /check:runtime/);
  }
  for (const scriptName of ["dev", "build", "lint", "preview", "test", "test:watch", "test:coverage"]) {
    assert.match(frontendPackage.scripts[scriptName], /check:runtime/);
  }
});
