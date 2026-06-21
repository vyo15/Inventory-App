const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const source = fs.readFileSync(path.resolve(__dirname, "dev-all.cjs"), "utf8");

test("dev runner menunggu child exit dan tidak memotong graceful shutdown setelah 300 ms", () => {
  assert.match(source, /SHUTDOWN_TIMEOUT_MS\s*=\s*10_000/);
  assert.match(source, /finishShutdownIfReady/);
  assert.doesNotMatch(source, /setTimeout\(\(\)\s*=>\s*process\.exit\(exitCode\),\s*300\)/);
  assert.match(source, /isWindows\s*&&\s*\["SIGINT", "SIGHUP", "SIGBREAK"\]\.includes\(signal\)/);
  assert.match(source, /process\.on\("SIGHUP"/);
  assert.match(source, /process\.on\("SIGBREAK"/);
});
