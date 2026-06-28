const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("returns-guard");
const { upsertJsonRecord } = require("../src/utils/sqliteStockEngine");
const {
  commitReturn,
  commitSale,
} = require("../src/modules/transactions/transactions.service");

before(testDatabase.initialize);
beforeEach(testDatabase.reset);
after(testDatabase.cleanup);

const seedProduct = async () => {
  const db = await testDatabase.getDb();
  return upsertJsonRecord(db, "products", {
    id: "product-return",
    code: "PRD-RETURN",
    name: "Produk Return Test",
    currentStock: 10,
    reservedStock: 0,
    availableStock: 10,
    status: "active",
    isActive: true,
  });
};

test("return wajib terkait sales dan qty kumulatif tidak boleh melebihi sisa", async () => {
  await seedProduct();

  await commitSale({
    actor: "tester",
    payload: {
      referenceNumber: "SALE-RETURN-001",
      status: "Diproses",
      totalAmount: 0,
      items: [{
        sourceType: "product",
        sourceId: "product-return",
        itemName: "Produk Return Test",
        quantity: 4,
      }],
    },
  });

  await commitReturn({
    actor: "tester",
    payload: {
      referenceNumber: "RET-001",
      relatedSaleId: "SALE-RETURN-001",
      items: [{ sourceType: "product", sourceId: "product-return", quantity: 3 }],
    },
  });

  await assert.rejects(
    commitReturn({
      actor: "tester",
      payload: {
        referenceNumber: "RET-002",
        relatedSaleId: "SALE-RETURN-001",
        items: [{ sourceType: "product", sourceId: "product-return", quantity: 2 }],
      },
    }),
    (error) => error.code === "RETURN_QUANTITY_EXCEEDS_SALE"
  );

  const db = await testDatabase.getDb();
  const product = await db.get("SELECT current_stock FROM products WHERE id = 'product-return'");
  const returnCount = await db.get("SELECT COUNT(*) AS count FROM returns");
  assert.equal(product.current_stock, 9);
  assert.equal(returnCount.count, 1);
});

test("return tanpa relatedSaleId ditolak sebelum mutasi stok", async () => {
  await seedProduct();

  await assert.rejects(
    commitReturn({
      actor: "tester",
      payload: {
        referenceNumber: "RET-NO-SALE",
        items: [{ sourceType: "product", sourceId: "product-return", quantity: 1 }],
      },
    }),
    (error) => error.code === "RELATED_SALE_REQUIRED"
  );

  const db = await testDatabase.getDb();
  const product = await db.get("SELECT current_stock FROM products WHERE id = 'product-return'");
  const inventoryLogCount = await db.get("SELECT COUNT(*) AS count FROM inventory_logs");
  assert.equal(product.current_stock, 10);
  assert.equal(inventoryLogCount.count, 0);
});

test("return menolak status deleted sebelum mutasi stok", async () => {
  await seedProduct();
  await commitSale({
    actor: "tester",
    payload: {
      referenceNumber: "SALE-RETURN-STATUS",
      status: "Diproses",
      totalAmount: 0,
      items: [{ sourceType: "product", sourceId: "product-return", quantity: 2 }],
    },
  });

  await assert.rejects(
    commitReturn({
      actor: "tester",
      payload: {
        referenceNumber: "RET-DELETED",
        relatedSaleId: "SALE-RETURN-STATUS",
        status: "deleted",
        items: [{ sourceType: "product", sourceId: "product-return", quantity: 1 }],
      },
    }),
    (error) => error.code === "INVALID_RETURN_STATUS",
  );

  const db = await testDatabase.getDb();
  const state = await db.get(`
    SELECT
      (SELECT current_stock FROM products WHERE id = 'product-return') AS stock,
      (SELECT COUNT(*) FROM returns) AS return_count,
      (SELECT COUNT(*) FROM inventory_logs
        WHERE json_extract(payload_json, '$.reason') = 'return') AS return_log_count
  `);
  assert.deepEqual(state, { stock: 8, return_count: 0, return_log_count: 0 });
});

test("return menolak refund payload dan tidak membuat expense atau ledger", async () => {
  await seedProduct();
  await commitSale({
    actor: "tester",
    payload: {
      referenceNumber: "SALE-RETURN-REFUND",
      status: "Diproses",
      totalAmount: 0,
      items: [{ sourceType: "product", sourceId: "product-return", quantity: 2 }],
    },
  });

  await assert.rejects(
    commitReturn({
      actor: "tester",
      payload: {
        referenceNumber: "RET-REFUND",
        relatedSaleId: "SALE-RETURN-REFUND",
        refundAmount: 100000,
        items: [{ sourceType: "product", sourceId: "product-return", quantity: 1 }],
      },
    }),
    (error) => error.code === "RETURN_REFUND_NOT_SUPPORTED",
  );

  const db = await testDatabase.getDb();
  const state = await db.get(`
    SELECT
      (SELECT current_stock FROM products WHERE id = 'product-return') AS stock,
      (SELECT COUNT(*) FROM returns) AS return_count,
      (SELECT COUNT(*) FROM expenses) AS expense_count,
      (SELECT COUNT(*) FROM money_movement_ledger) AS ledger_count
  `);
  assert.deepEqual(state, { stock: 8, return_count: 0, expense_count: 0, ledger_count: 0 });
});
