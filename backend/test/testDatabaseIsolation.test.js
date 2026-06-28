const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { after, test } = require("node:test");
const {
  assertSafeTestRuntimePath,
  isPathAtOrInside,
} = require("./helpers/testDatabase");

const BACKEND_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(BACKEND_ROOT, "..");
const isolationTempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ims-isolation-regression-"));

after(() => {
  const stat = fs.lstatSync(isolationTempRoot);
  assert.equal(stat.isDirectory() && !stat.isSymbolicLink(), true);
  fs.rmSync(isolationTempRoot, { recursive: true, force: true });
});

const collectTestFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTestFiles(fullPath);
    return entry.isFile() && entry.name.endsWith(".test.js") ? [fullPath] : [];
  });

const runConnectionProbe = ({
  backupDir,
  dbPath,
  expectedCode,
  logDir,
  nodeEnv = "test",
  nodeTestContext = "",
}) => {
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
        if (error && error.code === ${JSON.stringify(expectedCode)}) process.exit(0);
        console.error(error && (error.stack || error.message) || error);
        process.exit(3);
      });
  `;

  return spawnSync(process.execPath, ["-e", childScript], {
    cwd: BACKEND_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: nodeEnv,
      NODE_TEST_CONTEXT: nodeTestContext,
      IMS_LOG_TO_FILE: "false",
      IMS_LOG_DIR: logDir,
      IMS_SQLITE_BACKUP_DIR: backupDir,
      IMS_SQLITE_DB_PATH: dbPath,
    },
  });
};

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
    if (!/configureTestDatabase[^\n]*require\(["']\.\/helpers\/testDatabase["']\)/m.test(source)
      && !/const\s*\{[^}]*configureTestDatabase[^}]*\}\s*=\s*require\(["']\.\/helpers\/testDatabase["']\)/m.test(source)) continue;

    const configureMatch = /const\s+\w+\s*=\s*configureTestDatabase\s*\(/m.exec(source);
    const sourceRequireMatch = /require\(["']\.\.\/(?:\.\.\/)?src\//m.exec(source);
    if (!configureMatch || (sourceRequireMatch && configureMatch.index > sourceRequireMatch.index)) {
      violations.push(path.relative(BACKEND_ROOT, filePath).replaceAll(path.sep, "/"));
    }
  }

  assert.deepEqual(violations, []);
});

test("helper menolak konfigurasi bila env atau connection sudah dimuat lebih dulu", () => {
  const safeRoot = path.join(isolationTempRoot, "late-import");
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
      IMS_LOG_DIR: path.join(safeRoot, "logs"),
      IMS_SQLITE_BACKUP_DIR: path.join(safeRoot, "backups"),
      IMS_SQLITE_DB_PATH: path.join(safeRoot, "safe.sqlite"),
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("npm test memaksa runtime temporary, memeriksa fingerprint, dan revalidasi cleanup", () => {
  const runnerSource = fs.readFileSync(
    path.join(BACKEND_ROOT, "scripts", "run-tests.cjs"),
    "utf8",
  );

  assert.match(runnerSource, /mkdtempSync\(path\.join\(os\.tmpdir\(\), "ims-backend-test-suite-"\)\)/);
  assert.match(runnerSource, /IMS_TEST_SUITE_MARKER: suiteMarker/);
  assert.match(runnerSource, /IMS_TEST_SUITE_ROOT: suiteRoot/);
  assert.match(runnerSource, /IMS_SQLITE_DB_PATH: runnerDbPath/);
  assert.match(runnerSource, /IMS_SQLITE_BACKUP_DIR: runnerBackupDir/);
  assert.match(runnerSource, /IMS_LOG_DIR: runnerLogDir/);
  assert.match(runnerSource, /captureRuntimeFingerprint\(\)/);
  assert.match(runnerSource, /TEST_RUNTIME_FINGERPRINT_CHANGED/);
  assert.match(runnerSource, /const currentSuiteRoot = assertSafeSuiteRoot\(suiteRoot\)/);
  assert.match(runnerSource, /markerStat\.isFile\(\)/);
  assert.match(runnerSource, /!markerStat\.isSymbolicLink\(\)/);
});

test("mode test menolak database, backup, dan log runtime walau import order salah", () => {
  const safeDbPath = path.join(isolationTempRoot, "runtime-guard", "safe.sqlite");
  const safeBackupDir = path.join(isolationTempRoot, "runtime-guard", "backups");
  const safeLogDir = path.join(isolationTempRoot, "runtime-guard", "logs");
  const unsafeDbPath = path.join(REPOSITORY_ROOT, "data", "__ims-test-isolation-must-not-exist.sqlite");
  const unsafeBackupDir = path.join(REPOSITORY_ROOT, "backups", "sqlite");
  const unsafeLogDir = path.join(REPOSITORY_ROOT, "logs");
  fs.rmSync(unsafeDbPath, { force: true });

  const unsafeDatabase = runConnectionProbe({
    backupDir: safeBackupDir,
    dbPath: unsafeDbPath,
    expectedCode: "TEST_DATABASE_RUNTIME_PATH_UNSAFE",
    logDir: safeLogDir,
  });
  assert.equal(unsafeDatabase.status, 0, unsafeDatabase.stderr || unsafeDatabase.stdout);

  const unsafeBackup = runConnectionProbe({
    backupDir: unsafeBackupDir,
    dbPath: safeDbPath,
    expectedCode: "TEST_BACKUP_RUNTIME_PATH_UNSAFE",
    logDir: safeLogDir,
  });
  assert.equal(unsafeBackup.status, 0, unsafeBackup.stderr || unsafeBackup.stdout);

  const unsafeLog = runConnectionProbe({
    backupDir: safeBackupDir,
    dbPath: safeDbPath,
    expectedCode: "TEST_LOG_RUNTIME_PATH_UNSAFE",
    logDir: unsafeLogDir,
  });
  assert.equal(unsafeLog.status, 0, unsafeLog.stderr || unsafeLog.stdout);

  const directNodeTest = runConnectionProbe({
    backupDir: safeBackupDir,
    dbPath: unsafeDbPath,
    expectedCode: "TEST_DATABASE_RUNTIME_PATH_UNSAFE",
    logDir: safeLogDir,
    nodeEnv: "",
    nodeTestContext: "child-v8",
  });
  assert.equal(directNodeTest.status, 0, directNodeTest.stderr || directNodeTest.stdout);
  assert.equal(fs.existsSync(unsafeDbPath), false);
});

test("direct node test mematikan file logging secara default", () => {
  const envModulePath = path.join(BACKEND_ROOT, "src", "config", "env.js");
  const safeRoot = path.join(isolationTempRoot, "direct-node-test");
  const result = spawnSync(process.execPath, [
    "-e",
    `const env = require(${JSON.stringify(envModulePath)}); process.stdout.write(JSON.stringify({ isTestRuntime: env.isTestRuntime, logToFile: env.logToFile }));`,
  ], {
    cwd: BACKEND_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "",
      NODE_TEST_CONTEXT: "child-v8",
      IMS_LOG_TO_FILE: "",
      IMS_LOG_DIR: path.join(safeRoot, "logs"),
      IMS_SQLITE_BACKUP_DIR: path.join(safeRoot, "backups"),
      IMS_SQLITE_DB_PATH: path.join(safeRoot, "safe.sqlite"),
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), { isTestRuntime: true, logToFile: false });
});


test("logger dan backup helper langsung tidak dapat menyentuh folder runtime saat node test", () => {
  const unsafeLogDir = path.join(REPOSITORY_ROOT, "logs", "__ims-test-log-must-not-exist");
  const unsafeBackupDir = path.join(REPOSITORY_ROOT, "backups", "__ims-test-backup-must-not-exist");
  fs.rmSync(unsafeLogDir, { recursive: true, force: true });
  fs.rmSync(unsafeBackupDir, { recursive: true, force: true });

  const loggerPath = path.join(BACKEND_ROOT, "src", "utils", "logger.js");
  const loggerResult = spawnSync(process.execPath, [
    "-e",
    `const logger = require(${JSON.stringify(loggerPath)}); logger.info("unsafe_log_probe");`,
  ], {
    cwd: BACKEND_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "",
      NODE_TEST_CONTEXT: "child-v8",
      IMS_LOG_TO_FILE: "true",
      IMS_LOG_DIR: unsafeLogDir,
      IMS_SQLITE_BACKUP_DIR: path.join(isolationTempRoot, "direct-helper", "backups"),
      IMS_SQLITE_DB_PATH: path.join(isolationTempRoot, "direct-helper", "safe.sqlite"),
    },
  });
  assert.equal(loggerResult.status, 0, loggerResult.stderr || loggerResult.stdout);
  assert.equal(fs.existsSync(unsafeLogDir), false);

  const backupPathModule = path.join(
    BACKEND_ROOT,
    "src",
    "modules",
    "maintenance",
    "backup",
    "backupPath.js",
  );
  const backupResult = spawnSync(process.execPath, [
    "-e",
    `
      const backupPath = require(${JSON.stringify(backupPathModule)});
      try {
        backupPath.getBackupTypeDir("manual");
        process.exit(2);
      } catch (error) {
        if (error && error.code === "TEST_RUNTIME_PATH_UNSAFE") process.exit(0);
        console.error(error && (error.stack || error.message) || error);
        process.exit(3);
      }
    `,
  ], {
    cwd: BACKEND_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_ENV: "",
      NODE_TEST_CONTEXT: "child-v8",
      IMS_LOG_TO_FILE: "false",
      IMS_LOG_DIR: path.join(isolationTempRoot, "direct-helper", "logs"),
      IMS_SQLITE_BACKUP_DIR: unsafeBackupDir,
      IMS_SQLITE_DB_PATH: path.join(isolationTempRoot, "direct-helper", "safe.sqlite"),
    },
  });
  assert.equal(backupResult.status, 0, backupResult.stderr || backupResult.stdout);
  assert.equal(fs.existsSync(unsafeBackupDir), false);
});

test("policy test membatasi direct SQLite dan destructive filesystem ke fixture temporary", () => {
  const directSqliteAllowlist = new Set(["test/maintenanceBackupRestore.test.js"]);
  const directSqliteViolations = [];
  const destructivePathViolations = [];
  const incompleteRuntimeOverrideViolations = [];

  for (const filePath of collectTestFiles(__dirname)) {
    const source = fs.readFileSync(filePath, "utf8");
    const relativePath = path.relative(BACKEND_ROOT, filePath).replaceAll(path.sep, "/");
    const hasDirectSqlite = /require\(["']sqlite3?["']\)/.test(source);
    if (hasDirectSqlite && !directSqliteAllowlist.has(relativePath)) {
      directSqliteViolations.push(relativePath);
    }

    const configuresDatabasePath = /IMS_SQLITE_DB_PATH/.test(source);
    if (configuresDatabasePath
      && (!/IMS_SQLITE_BACKUP_DIR/.test(source) || !/IMS_LOG_DIR/.test(source))) {
      incompleteRuntimeOverrideViolations.push(relativePath);
    }

    if (filePath === __filename) continue;
    const hasDestructiveFs = /fs\.(?:rmSync|unlinkSync|renameSync|rmdirSync)\s*\(/.test(source);
    const referencesTemporaryFixture = /os\.tmpdir\(\)|testDatabase\.(?:backupDir|tempDir|dbPath)|tempRepo|tempDir/.test(source);
    const referencesRuntimeLiteral = /ims-sqlite-sidecar\.sqlite|["'`]\.\.\/(?:data|backups|logs)(?:\/|["'`])/.test(source);
    if (hasDestructiveFs && (!referencesTemporaryFixture || referencesRuntimeLiteral)) {
      destructivePathViolations.push(relativePath);
    }
  }

  assert.deepEqual(directSqliteViolations, []);
  assert.deepEqual(incompleteRuntimeOverrideViolations, []);
  assert.deepEqual(destructivePathViolations, []);
});
