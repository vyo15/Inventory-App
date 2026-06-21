const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const source = fs.readFileSync(path.resolve(__dirname, "dev-all.cjs"), "utf8");

test("dev runner menjalankan backend dan Vite langsung tanpa wrapper npm atau nodemon", () => {
  assert.match(source, /assertSupportedNodeVersion/);
  assert.match(source, /backendEntry\s*=\s*path\.join\(backendDir, "src", "server\.js"\)/);
  assert.match(source, /frontendEntry\s*=\s*path\.join\(frontendDir, "node_modules", "vite", "bin", "vite\.js"\)/);
  assert.match(source, /spawn\(process\.execPath, \[entry, \.\.\.args\]/);
  assert.doesNotMatch(source, /--prefix", "backend", "run", "dev"/);
  assert.doesNotMatch(source, /nodemon/);
  assert.doesNotMatch(source, /shell:\s*isWindows/);
});

test("dev runner meminta shutdown backend melalui IPC sebelum menghentikan frontend", () => {
  assert.match(source, /SHUTDOWN_REQUEST:\s*"IMS_SHUTDOWN_REQUEST"/);
  assert.match(source, /SHUTDOWN_COMPLETED:\s*"IMS_SHUTDOWN_COMPLETED"/);
  assert.match(source, /requestBackendShutdown\(reason\)/);
  assert.match(source, /child\.send\(\{[\s\S]*type:\s*IPC_MESSAGES\.SHUTDOWN_REQUEST/);
  assert.match(source, /backend menutup database dengan aman/);
  assert.match(source, /if \(message\?\.type !== IPC_MESSAGES\.SHUTDOWN_COMPLETED\) return;[\s\S]*stopFrontend\(\)/);
});

test("dev runner tetap memiliki timeout fallback tanpa fixed exit 300 ms", () => {
  assert.match(source, /SHUTDOWN_TIMEOUT_MS\s*=\s*10_000/);
  assert.match(source, /forceStopRemaining/);
  assert.match(source, /finishShutdownIfReady/);
  assert.doesNotMatch(source, /setTimeout\(\(\)\s*=>\s*process\.exit\(exitCode\),\s*300\)/);
  assert.match(source, /process\.on\("SIGINT"/);
  assert.match(source, /process\.on\("SIGHUP"/);
  assert.match(source, /process\.on\("SIGBREAK"/);
});
