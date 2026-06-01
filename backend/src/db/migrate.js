const { getDb } = require("./connection");
const { SCHEMA_VERSION } = require("./schema");

async function seedSetting(db, key, value) {
  await db.run(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO NOTHING
    `,
    [key, value]
  );
}


async function seedModuleMigrationStatus(db, moduleKey, status, { label, scope, notes } = {}) {
  await db.run(
    `
      INSERT INTO module_migration_status (module_key, label, status, scope, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(module_key) DO UPDATE SET
        label = excluded.label,
        status = excluded.status,
        scope = excluded.scope,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `,
    [moduleKey, label || moduleKey, status, scope || "", notes || ""]
  );
}

async function seedMigrationStatus(db) {
  const rows = [
    ["customers", "Customers", "sqlite_active", "read_write", "Pilot aman sudah memakai SQLite local sidecar."],
    ["categories", "Categories", "sqlite_active", "read_write", "Pilot aman sudah memakai SQLite local sidecar."],
    ["suppliers", "Suppliers", "firebase_only", "guarded_master", "Masih Firebase karena terkait purchase/raw/history."],
    ["products", "Products", "firebase_only", "guarded_master", "Belum dimigrasi karena terkait stock, sales, BOM, dan report."],
    ["raw_materials", "Raw Materials", "firebase_only", "guarded_master", "Belum dimigrasi karena terkait purchase, stock, production material usage."],
    ["semi_finished", "Semi Finished", "firebase_only", "guarded_master", "Belum dimigrasi karena terkait production flow dan stock."],
    ["stock", "Stock Engine", "guarded", "no_offline_mutation", "currentStock/reservedStock/availableStock harus atomic dan audited."],
    ["purchases", "Purchases", "guarded", "no_offline_final_transaction", "Purchase final menyentuh supplier, raw material, stock in, finance."],
    ["sales", "Sales", "guarded", "no_offline_final_transaction", "Sales final menyentuh customer snapshot, stock out, income."],
    ["returns", "Returns", "guarded", "no_offline_final_transaction", "Returns menyentuh sales, stock restore, refund rule."],
    ["finance", "Finance Ledger", "guarded", "no_local_recompute", "Ledger/profit-loss belum boleh dihitung ulang dari draft/local."],
    ["production", "Production", "guarded", "no_offline_final_transaction", "Production menyentuh material usage, payroll, HPP."],
    ["payroll_hpp", "Payroll & HPP", "guarded", "no_offline_final_transaction", "HPP final harus dari material actual dan payroll final/paid."],
    ["reports", "Reports & Dashboard", "firebase_primary_snapshot_pending", "read_only_snapshot_pending", "Report final belum boleh membaca draft/local yang belum committed."],
    ["auth", "Auth & Role Guard", "firebase_auth", "login_guard", "Login masih Firebase Auth; local auth perlu phase terpisah."],
    ["reset_restore", "Reset & Restore", "guarded", "preview_only", "Restore SQLite destructive belum aktif; baru restore-plan preview."],
  ];

  for (const [moduleKey, label, status, scope, notes] of rows) {
    await seedModuleMigrationStatus(db, moduleKey, status, { label, scope, notes });
  }
}

async function runMigrations() {
  const db = await getDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      description TEXT,
      metadata_json TEXT,
      actor TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_module_created_at
      ON audit_logs (module, created_at DESC);

    CREATE TABLE IF NOT EXISTS backup_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      path TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'success',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS restore_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      backup_path TEXT,
      plan_status TEXT NOT NULL DEFAULT 'preview_only',
      destructive_allowed INTEGER NOT NULL DEFAULT 0,
      summary_json TEXT,
      actor TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_restore_logs_created_at
      ON restore_logs (created_at DESC);

    CREATE TABLE IF NOT EXISTS module_migration_status (
      module_key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      status TEXT NOT NULL,
      scope TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_module_migration_status_status
      ON module_migration_status (status);

    CREATE TABLE IF NOT EXISTS business_code_counters (
      counter_key TEXT PRIMARY KEY,
      prefix TEXT NOT NULL,
      last_number INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_code TEXT UNIQUE,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);
    CREATE INDEX IF NOT EXISTS idx_customers_status ON customers (status);

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'general',
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);
    CREATE INDEX IF NOT EXISTS idx_categories_type ON categories (type);
    CREATE INDEX IF NOT EXISTS idx_categories_status ON categories (status);
  `);

  await db.run(
    `
      INSERT INTO schema_meta (key, value, updated_at)
      VALUES ('schema_version', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `,
    [String(SCHEMA_VERSION)]
  );

  await seedSetting(db, "app_name", "IMS Bunga Flanel");
  await seedSetting(db, "server_mode", "sqlite_local_primary_pilot");
  await seedSetting(db, "guarded_modules", "stock,sales,purchase,returns,finance,production,payroll,hpp,reset");
  await seedMigrationStatus(db);
}

module.exports = { runMigrations };
