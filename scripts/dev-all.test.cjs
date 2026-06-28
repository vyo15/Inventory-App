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

const {
  TESTING_LAB_FLAG,
  buildRuntimeConfiguration,
  createSafeEnv,
  parseRunnerMode,
} = require("./dev-all.cjs");

test("npm runner membedakan mode operasional dan Lab Pengujian", () => {
  assert.deepEqual(parseRunnerMode([]), { testingLab: false });
  assert.deepEqual(parseRunnerMode([TESTING_LAB_FLAG]), { testingLab: true });
});

test("mode Lab menyuntikkan environment sandbox yang terpisah", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const config = buildRuntimeConfiguration({
    testingLab: true,
    projectRoot,
    baseEnv: {},
  });

  assert.equal(config.mode, "testing-lab");
  assert.equal(config.envOverrides.IMS_ENABLE_TESTING_LAB, "true");
  assert.equal(config.envOverrides.IMS_DATABASE_PURPOSE, "sandbox");
  assert.equal(config.envOverrides.IMS_SQLITE_DB_PATH, path.join(projectRoot, "data", "ims-testing-sandbox.sqlite"));
  assert.equal(config.envOverrides.IMS_SQLITE_BACKUP_DIR, path.join(projectRoot, "backups", "testing-sandbox"));
  assert.equal(config.envOverrides.IMS_LOG_DIR, path.join(projectRoot, "logs", "testing-sandbox"));
  assert.equal(
    config.envOverrides.IMS_OPERATIONAL_SOURCE_DB_PATH,
    path.join(projectRoot, "data", "ims-sqlite-sidecar.sqlite"),
  );
  assert.notEqual(config.databasePath, path.join(projectRoot, "data", "ims-sqlite-sidecar.sqlite"));
  assert.notEqual(config.backupDir, path.join(projectRoot, "backups", "sqlite"));
});

test("mode operasional membersihkan environment sandbox lama tanpa mengubah parent env", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const baseEnv = {
    PATH: process.env.PATH || "",
    IMS_ENABLE_TESTING_LAB: "true",
    IMS_DATABASE_PURPOSE: "sandbox",
    IMS_SQLITE_DB_PATH: "../data/ims-testing-sandbox.sqlite",
    IMS_SQLITE_BACKUP_DIR: "../backups/testing-sandbox",
    IMS_LOG_DIR: "../logs/testing-sandbox",
    IMS_OPERATIONAL_SOURCE_DB_PATH: "../data/custom-operational.sqlite",
  };
  const originalSnapshot = { ...baseEnv };
  const config = buildRuntimeConfiguration({
    testingLab: false,
    projectRoot,
    baseEnv,
  });
  const childEnv = createSafeEnv({
    baseEnv,
    runtime: config,
  });

  assert.equal(config.mode, "operational");
  const expectedOperationalPath = path.join(projectRoot, "data", "custom-operational.sqlite");
  assert.equal(config.databasePath, expectedOperationalPath);
  assert.equal(config.backupDir, path.join(projectRoot, "backups", "sqlite"));
  assert.equal(childEnv.IMS_ENABLE_TESTING_LAB, "false");
  assert.equal(childEnv.IMS_DATABASE_PURPOSE, "operational");
  assert.equal(childEnv.IMS_SQLITE_DB_PATH, expectedOperationalPath);
  assert.equal(childEnv.IMS_SQLITE_BACKUP_DIR, path.join(projectRoot, "backups", "sqlite"));
  assert.equal(childEnv.IMS_LOG_DIR, path.join(projectRoot, "logs"));
  assert.equal(childEnv.IMS_OPERATIONAL_SOURCE_DB_PATH, undefined);
  assert.deepEqual(baseEnv, originalSnapshot);
});

test("package menyediakan command lab tanpa mengubah npm test", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8"));
  assert.equal(packageJson.scripts.lab, "node scripts/dev-all.cjs --testing-lab");
  assert.match(packageJson.scripts.test, /npm --prefix backend test/);
  assert.match(packageJson.scripts.test, /npm --prefix frontend test/);
});

test("mode Lab meneruskan custom path operasional sebagai sumber clone read-only", () => {
  const projectRoot = path.resolve(__dirname, "..");
  const customOperationalPath = path.join(projectRoot, "data", "custom-operational.sqlite");
  const config = buildRuntimeConfiguration({
    testingLab: true,
    projectRoot,
    baseEnv: {
      IMS_DATABASE_PURPOSE: "operational",
      IMS_SQLITE_DB_PATH: customOperationalPath,
    },
  });

  assert.equal(config.databasePath, path.join(projectRoot, "data", "ims-testing-sandbox.sqlite"));
  assert.equal(config.envOverrides.IMS_OPERATIONAL_SOURCE_DB_PATH, customOperationalPath);
  assert.notEqual(config.envOverrides.IMS_OPERATIONAL_SOURCE_DB_PATH, config.databasePath);
});

