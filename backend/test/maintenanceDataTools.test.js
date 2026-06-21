const assert = require("node:assert/strict");
const fs = require("node:fs");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("maintenance-data-tools");
const {
  deleteOrphanStockReadModels,
  getDataQualityAudit,
  getStockReadModelMaintenanceAudit,
  rebuildStockReadModels,
} = require("../src/modules/maintenance/maintenance.service");

const insertProduct = async ({ id, code, name, currentStock = 0, reservedStock = 0 } = {}) => {
  const db = await testDatabase.getDb();
  const payload = {
    id,
    code,
    name,
    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock: currentStock - reservedStock,
    minStockAlert: 2,
    status: "active",
    isActive: true,
  };
  await db.run(
    `INSERT INTO products (
      id, code, name, status, is_active,
      current_stock, reserved_stock, available_stock, min_stock_alert,
      payload_json, created_at, updated_at
    ) VALUES (?, ?, ?, 'active', 1, ?, ?, ?, 2, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, code, name, currentStock, reservedStock, currentStock - reservedStock, JSON.stringify(payload)],
  );
};

before(testDatabase.initialize);
beforeEach(async () => {
  await testDatabase.reset();
  fs.rmSync(testDatabase.backupDir, { recursive: true, force: true });
  fs.mkdirSync(testDatabase.backupDir, { recursive: true });
});
after(testDatabase.cleanup);

test("audit dan rebuild stock read model hanya memperbaiki projection dengan pre-repair backup", async () => {
  await insertProduct({ id: "product-a", code: "PRD-A", name: "Produk A", currentStock: 8, reservedStock: 2 });

  const beforeAudit = await getStockReadModelMaintenanceAudit();
  assert.equal(beforeAudit.summary.missingCount, 1);
  assert.equal(beforeAudit.summary.executablePlanCount, 1);

  const result = await rebuildStockReadModels({ actor: "maintenance-tester" });
  assert.equal(result.updatedCount, 1);
  assert.equal(result.preRepairBackup.backupType, "pre-repair");
  assert.equal(fs.existsSync(result.preRepairBackup.path), true);

  const db = await testDatabase.getDb();
  const product = await db.get("SELECT current_stock, reserved_stock, available_stock FROM products WHERE id = 'product-a'");
  const readModel = await db.get("SELECT * FROM stock_read_models WHERE id = 'product__product-a'");
  const auditLog = await db.get("SELECT * FROM audit_logs WHERE action = 'stock_read_model_rebuild' ORDER BY id DESC LIMIT 1");

  assert.deepEqual(product, { current_stock: 8, reserved_stock: 2, available_stock: 6 });
  assert.equal(readModel.current_stock, 8);
  assert.equal(readModel.reserved_stock, 2);
  assert.equal(readModel.available_stock, 6);
  assert.equal(auditLog.actor, "maintenance-tester");

  const afterAudit = await getStockReadModelMaintenanceAudit();
  assert.equal(afterAudit.summary.executablePlanCount, 0);
});

test("cleanup orphan stock read model wajib keyword dan tidak menyentuh master", async () => {
  const db = await testDatabase.getDb();
  await db.run(
    `INSERT INTO stock_read_models (
      id, code, name, status, is_active,
      current_stock, reserved_stock, available_stock, payload_json,
      created_at, updated_at
    ) VALUES ('product__missing', 'ORPHAN', 'Orphan', 'active', 1, 0, 0, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [JSON.stringify({
      id: "product__missing",
      sourceType: "product",
      sourceCollection: "products",
      sourceId: "missing",
      name: "Orphan",
      currentStock: 0,
      reservedStock: 0,
      availableStock: 0,
    })],
  );

  const audit = await getStockReadModelMaintenanceAudit();
  assert.equal(audit.summary.orphanCount, 1);

  await assert.rejects(
    deleteOrphanStockReadModels({ confirmKeyword: "SALAH", actor: "maintenance-tester" }),
    (error) => error?.errorCode === "STOCK_READ_MODEL_CLEANUP_CONFIRMATION_REQUIRED",
  );
  assert.ok(await db.get("SELECT id FROM stock_read_models WHERE id = 'product__missing'"));

  const result = await deleteOrphanStockReadModels({
    confirmKeyword: "BERSIHKAN DATA STOK",
    actor: "maintenance-tester",
  });
  assert.equal(result.deletedCount, 1);
  assert.equal(fs.existsSync(result.preRepairBackup.path), true);
  assert.equal(await db.get("SELECT id FROM stock_read_models WHERE id = 'product__missing'"), undefined);
});

test("data quality audit read-only mendeteksi projection, backup registry, dan ledger yang tidak lengkap", async () => {
  await insertProduct({ id: "product-b", code: "PRD-B", name: "Produk B", currentStock: 4, reservedStock: 0 });
  const db = await testDatabase.getDb();
  await db.run(
    `INSERT INTO backup_logs (filename, path, size_bytes, status)
     VALUES ('missing.imsbackup', ?, 0, 'verified')`,
    [`${testDatabase.backupDir}/missing.imsbackup`],
  );
  await db.run(
    `INSERT INTO incomes (
      id, code, name, status, is_active, total_amount, transaction_date,
      source_type, source_id, payload_json, created_at, updated_at
    ) VALUES ('income-no-ledger', 'INC-NO-LEDGER', 'Income tanpa ledger', 'Tercatat', 1, 1000, CURRENT_TIMESTAMP,
      'cash_in_manual', 'income-no-ledger', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  );

  const audit = await getDataQualityAudit();
  const byKey = new Map(audit.categories.map((item) => [item.key, item]));

  assert.equal(audit.dryRun, true);
  assert.equal(byKey.get("database_integrity").count, 0);
  assert.equal(byKey.get("stock_read_models").count, 1);
  assert.equal(byKey.get("backup_registry").count, 1);
  assert.equal(byKey.get("finance_ledger_pairs").count, 1);
  assert.ok(audit.summary.issueCount >= 3);

  assert.equal(await db.get("SELECT id FROM stock_read_models WHERE id = 'product__product-b'"), undefined);
  assert.ok(await db.get("SELECT id FROM incomes WHERE id = 'income-no-ledger'"));
});
