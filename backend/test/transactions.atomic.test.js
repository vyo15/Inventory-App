const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("transactions");
const { upsertJsonRecord } = require("../src/utils/sqliteStockEngine");
const {
  commitPurchase,
  commitSale,
  updateSaleStatus,
} = require("../src/modules/transactions/transactions.service");

before(testDatabase.initialize);
beforeEach(testDatabase.reset);
after(testDatabase.cleanup);

const seedProduct = async ({ id = "product-1", stock = 10 } = {}) => {
  const db = await testDatabase.getDb();
  return upsertJsonRecord(db, "products", {
    id,
    code: id.toUpperCase(),
    name: `Produk ${id}`,
    currentStock: stock,
    reservedStock: 0,
    availableStock: stock,
    status: "active",
    isActive: true,
  });
};

test("purchase menambah stok dan mencatat expense serta ledger secara atomic", async () => {
  await seedProduct();

  await commitPurchase({
    actor: "tester",
    payload: {
      referenceNumber: "PUR-TEST-001",
      transactionDate: "2026-06-20T00:00:00.000Z",
      totalAmount: 15000,
      items: [{ sourceType: "product", sourceId: "product-1", quantity: 3 }],
    },
  });

  const db = await testDatabase.getDb();
  const product = await db.get("SELECT current_stock FROM products WHERE id = 'product-1'");
  const purchaseCount = await db.get("SELECT COUNT(*) AS count FROM purchases");
  const expenseCount = await db.get("SELECT COUNT(*) AS count FROM expenses");
  const ledgerCount = await db.get("SELECT COUNT(*) AS count FROM money_movement_ledger");

  assert.equal(product.current_stock, 13);
  assert.equal(purchaseCount.count, 1);
  assert.equal(expenseCount.count, 1);
  assert.equal(ledgerCount.count, 1);
});

test("kegagalan item kedua me-rollback seluruh mutasi sale", async () => {
  await seedProduct();

  await assert.rejects(
    commitSale({
      actor: "tester",
      payload: {
        referenceNumber: "SALE-ROLLBACK-001",
        status: "Diproses",
        totalAmount: 25000,
        items: [
          { sourceType: "product", sourceId: "product-1", quantity: 2 },
          { sourceType: "product", sourceId: "product-missing", quantity: 1 },
        ],
      },
    }),
    /Item stok database lokal tidak ditemukan/
  );

  const db = await testDatabase.getDb();
  const product = await db.get("SELECT current_stock FROM products WHERE id = 'product-1'");
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM sales) AS sales_count,
      (SELECT COUNT(*) FROM inventory_logs) AS inventory_count,
      (SELECT COUNT(*) FROM stock_read_models) AS read_model_count,
      (SELECT COUNT(*) FROM incomes) AS income_count,
      (SELECT COUNT(*) FROM money_movement_ledger) AS ledger_count,
      (SELECT COUNT(*) FROM audit_logs) AS audit_count
  `);

  assert.equal(product.current_stock, 10);
  assert.deepEqual(counts, {
    sales_count: 0,
    inventory_count: 0,
    read_model_count: 0,
    income_count: 0,
    ledger_count: 0,
    audit_count: 0,
  });
});

test("income sale hanya dibuat sekali saat status pertama kali menjadi Selesai", async () => {
  await seedProduct();

  await commitSale({
    actor: "tester",
    payload: {
      referenceNumber: "SALE-INCOME-001",
      status: "Diproses",
      totalAmount: 30000,
      items: [{ sourceType: "product", sourceId: "product-1", quantity: 2 }],
    },
  });

  const db = await testDatabase.getDb();
  let incomeCount = await db.get("SELECT COUNT(*) AS count FROM incomes");
  assert.equal(incomeCount.count, 0);

  const firstUpdate = await updateSaleStatus({
    id: "SALE-INCOME-001",
    status: "Selesai",
    actor: "tester",
  });
  const repeatedUpdate = await updateSaleStatus({
    id: "SALE-INCOME-001",
    status: "Selesai",
    actor: "tester",
  });

  incomeCount = await db.get("SELECT COUNT(*) AS count FROM incomes");
  const ledgerCount = await db.get("SELECT COUNT(*) AS count FROM money_movement_ledger");
  assert.ok(firstUpdate.financeResult);
  assert.equal(repeatedUpdate.financeResult, null);
  assert.equal(incomeCount.count, 1);
  assert.equal(ledgerCount.count, 1);
});
