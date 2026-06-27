const { getDb } = require("./connection");
const { SCHEMA_VERSION } = require("./schema");
const { safeJsonParse } = require("../utils/jsonUtils");

const OLD_REMOTE_STATUS_PREFIX = `${["fire", "base"].join("")}_`;
const OLD_REMOTE_SOURCE = ["fire", "store"].join("");
const HISTORICAL_IMPORT_SOURCE = "historical_import";
const OLD_INACTIVE_STATUS = ["leg", "acy_inactive"].join("");

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

async function seedRole(db, roleKey, label, description = "") {
  await db.run(
    `
      INSERT INTO roles (role_key, label, description, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(role_key) DO UPDATE SET
        label = excluded.label,
        description = excluded.description,
        updated_at = CURRENT_TIMESTAMP
    `,
    [roleKey, label, description]
  );
}

async function seedLocalRoles(db) {
  await seedRole(db, "administrator", "Administrator", "Akses penuh untuk setup, maintenance, dan modul guarded.");
  await seedRole(db, "user", "User", "Akses operasional harian sesuai route guard IMS.");
}

async function ensureColumn(db, tableName, columnName, columnDefinition) {
  const columns = await db.all(`PRAGMA table_info(${tableName})`);
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    await db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
  }
}



async function ensureCategorySchema(db) {
  await ensureColumn(db, "categories", "parent_id", "parent_id INTEGER");
  await ensureColumn(db, "categories", "sort_order", "sort_order INTEGER NOT NULL DEFAULT 0");

  // Compatibility: kategori lama bertipe general berasal dari menu kategori produk lama.
  await db.run(
    "UPDATE categories SET type = 'product_form' WHERE type IS NULL OR type = '' OR type = 'general'"
  );
  await db.run("UPDATE categories SET sort_order = 0 WHERE sort_order IS NULL");

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_categories_scope_parent_status
      ON categories (type, parent_id, status, sort_order, name);
  `);
}

async function ensureJsonRecordTable(db, tableName) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE,
      name TEXT,
      category_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      is_active INTEGER NOT NULL DEFAULT 1,
      current_stock INTEGER NOT NULL DEFAULT 0,
      reserved_stock INTEGER NOT NULL DEFAULT 0,
      available_stock INTEGER NOT NULL DEFAULT 0,
      min_stock_alert INTEGER NOT NULL DEFAULT 0,
      total_amount INTEGER NOT NULL DEFAULT 0,
      transaction_date TEXT,
      source_type TEXT,
      source_id TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_${tableName}_status
      ON ${tableName} (status);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_name
      ON ${tableName} (name);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_source
      ON ${tableName} (source_type, source_id);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_transaction_date
      ON ${tableName} (transaction_date DESC);
    CREATE INDEX IF NOT EXISTS idx_${tableName}_updated_at
      ON ${tableName} (updated_at DESC);
  `);
}

