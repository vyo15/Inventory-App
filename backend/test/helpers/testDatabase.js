const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPOSITORY_ROOT = path.resolve(__dirname, "../../..");
const TEST_RUNTIME_MODULES = [
  require.resolve("../../src/config/env"),
  require.resolve("../../src/db/connection"),
];

const RESET_TABLES = [
  "local_user_sessions",
  "users",
  "audit_logs",
  "backup_logs",
  "restore_logs",
  "migration_identity_map",
  "business_code_counters",
  "customers",
  "categories",
  "supplier_catalog_history",
  "supplier_catalog_offers",
  "suppliers",
  "stock_read_models",
  "stock_adjustments",
  "inventory_logs",
  "purchases",
  "sales",
  "returns",
  "incomes",
  "expenses",
  "money_movement_ledger",
  "products",
  "raw_materials",
  "semi_finished_materials",
  "production_steps",
  "production_employees",
  "production_profiles",
  "production_boms",
  "production_planning",
  "production_orders",
  "production_work_logs",
  "production_payrolls",
  "pricing_rules",
  "report_snapshots",
];

const createIsolationError = (code, message, details = {}) => {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
};

const isPathAtOrInside = (candidatePath, parentPath) => {
  const candidate = path.resolve(candidatePath);
  const parent = path.resolve(parentPath);
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`)
    && relative !== ".."
    && !path.isAbsolute(relative));
};

const resolveThroughExistingAncestor = (candidatePath) => {
  const resolvedCandidate = path.resolve(candidatePath);
  let existingAncestor = resolvedCandidate;
  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) break;
    existingAncestor = parent;
  }

  const realAncestor = fs.realpathSync(existingAncestor);
  return path.resolve(realAncestor, path.relative(existingAncestor, resolvedCandidate));
};

const assertSafeTestRuntimePath = (
  candidatePath,
  {
    label = "test runtime path",
    nodeEnv = process.env.NODE_ENV,
    repositoryRoot = REPOSITORY_ROOT,
    tempRoot = os.tmpdir(),
  } = {},
) => {
  if (nodeEnv !== "test") {
    throw createIsolationError(
      "TEST_DATABASE_NODE_ENV_REQUIRED",
      `${label} hanya boleh dipakai saat NODE_ENV=test.`,
      { candidatePath },
    );
  }

  const resolvedCandidate = candidatePath
    ? resolveThroughExistingAncestor(candidatePath)
    : "";
  const resolvedTempRoot = resolveThroughExistingAncestor(tempRoot);
  const resolvedRepositoryRoot = resolveThroughExistingAncestor(repositoryRoot);
  if (!resolvedCandidate
    || !isPathAtOrInside(resolvedCandidate, resolvedTempRoot)
    || isPathAtOrInside(resolvedCandidate, resolvedRepositoryRoot)) {
    throw createIsolationError(
      "TEST_DATABASE_PATH_UNSAFE",
      `${label} wajib berada di folder temporary sistem dan tidak boleh menunjuk ke source/data runtime project.`,
      {
        candidatePath,
        repositoryRoot: resolvedRepositoryRoot,
        tempRoot: resolvedTempRoot,
      },
    );
  }

  return resolvedCandidate;
};

const assertTestModulesNotLoaded = () => {
  const loadedModules = TEST_RUNTIME_MODULES.filter((modulePath) => require.cache[modulePath]);
  if (loadedModules.length === 0) return;

  throw createIsolationError(
    "TEST_DATABASE_IMPORT_ORDER_VIOLATION",
    "Database test harus dikonfigurasi sebelum config/env atau db/connection dimuat.",
    { loadedModules },
  );
};

const configureTestDatabase = (name = "backend") => {
  process.env.NODE_ENV = "test";
  assertTestModulesNotLoaded();

  const suiteRoot = assertSafeTestRuntimePath(
    process.env.IMS_TEST_SUITE_ROOT || os.tmpdir(),
    { label: process.env.IMS_TEST_SUITE_ROOT ? "IMS_TEST_SUITE_ROOT" : "system temporary root" },
  );
  fs.mkdirSync(suiteRoot, { recursive: true });

  const tempDir = fs.mkdtempSync(path.join(suiteRoot, `ims-${name}-`));
  const dbPath = path.join(tempDir, "ims-test.sqlite");
  const backupDir = path.join(tempDir, "backups");
  const logDir = path.join(tempDir, "logs");
  const markerPath = path.join(tempDir, ".ims-test-database");
  const markerValue = `${path.resolve(dbPath)}\n`;

  assertSafeTestRuntimePath(dbPath, { label: "IMS_SQLITE_DB_PATH" });
  assertSafeTestRuntimePath(backupDir, { label: "IMS_SQLITE_BACKUP_DIR" });
  assertSafeTestRuntimePath(logDir, { label: "IMS_LOG_DIR" });
  fs.writeFileSync(markerPath, markerValue, "utf8");

  process.env.IMS_SQLITE_DB_PATH = dbPath;
  process.env.IMS_SQLITE_BACKUP_DIR = backupDir;
  process.env.IMS_LOG_DIR = logDir;
  process.env.IMS_LOG_TO_FILE = "false";

  const {
    closeDb,
    getDb,
    getDbPath,
  } = require("../../src/db/connection");
  const { runMigrations } = require("../../src/db/migrate");

  const assertOwnedTestRuntime = () => {
    assertSafeTestRuntimePath(dbPath, { label: "database test" });
    assertSafeTestRuntimePath(backupDir, { label: "backup test" });
    assertSafeTestRuntimePath(logDir, { label: "log test" });

    const markerValid = fs.existsSync(markerPath)
      && fs.lstatSync(markerPath).isFile()
      && !fs.lstatSync(markerPath).isSymbolicLink()
      && fs.readFileSync(markerPath, "utf8") === markerValue;
    if (!markerValid) {
      throw createIsolationError(
        "TEST_DATABASE_MARKER_MISSING",
        "Marker kepemilikan database test tidak valid. Reset dan cleanup dibatalkan.",
        { markerPath },
      );
    }

    const activeDbPath = path.resolve(getDbPath());
    if (activeDbPath !== path.resolve(dbPath)) {
      throw createIsolationError(
        "TEST_DATABASE_PATH_MISMATCH",
        "Koneksi database aktif tidak menunjuk ke database temporary milik test. Operasi destructive dibatalkan.",
        { activeDbPath, expectedDbPath: path.resolve(dbPath) },
      );
    }
  };

  const initialize = async () => {
    assertOwnedTestRuntime();
    await runMigrations();
    return getDb();
  };

  const reset = async () => {
    assertOwnedTestRuntime();
    const db = await getDb();
    await db.exec("PRAGMA foreign_keys = OFF;");
    try {
      for (const tableName of RESET_TABLES) {
        await db.run(`DELETE FROM ${tableName}`);
      }
      await db.run(
        "DELETE FROM sqlite_sequence WHERE name IN ('users', 'local_user_sessions', 'audit_logs', 'suppliers', 'supplier_catalog_offers', 'supplier_catalog_history')",
      );
    } finally {
      await db.exec("PRAGMA foreign_keys = ON;");
    }
  };

  const cleanup = async () => {
    assertOwnedTestRuntime();
    await closeDb();
    assertOwnedTestRuntime();
    const tempDirStat = fs.lstatSync(tempDir);
    if (!tempDirStat.isDirectory() || tempDirStat.isSymbolicLink()) {
      throw createIsolationError(
        "TEST_DATABASE_CLEANUP_PATH_UNSAFE",
        "Folder database test berubah menjadi symlink atau bukan directory. Cleanup dibatalkan.",
        { tempDir },
      );
    }
    assertSafeTestRuntimePath(tempDir, { label: "folder cleanup database test" });
    fs.rmSync(tempDir, { recursive: true, force: true });
  };

  return {
    backupDir,
    cleanup,
    dbPath,
    getDb,
    initialize,
    logDir,
    reset,
    tempDir,
  };
};

module.exports = {
  assertSafeTestRuntimePath,
  assertTestModulesNotLoaded,
  configureTestDatabase,
  isPathAtOrInside,
};
