const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("stock-engine");
const {
  commitStockMutation,
  upsertJsonRecord,
} = require("../src/utils/sqliteStockEngine");

before(testDatabase.initialize);
beforeEach(testDatabase.reset);
after(testDatabase.cleanup);

const seedProduct = async (payload = {}) => {
  const db = await testDatabase.getDb();
  return upsertJsonRecord(db, "products", {
    id: "product-1",
    code: "PRD-001",
    name: "Bunga Flanel Test",
    currentStock: 5,
    reservedStock: 0,
    availableStock: 5,
    status: "active",
    isActive: true,
    ...payload,
  });
};

test("mutasi stok ditolak bila membuat stok minus tanpa partial write", async () => {
  await seedProduct();
  const db = await testDatabase.getDb();

  await assert.rejects(
    commitStockMutation(db, {
      sourceType: "product",
      sourceId: "product-1",
      deltaCurrent: -6,
      referenceNumber: "STK-NEGATIVE-001",
      actor: "tester",
    }),
    /Stok tersedia tidak mencukupi/
  );

  const product = await db.get("SELECT current_stock FROM products WHERE id = 'product-1'");
  const inventoryLogCount = await db.get("SELECT COUNT(*) AS count FROM inventory_logs");
  assert.equal(product.current_stock, 5);
  assert.equal(inventoryLogCount.count, 0);
});

test("item non-varian dengan variants kosong tetap dapat dimutasi di master", async () => {
  await seedProduct({
    hasVariants: false,
    variants: [],
  });
  const db = await testDatabase.getDb();

  const result = await commitStockMutation(db, {
    sourceType: "product",
    sourceId: "product-1",
    deltaCurrent: -2,
    referenceNumber: "STK-NON-VARIANT-001",
    actor: "tester",
  });

  assert.equal(result.item.currentStock, 3);
  assert.equal(result.item.availableStock, 3);
});

test("stock-out memakai availableStock dan menjaga reserved tidak melebihi current", async () => {
  await seedProduct({
    currentStock: 5,
    reservedStock: 4,
    availableStock: 1,
  });
  const db = await testDatabase.getDb();

  await assert.rejects(
    commitStockMutation(db, {
      sourceType: "product",
      sourceId: "product-1",
      deltaCurrent: -2,
      referenceNumber: "STK-RESERVED-001",
      actor: "tester",
    }),
    (error) => error.errorCode === "INVENTORY_AVAILABLE_STOCK_INSUFFICIENT",
  );

  const product = await db.get(
    "SELECT current_stock, reserved_stock, available_stock FROM products WHERE id = 'product-1'",
  );
  assert.deepEqual(product, {
    current_stock: 5,
    reserved_stock: 4,
    available_stock: 1,
  });
});

test("legacy variantOptions tetap dipakai ketika variants kosong", async () => {
  await seedProduct({
    hasVariants: false,
    variants: [],
    variantOptions: [{
      variantKey: "red",
      variantLabel: "Merah",
      currentStock: 5,
      reservedStock: 0,
      availableStock: 99,
      isActive: true,
    }],
  });
  const db = await testDatabase.getDb();

  const result = await commitStockMutation(db, {
    sourceType: "product",
    sourceId: "product-1",
    variantKey: "red",
    deltaCurrent: -2,
    referenceNumber: "STK-LEGACY-VARIANT-001",
    actor: "tester",
  });

  assert.equal(result.item.currentStock, 3);
  assert.equal(result.item.variants[0].currentStock, 3);
  assert.equal(result.item.variants[0].availableStock, 3);
  assert.equal(result.item.variantOptions[0].availableStock, 3);
});

test("mutasi normal menolak master nonaktif", async () => {
  await seedProduct({ status: "inactive", isActive: false });
  const db = await testDatabase.getDb();

  await assert.rejects(
    commitStockMutation(db, {
      sourceType: "product",
      sourceId: "product-1",
      deltaCurrent: 1,
      referenceNumber: "STK-INACTIVE-001",
      actor: "tester",
    }),
    (error) => error.errorCode === "INVENTORY_SOURCE_INACTIVE",
  );
});

test("item bervarian wajib memakai variantKey yang valid", async () => {
  await seedProduct({
    hasVariants: true,
    variants: [
      {
        variantKey: "red",
        variantLabel: "Merah",
        currentStock: 5,
        reservedStock: 0,
        availableStock: 5,
      },
    ],
  });
  const db = await testDatabase.getDb();

  await assert.rejects(
    commitStockMutation(db, {
      sourceType: "product",
      sourceId: "product-1",
      deltaCurrent: -1,
      referenceNumber: "STK-VARIANT-MISSING",
    }),
    /Pilih varian/
  );

  const result = await commitStockMutation(db, {
    sourceType: "product",
    sourceId: "product-1",
    variantKey: "red",
    deltaCurrent: -2,
    referenceNumber: "STK-VARIANT-RED",
    actor: "tester",
  });

  assert.equal(result.afterStock, 3);
  assert.equal(result.item.variants[0].currentStock, 3);
});

test("mutasi sukses menyelaraskan master, read model, inventory log, dan audit log", async () => {
  await seedProduct();
  const db = await testDatabase.getDb();

  await commitStockMutation(db, {
    sourceType: "product",
    sourceId: "product-1",
    deltaCurrent: 4,
    referenceNumber: "STK-IN-001",
    transactionType: "stock_adjustment",
    reason: "test_adjustment",
    actor: "tester",
  });

  const product = await db.get("SELECT current_stock, available_stock FROM products WHERE id = 'product-1'");
  const readModel = await db.get(
    "SELECT current_stock, available_stock FROM stock_read_models WHERE id = 'product__product-1'"
  );
  const inventoryLogCount = await db.get("SELECT COUNT(*) AS count FROM inventory_logs");
  const auditLogCount = await db.get(
    "SELECT COUNT(*) AS count FROM audit_logs WHERE module = 'stock' AND action = 'stock_adjustment'"
  );

  assert.deepEqual(product, { current_stock: 9, available_stock: 9 });
  assert.deepEqual(readModel, { current_stock: 9, available_stock: 9 });
  assert.equal(inventoryLogCount.count, 1);
  assert.equal(auditLogCount.count, 1);
});