async function ensureFoundationJsonTables(db) {
  const tables = [
    'products',
    'raw_materials',
    'semi_finished_materials',
    'stock_read_models',
    'stock_adjustments',
    'inventory_logs',
    'purchases',
    'sales',
    'returns',
    'incomes',
    'expenses',
    'money_movement_ledger',
    'production_steps',
    'production_employees',
    'production_profiles',
    'production_boms',
    'production_planning',
    'production_orders',
    'production_work_logs',
    'production_payrolls',
    'report_snapshots',
  ];

  for (const tableName of tables) {
    await ensureJsonRecordTable(db, tableName);
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS migration_identity_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_key TEXT NOT NULL,
      legacy_source TEXT NOT NULL DEFAULT 'historical_import',
      legacy_id TEXT NOT NULL,
      sqlite_id TEXT NOT NULL,
      reference_code TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(module_key, legacy_source, legacy_id)
    );

    CREATE INDEX IF NOT EXISTS idx_migration_identity_map_sqlite_id
      ON migration_identity_map (sqlite_id);
  `);
}

async function ensurePricingRulesSchema(db) {
  // Pricing rules compatibility:
  // Database yang sudah pernah dibuat bisa memiliki table pricing_rules lama
  // tanpa kolom target_type/is_active. CREATE TABLE IF NOT EXISTS tidak menambah
  // kolom pada table existing, jadi kolom wajib ditambahkan secara idempotent.
  await ensureColumn(db, "pricing_rules", "code", "code TEXT");
  await ensureColumn(db, "pricing_rules", "name", "name TEXT");
  await ensureColumn(db, "pricing_rules", "target_type", "target_type TEXT NOT NULL DEFAULT 'raw_materials'");
  await ensureColumn(db, "pricing_rules", "status", "status TEXT NOT NULL DEFAULT 'active'");
  await ensureColumn(db, "pricing_rules", "is_active", "is_active INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "pricing_rules", "payload_json", "payload_json TEXT NOT NULL DEFAULT '{}'");
  await ensureColumn(db, "pricing_rules", "created_at", "created_at TEXT");
  await ensureColumn(db, "pricing_rules", "updated_at", "updated_at TEXT");

  await db.run("UPDATE pricing_rules SET target_type = 'raw_materials' WHERE target_type IS NULL OR target_type = ''");
  await db.run("UPDATE pricing_rules SET status = 'active' WHERE status IS NULL OR status = ''");
  await db.run("UPDATE pricing_rules SET is_active = 1 WHERE is_active IS NULL");
  await db.run("UPDATE pricing_rules SET payload_json = '{}' WHERE payload_json IS NULL OR payload_json = ''");

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_pricing_rules_target_status
      ON pricing_rules (target_type, status);
  `);
}


