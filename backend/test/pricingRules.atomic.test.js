const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("pricing-rules-atomic");
const {
  applyPricingRuleBatch,
  createPricingRule,
} = require("../src/modules/pricingRules/pricingRules.service");
const { upsertJsonRecord } = require("../src/utils/sqliteStockEngine");
const { safeJsonParse } = require("../src/utils/jsonUtils");

before(testDatabase.initialize);
beforeEach(testDatabase.reset);
after(testDatabase.cleanup);

const seedProduct = async (id, price, currentStock = 5) => {
  const db = await testDatabase.getDb();
  return upsertJsonRecord(db, "products", {
    id,
    code: id.toUpperCase(),
    name: `Produk ${id}`,
    price,
    hppPerUnit: 1000,
    hasVariants: false,
    variants: [],
    currentStock,
    reservedStock: 0,
    availableStock: currentStock,
    status: "active",
    isActive: true,
  });
};

const readProductPayload = async (id) => {
  const db = await testDatabase.getDb();
  const row = await db.get("SELECT * FROM products WHERE id = ?", [id]);
  return { row, payload: safeJsonParse(row.payload_json, {}) };
};

test("apply pricing batch rollback seluruh item bila satu versi stale", async () => {
  const first = await seedProduct("product-1", 1500, 5);
  const second = await seedProduct("product-2", 1600, 7);
  const rule = await createPricingRule({
    id: "pricing-1",
    code: "PRC-001",
    name: "Harga Atomic",
    targetType: "products",
    isActive: true,
  }, "tester");

  await assert.rejects(
    applyPricingRuleBatch(rule.id, {
      targetType: "products",
      updates: [
        { itemId: first.id, expectedVersion: first.updatedAt, newPrice: 2000 },
        { itemId: second.id, expectedVersion: "stale-version", newPrice: 2100 },
      ],
    }, "tester"),
    (error) => error.errorCode === "INVENTORY_STALE_UPDATE",
  );

  const firstAfterFailure = await readProductPayload(first.id);
  const secondAfterFailure = await readProductPayload(second.id);
  assert.equal(firstAfterFailure.payload.price, 1500);
  assert.equal(secondAfterFailure.payload.price, 1600);
  assert.equal(firstAfterFailure.row.current_stock, 5);
  assert.equal(secondAfterFailure.row.current_stock, 7);
});

test("apply pricing batch mengubah harga atomic tanpa menyentuh stok dan HPP", async () => {
  const first = await seedProduct("product-1", 1500, 5);
  const second = await seedProduct("product-2", 1600, 7);
  const rule = await createPricingRule({
    id: "pricing-1",
    code: "PRC-001",
    name: "Harga Atomic",
    targetType: "products",
    isActive: true,
  }, "tester");

  const result = await applyPricingRuleBatch(rule.id, {
    targetType: "products",
    updates: [
      { itemId: first.id, expectedVersion: first.updatedAt, newPrice: 2000 },
      { itemId: second.id, expectedVersion: second.updatedAt, newPrice: 2100 },
    ],
  }, "tester");

  assert.equal(result.updatedCount, 2);
  const firstSaved = await readProductPayload(first.id);
  const secondSaved = await readProductPayload(second.id);
  assert.equal(firstSaved.payload.price, 2000);
  assert.equal(secondSaved.payload.price, 2100);
  assert.equal(firstSaved.payload.hppPerUnit, 1000);
  assert.equal(secondSaved.payload.hppPerUnit, 1000);
  assert.equal(firstSaved.row.current_stock, 5);
  assert.equal(secondSaved.row.current_stock, 7);

  const db = await testDatabase.getDb();
  const readModels = await db.get(
    "SELECT COUNT(*) AS count FROM stock_read_models WHERE id IN (?, ?)",
    ["product__product-1", "product__product-2"],
  );
  const batchAudit = await db.get(
    "SELECT COUNT(*) AS count FROM audit_logs WHERE module = 'pricing_rules' AND action = 'apply_batch'",
  );
  assert.equal(readModels.count, 2);
  assert.equal(batchAudit.count, 1);
});
