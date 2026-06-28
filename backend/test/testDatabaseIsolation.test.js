const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const {
  assertSafeTestRuntimePath,
  isPathAtOrInside,
} = require("./helpers/testDatabase");

const BACKEND_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(BACKEND_ROOT, "..");

const collectTestFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTestFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".test.js") ? [fullPath] : [];
  });

test("guard path test hanya menerima runtime di folder temporary sistem", () => {
  const safePath = path.join(os.tmpdir(), "ims-isolation-check", "safe.sqlite");
  assert.equal(
    assertSafeTestRuntimePath(safePath, { nodeEnv: "test" }),
    path.resolve(safePath),
  );
  assert.equal(isPathAtOrInside(safePath, os.tmpdir()), true);

  assert.throws(
    () => assertSafeTestRuntimePath(
      path.join(REPOSITORY_ROOT, "data", "ims-sqlite-sidecar.sqlite"),
      { nodeEnv: "test" },
    ),
    (error) => error?.code === "TEST_DATABASE_PATH_UNSAFE",
  );
  assert.throws(
    () => assertSafeTestRuntimePath(safePath, { nodeEnv: "production" }),
    (error) => error?.code === "TEST_DATABASE_NODE_ENV_REQUIRED",
  );
});

test("seluruh database integration test mengonfigurasi database sebelum import source", () => {
  const violations = [];
  for (const filePath of collectTestFiles(__dirname)) {
    const source = fs.readFileSync(filePath, "utf8");
    if (!/const\s*\{[^}]*configureTestDatabase[^}]*\}\s*=\s*require\(["']\.\/helpers\/testDatabase["']\)/m.test(source)) continue;

    const configureMatch = /const\s+\w+\s*=\s*configureTestDatabase\s*\(/m.exec(source);
    const sourceRequireMatch = /require\(["']\.\.\/(?:\.\.\/)?src\//m.exec(source);
    if (!configureMatch || (sourceRequireMatch && configureMatch.index > sourceRequireMatch.index)) {
      violations.push(path.relative(BACKEND_ROOT, filePath).replaceAll(path.sep, "/"));
    }
  }

  assert.deepEqual(violations, []);
});



test("helper menolak konfigurasi bila env atau connection sudah dimuat lebih dulu", () => {
  const safeDbPath = path.join(os.tmpdir(), "ims-import-order-guard", "safe.sqlite");
  const connectionPath = path.join(BACKEND_ROOT, "src", "db", "connection.js");
  const helperPath = path.join(BACKEND_ROOT, "test", "helpers", "testDatabase.js");
  const childScript = `
    const Module = require("node:module");
    const originalLoad = Module._load;
    Module._load = function patchedLoad(request, parent, isMain) {
      if (request === "sqlite3") return { Database: function Database() {} };
      if (request === "sqlite") return { open: async () => ({}) };
      return originalLoad.call(this, request, parent, isMain);
    };
    require(${JSON.stringify(connectionPath)});
    const { configureTestDatabase } = require(${JSON.stringify(helperPath)});
    try {
      configureTestDatabase("late-import");
      process.exit(2);
    } catch (error) {
      if (error && error.code === "TEST_DATABASE_IMPORT_ORDER_VIOLATION") process.exit(0);
      console.error(error && (error.stack || error.message) || error);
      process.exit(3);
    }
  `;

  const result = spawnSync(process.execPath, ["-e", childScript], {
    cwd: BACKEND_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "test",
      IMS_LOG_TO_FILE: "false",
      IMS_SQLITE_DB_PATH: safeDbPath,
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("npm test memaksa database, backup, dan log ke suite temporary", () => {
  const runnerSource = fs.readFileSync(
    path.join(BACKEND_ROOT, "scripts", "run-tests.cjs"),
    "utf8",
  );

  assert.match(runnerSource, /mkdtempSync\(path\.join\(os\.tmpdir\(\), "ims-backend-test-suite-"\)\)/);
  assert.match(runnerSource, /IMS_TEST_SUITE_ROOT: suiteRoot/);
  assert.match(runnerSource, /IMS_SQLITE_DB_PATH: runnerDbPath/);
  assert.match(runnerSource, /IMS_SQLITE_BACKUP_DIR: runnerBackupDir/);
  assert.match(runnerSource, /IMS_LOG_DIR: runnerLogDir/);
  assert.match(runnerSource, /fs\.rmSync\(suiteRoot, \{ recursive: true, force: true \}\)/);
});

test("mode test menolak membuka database runtime walau import order salah", () => {
  const unsafeDbPath = path.join(
    REPOSITORY_ROOT,
    "data",
    "__ims-test-isolation-must-not-exist.sqlite",
  );
  fs.rmSync(unsafeDbPath, { force: true });

  const connectionPath = path.join(BACKEND_ROOT, "src", "db", "connection.js");
  const childScript = `
    const Module = require("node:module");
    const originalLoad = Module._load;
    Module._load = function patchedLoad(request, parent, isMain) {
      if (request === "sqlite3") return { Database: function Database() {} };
      if (request === "sqlite") {
        return { open: async () => { throw new Error("SQLITE_OPEN_REACHED"); } };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    const { getDb } = require(${JSON.stringify(connectionPath)});
    getDb()
      .then((db) => db.get("SELECT 1"))
      .then(() => process.exit(2))
      .catch((error) => {
        if (error && error.code === "TEST_DATABASE_RUNTIME_PATH_UNSAFE") process.exit(0);
        console.error(error && (error.stack || error.message) || error);
        process.exit(3);
      });
  `;

  const runUnsafeOpenAttempt = (envOverrides) => spawnSync(process.execPath, ["-e", childScript], {
    cwd: BACKEND_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      IMS_LOG_TO_FILE: "false",
      IMS_SQLITE_DB_PATH: unsafeDbPath,
      ...envOverrides,
    },
  });

  const npmTestResult = runUnsafeOpenAttempt({ NODE_ENV: "test" });
  assert.equal(npmTestResult.status, 0, npmTestResult.stderr || npmTestResult.stdout);

  const directNodeTestResult = runUnsafeOpenAttempt({
    NODE_ENV: "",
    NODE_TEST_CONTEXT: "child-v8",
  });
  assert.equal(
    directNodeTestResult.status,
    0,
    directNodeTestResult.stderr || directNodeTestResult.stdout,
  );
  assert.equal(fs.existsSync(unsafeDbPath), false);
});