async function ensureSupplierCatalogSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS supplier_catalog_offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      variant_key TEXT NOT NULL DEFAULT '',
      variant_label TEXT,
      listing_name TEXT,
      channel TEXT,
      product_link TEXT,
      purchase_type TEXT NOT NULL DEFAULT 'online',
      purchase_unit TEXT,
      purchase_qty INTEGER NOT NULL DEFAULT 1,
      conversion_value INTEGER NOT NULL DEFAULT 1,
      stock_unit TEXT,
      supplier_item_price INTEGER NOT NULL DEFAULT 0,
      estimated_shipping_cost INTEGER NOT NULL DEFAULT 0,
      service_fee INTEGER NOT NULL DEFAULT 0,
      discount INTEGER NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      availability_status TEXT NOT NULL DEFAULT 'available',
      notes TEXT,
      last_checked_at TEXT,
      last_checked_by TEXT,
      price_updated_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_supplier_catalog_supplier_status
      ON supplier_catalog_offers (supplier_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_supplier_catalog_item
      ON supplier_catalog_offers (item_type, item_id, variant_key, status);

    CREATE TABLE IF NOT EXISTS supplier_catalog_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL,
      offer_id INTEGER,
      event_type TEXT NOT NULL,
      item_type TEXT,
      item_id TEXT,
      item_name TEXT,
      previous_price INTEGER,
      new_price INTEGER,
      result_status TEXT,
      description TEXT,
      metadata_json TEXT,
      actor TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
      FOREIGN KEY (offer_id) REFERENCES supplier_catalog_offers(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_supplier_catalog_history_supplier_created
      ON supplier_catalog_history (supplier_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_supplier_catalog_history_offer_created
      ON supplier_catalog_history (offer_id, created_at DESC, id DESC);
  `);
  await ensureColumn(
    db,
    "supplier_catalog_offers",
    "availability_status",
    "availability_status TEXT NOT NULL DEFAULT 'available'",
  );
}

async function migrateLegacySupplierCatalog(db) {
  const suppliers = await db.all(
    "SELECT id, payload_json FROM suppliers WHERE status != 'deleted' ORDER BY id ASC"
  );

  for (const supplier of suppliers) {
    const existing = await db.get(
      "SELECT COUNT(*) AS count FROM supplier_catalog_offers WHERE supplier_id = ?",
      [supplier.id]
    );
    if (Number(existing?.count || 0) > 0) continue;

    const payload = safeJsonParse(supplier.payload_json, {});
    const legacyDetails = Array.isArray(payload.materialDetails) ? payload.materialDetails : [];

    for (const detail of legacyDetails) {
      const itemId = String(detail.materialId || detail.rawMaterialId || '').trim();
      if (!itemId) continue;

      await db.run(
        `
          INSERT INTO supplier_catalog_offers (
            supplier_id, item_type, item_id, item_name, variant_key, variant_label,
            listing_name, channel, product_link, purchase_type, purchase_unit,
            purchase_qty, conversion_value, stock_unit, supplier_item_price,
            estimated_shipping_cost, service_fee, discount, status, notes,
            created_at, updated_at
          )
          VALUES (?, 'raw_material', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [
          supplier.id,
          itemId,
          String(detail.materialName || '').trim() || itemId,
          String(detail.variantKey || '').trim(),
          String(detail.variantLabel || '').trim(),
          String(detail.listingName || '').trim(),
          String(detail.channel || '').trim(),
          String(detail.productLink || '').trim(),
          detail.purchaseType === 'offline' ? 'offline' : 'online',
          String(detail.purchaseUnit || '').trim(),
          Math.max(1, Math.round(Number(detail.purchaseQty || 1))),
          Math.max(1, Math.round(Number(detail.conversionValue || 1))),
          String(detail.stockUnit || '').trim(),
          Math.max(0, Math.round(Number(detail.supplierItemPrice || 0))),
          Math.max(0, Math.round(Number(detail.estimatedShippingCost || 0))),
          Math.max(0, Math.round(Number(detail.serviceFee || 0))),
          Math.max(0, Math.round(Number(detail.discount || 0))),
          String(detail.note || '').trim(),
        ]
      );
    }
  }
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


async function normalizeHistoricalModuleRuntimeStatuses(db) {
  await db.run(`
    UPDATE module_migration_status
    SET status = 'sqlite_active',
        updated_at = CURRENT_TIMESTAMP
    WHERE status LIKE 'sqlite_atomic_%'
  `);

  await db.run(
    `
      UPDATE module_migration_status
      SET status = 'archived_inactive',
          updated_at = CURRENT_TIMESTAMP
      WHERE status LIKE ? OR status = ?
    `,
    [`${OLD_REMOTE_STATUS_PREFIX}%`, OLD_INACTIVE_STATUS]
  );

  await db.run(
    `
      UPDATE migration_identity_map
      SET legacy_source = ?
      WHERE legacy_source = ?
    `,
    [HISTORICAL_IMPORT_SOURCE, OLD_REMOTE_SOURCE]
  );
}

async function seedMigrationStatus(db) {
  const rows = [
    ["customers", "Customers", "sqlite_active", "read_write", "Customers aktif memakai layanan database lokal."],
    ["categories", "Categories", "sqlite_active", "read_write", "Categories aktif memakai layanan database lokal."],
    ["suppliers", "Suppliers", "sqlite_active", "read_write_master_payload", "Supplier master dan katalog restock terstruktur aktif; histori toko terpisah per supplier dan Pembelian tetap lewat layanan guarded."],
    ["pricing_rules", "Pricing Rules", "sqlite_active", "read_write_master", "Aturan harga aktif di database lokal; apply harga massal tetap melalui layanan resmi agar aman."],
    ["products", "Products", "sqlite_active", "read_write_master", "Master produk aktif; perubahan stok final wajib lewat stock engine."],
    ["raw_materials", "Raw Materials", "sqlite_active", "read_write_master", "Master bahan baku aktif; perubahan stok dari pembelian/produksi wajib lewat stock engine."],
    ["semi_finished", "Semi Finished", "sqlite_active", "read_write_master_stock", "Master semi finished aktif; penyesuaian stok didukung. Pemakaian material produksi/HPP tetap lewat batch production."],
    ["stock", "Stock Engine", "sqlite_active", "atomic_product_raw_semi", "Stock engine aktif untuk Produk, Bahan Baku, dan Semi Finished melalui layanan commit dan audit log."],
    ["purchases", "Purchases", "sqlite_active", "atomic_stock_finance", "Pembelian aktif untuk stok masuk Produk/Bahan Baku dan posting biaya finance."],
    ["sales", "Sales", "sqlite_active", "atomic_stock_finance", "Penjualan aktif untuk stok keluar Produk/Bahan Baku dan posting pemasukan saat selesai."],
    ["returns", "Returns", "sqlite_active", "product_raw_stock_restore_guarded_refund", "Retur aktif untuk pemulihan stok Produk/Bahan Baku. Refund/finance tetap guarded melalui aturan resmi."],
    ["finance", "Finance Ledger", "sqlite_active", "cash_in_cash_out_ledger", "Finance aktif untuk cash-in/cash-out manual dan ledger transaksi baru."],
    ["production", "Production", "sqlite_active", "production_runtime", "Production steps, employees, profiles, BOM, planning, orders, dan work logs memakai database lokal."],
    ["payroll_hpp", "Payroll & HPP", "sqlite_active", "payroll_paid_hpp", "Payroll final/paid dan HPP memakai data lokal; payroll paid memposting biaya finance."],
    ["reports", "Reports & Dashboard", "sqlite_active", "transactions_finance_stock", "Report service membaca transaksi, finance, dan snapshot stok dari database lokal."],
    ["auth", "Auth & Role Guard", "sqlite_active", "local_auth_only", "Auth lokal menjadi runtime final; dependency auth runtime arsip dihapus."],
    ["reset_restore", "Reset & Restore", "guarded", "confirm_keyword_required", "Restore guarded tersedia untuk administrator dengan backup otomatis dan keyword konfirmasi."],
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

    CREATE TABLE IF NOT EXISTS roles (
      role_key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      username_lower TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role) REFERENCES roles(role_key)
    );

    CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);

    CREATE TABLE IF NOT EXISTS local_user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT,
      ip_address TEXT,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_local_user_sessions_user_id ON local_user_sessions (user_id);
    CREATE INDEX IF NOT EXISTS idx_local_user_sessions_expires_at ON local_user_sessions (expires_at);

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

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_code TEXT UNIQUE,
      name TEXT NOT NULL,
      store_link TEXT,
      phone TEXT,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers (name);
    CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers (status);

    CREATE TABLE IF NOT EXISTS pricing_rules (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT 'raw_materials',
      status TEXT NOT NULL DEFAULT 'active',
      is_active INTEGER NOT NULL DEFAULT 1,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await ensurePricingRulesSchema(db);
  await ensureCategorySchema(db);
  await ensureColumn(db, "suppliers", "payload_json", "payload_json TEXT NOT NULL DEFAULT '{}'");
  await ensureSupplierCatalogSchema(db);
  await migrateLegacySupplierCatalog(db);
  await ensureFoundationJsonTables(db);

  await db.run(
    `
      INSERT INTO schema_meta (key, value, updated_at)
      VALUES ('schema_version', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `,
    [String(SCHEMA_VERSION)]
  );

  await seedSetting(db, "app_name", "IMS Bunga Flanel");
  await seedSetting(db, "server_mode", "sqlite_local_primary");
  await seedSetting(db, "guarded_modules", "reset_restore");
  await seedLocalRoles(db);
  await seedMigrationStatus(db);
  await normalizeHistoricalModuleRuntimeStatuses(db);
}

module.exports = { runMigrations };
