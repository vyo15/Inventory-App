const assert = require("node:assert/strict");
const fs = require("node:fs");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("maintenance-initial-setup-readiness");
const {
  createBackup,
  getInitialSetupReadiness,
} = require("../src/modules/maintenance/maintenance.service");

const insertJsonRecord = async (tableName, {
  id,
  code,
  name,
  currentStock = 0,
  sourceType = null,
  sourceId = null,
  payload = {},
} = {}) => {
  const db = await testDatabase.getDb();
  await db.run(
    `
      INSERT INTO ${tableName} (
        id, code, name, status, is_active, current_stock,
        reserved_stock, available_stock, source_type, source_id, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, 'active', 1, ?, 0, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [
      id,
      code,
      name,
      currentStock,
      currentStock,
      sourceType,
      sourceId,
      JSON.stringify({ id, code, name, currentStock, sourceType, sourceId, ...payload }),
    ],
  );
};

const seedRequiredSetup = async ({ productStock = 0 } = {}) => {
  const db = await testDatabase.getDb();
  for (const [code, name, type] of [
    ["CAT-PRODUCT", "Bouquet", "product_form"],
    ["CAT-FLOWER", "Mawar", "flower_type"],
    ["CAT-MATERIAL", "Kain Flanel", "raw_material_group"],
  ]) {
    await db.run(
      "INSERT INTO categories (code, name, type, status) VALUES (?, ?, ?, 'active')",
      [code, name, type],
    );
  }

  await insertJsonRecord("products", {
    id: "product-1",
    code: "PRD-001",
    name: "Bouquet Mawar",
    currentStock: productStock,
  });
  await insertJsonRecord("raw_materials", {
    id: "material-1",
    code: "RM-001",
    name: "Flanel Merah",
  });
  await insertJsonRecord("production_steps", {
    id: "step-1",
    code: "STEP-001",
    name: "Rakit Bunga",
  });
  await insertJsonRecord("production_employees", {
    id: "employee-1",
    code: "EMP-001",
    name: "Operator Produksi",
  });
  await insertJsonRecord("production_boms", {
    id: "bom-1",
    code: "BOM-001",
    name: "BOM Bouquet Mawar",
  });

  const supplier = await db.run(
    "INSERT INTO suppliers (supplier_code, name, status, payload_json) VALUES ('SUP-001', 'Toko Flanel', 'active', '{}')",
  );
  await db.run(
    `
      INSERT INTO supplier_catalog_offers (
        supplier_id, item_type, item_id, item_name, status, availability_status
      ) VALUES (?, 'raw_material', 'material-1', 'Flanel Merah', 'active', 'available')
    `,
    [supplier.lastID],
  );
};

before(testDatabase.initialize);
beforeEach(async () => {
  await testDatabase.reset();
  fs.rmSync(testDatabase.backupDir, { recursive: true, force: true });
  fs.mkdirSync(testDatabase.backupDir, { recursive: true });
});
after(testDatabase.cleanup);

test("database kosong menampilkan seluruh langkah setup sebagai belum siap", async () => {
  const readiness = await getInitialSetupReadiness();

  assert.equal(readiness.isComplete, false);
  assert.equal(readiness.progress.completedRequiredSteps, 0);
  assert.equal(readiness.progress.requiredStepCount, 8);
  assert.deepEqual(Object.values(readiness.flags), Array(8).fill(false));
});

test("setup master lengkap menjadi siap setelah backup baseline verified dibuat", async () => {
  await seedRequiredSetup();

  const beforeBackup = await getInitialSetupReadiness();
  assert.equal(beforeBackup.flags.categoriesReady, true);
  assert.equal(beforeBackup.flags.masterItemsReady, true);
  assert.equal(beforeBackup.flags.supplierCatalogReady, true);
  assert.equal(beforeBackup.flags.productionStepsReady, true);
  assert.equal(beforeBackup.flags.productionEmployeesReady, true);
  assert.equal(beforeBackup.flags.productionBomsReady, true);
  assert.equal(beforeBackup.flags.openingStockReady, true);
  assert.equal(beforeBackup.flags.baselineBackupReady, false);
  assert.equal(beforeBackup.progress.completedRequiredSteps, 7);

  await createBackup({ type: "manual", actor: "setup-tester" });
  const afterBackup = await getInitialSetupReadiness();

  assert.equal(afterBackup.flags.baselineBackupReady, true);
  assert.equal(afterBackup.isComplete, true);
  assert.equal(afterBackup.progress.completedRequiredSteps, 8);
});

test("stok positif tanpa histori resmi ditandai perlu audit", async () => {
  await seedRequiredSetup({ productStock: 3 });

  const beforeLog = await getInitialSetupReadiness();
  assert.equal(beforeLog.flags.openingStockReady, false);
  assert.equal(beforeLog.diagnostics.positiveStockWithoutHistory, true);

  await insertJsonRecord("inventory_logs", {
    id: "log-unrelated",
    code: "LOG-UNRELATED",
    name: "Histori item lain",
    sourceType: "raw_material",
    sourceId: "material-1",
  });

  const afterUnrelatedLog = await getInitialSetupReadiness();
  assert.equal(afterUnrelatedLog.flags.openingStockReady, false);
  assert.equal(afterUnrelatedLog.diagnostics.positiveStockWithoutHistoryItems, 1);

  await insertJsonRecord("inventory_logs", {
    id: "log-product-1",
    code: "LOG-001",
    name: "Stok Awal Bouquet",
    sourceType: "product",
    sourceId: "product-1",
  });

  const afterLog = await getInitialSetupReadiness();
  assert.equal(afterLog.flags.openingStockReady, true);
  assert.equal(afterLog.diagnostics.positiveStockWithoutHistory, false);
});
