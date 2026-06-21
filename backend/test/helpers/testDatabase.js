const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const RESET_TABLES = [
  "local_user_sessions",
  "users",
  "audit_logs",
  "backup_logs",
  "restore_logs",
  "business_code_counters",
  "customers",
  "categories",
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

const configureTestDatabase = (name = "backend") => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `ims-${name}-`));
  const dbPath = path.join(tempDir, "ims-test.sqlite");
  const backupDir = path.join(tempDir, "backups");

  process.env.IMS_SQLITE_DB_PATH = dbPath;
  process.env.IMS_SQLITE_BACKUP_DIR = backupDir;

  const { closeDb, getDb } = require("../../src/db/connection");
  const { runMigrations } = require("../../src/db/migrate");

  const initialize = async () => {
    await runMigrations();
    return getDb();
  };

  const reset = async () => {
    const db = await getDb();
    await db.exec("PRAGMA foreign_keys = OFF;");
    try {
      for (const tableName of RESET_TABLES) {
        await db.run(`DELETE FROM ${tableName}`);
      }
      await db.run(
        "DELETE FROM sqlite_sequence WHERE name IN ('users', 'local_user_sessions', 'audit_logs')"
      );
    } finally {
      await db.exec("PRAGMA foreign_keys = ON;");
    }
  };

  const cleanup = async () => {
    await closeDb();
    fs.rmSync(tempDir, { recursive: true, force: true });
  };

  return {
    backupDir,
    cleanup,
    dbPath,
    getDb,
    initialize,
    reset,
    tempDir,
  };
};

module.exports = { configureTestDatabase };
