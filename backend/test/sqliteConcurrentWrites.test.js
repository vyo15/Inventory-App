const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { runInTransaction } = require("../src/db/connection");
const { formatBusinessDateStamp } = require("../src/utils/businessCodeCounter");
const { createCustomer, generateCustomerCode } = require("../src/modules/customers/customers.service");
const { createUser, updateUser } = require("../src/modules/auth/auth.service");
const { commitCashIn } = require("../src/modules/finance/finance.service");
const { commitPurchase } = require("../src/modules/transactions/transactions.service");
const { createSupplier } = require("../src/modules/suppliers/suppliers.service");
const { upsertJsonRecord } = require("../src/utils/sqliteStockEngine");
const {
  createPricingRule,
  generatePricingRuleCode,
} = require("../src/modules/pricingRules/pricingRules.service");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("concurrent-writes");

before(testDatabase.initialize);
beforeEach(testDatabase.reset);
after(testDatabase.cleanup);

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("dua finance commit paralel diserialisasi tanpa nested transaction atau partial ledger", async () => {
  const results = await Promise.all([
    commitCashIn({
      actor: "concurrency-a",
      payload: {
        id: "cash-in-concurrent-a",
        referenceNumber: "CSH-IN-CONCURRENT-A",
        amount: 11000,
        description: "Concurrent A",
      },
    }),
    commitCashIn({
      actor: "concurrency-b",
      payload: {
        id: "cash-in-concurrent-b",
        referenceNumber: "CSH-IN-CONCURRENT-B",
        amount: 22000,
        description: "Concurrent B",
      },
    }),
  ]);

  assert.equal(results.length, 2);
  const db = await testDatabase.getDb();
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM incomes) AS income_count,
      (SELECT COUNT(*) FROM money_movement_ledger) AS ledger_count,
      (SELECT COUNT(*) FROM audit_logs WHERE module = 'finance') AS audit_count
  `);
  assert.deepEqual(counts, { income_count: 2, ledger_count: 2, audit_count: 2 });
});


test("dua cash-in tanpa kode mendapat reference counter unik", async () => {
  const [first, second] = await Promise.all([
    commitCashIn({
      actor: "counter-a",
      payload: { amount: 12000, description: "Cash counter A", date: "2026-06-21" },
    }),
    commitCashIn({
      actor: "counter-b",
      payload: { amount: 13000, description: "Cash counter B", date: "2026-06-21" },
    }),
  ]);

  assert.notEqual(first.movement.referenceNumber, second.movement.referenceNumber);
  assert.match(first.movement.referenceNumber, /^CSH-IN-21062026-\d{3,}$/);
  assert.match(second.movement.referenceNumber, /^CSH-IN-21062026-\d{3,}$/);
});

test("dua purchase tanpa kode memakai counter tanggal dan menjaga stok serta ledger", async () => {
  const db = await testDatabase.getDb();
  await upsertJsonRecord(db, "products", {
    id: "product-concurrent-purchase",
    code: "PRD-CONCURRENT-PURCHASE",
    name: "Produk Concurrent Purchase",
    currentStock: 10,
    reservedStock: 0,
    availableStock: 10,
    status: "active",
    isActive: true,
  });

  const supplier = await createSupplier({
    name: "Supplier Concurrent Purchase",
    catalogOffers: [{
      itemType: "product",
      itemId: "product-concurrent-purchase",
      listingName: "Produk satuan",
      purchaseType: "offline",
      purchaseUnit: "pcs",
      conversionValue: 1,
      stockUnit: "pcs",
      supplierItemPrice: 10000,
    }],
  }, "tester");
  const offer = supplier.catalogOffers[0];

  const buildPayload = (totalAmount) => ({
    transactionDate: "2026-06-21",
    supplierId: supplier.id,
    supplierName: supplier.name,
    catalogOfferId: offer.id,
    sourceType: "product",
    sourceId: "product-concurrent-purchase",
    itemId: "product-concurrent-purchase",
    itemName: "Produk Concurrent Purchase",
    quantity: 1,
    qty: 1,
    subtotalItems: totalAmount,
    verifiedCatalogPrice: totalAmount,
    priceVerified: true,
    priceVerifiedAt: "2026-06-21T10:00:00.000Z",
    totalAmount,
    items: [{ sourceType: "product", sourceId: "product-concurrent-purchase", quantity: 1 }],
  });

  const [first, second] = await Promise.all([
    commitPurchase({ actor: "purchase-a", payload: buildPayload(10000) }),
    commitPurchase({ actor: "purchase-b", payload: buildPayload(11000) }),
  ]);

  assert.notEqual(first.referenceNumber, second.referenceNumber);
  assert.match(first.referenceNumber, /^PUR-21062026-\d{3,}$/);
  assert.match(second.referenceNumber, /^PUR-21062026-\d{3,}$/);

  const state = await db.get(`
    SELECT
      (SELECT current_stock FROM products WHERE id = 'product-concurrent-purchase') AS stock,
      (SELECT COUNT(*) FROM purchases) AS purchase_count,
      (SELECT COUNT(*) FROM expenses) AS expense_count,
      (SELECT COUNT(*) FROM money_movement_ledger) AS ledger_count
  `);
  assert.deepEqual(state, {
    stock: 12,
    purchase_count: 2,
    expense_count: 2,
    ledger_count: 2,
  });
});

test("failure transaction tidak meracuni queue dan write berikutnya tetap commit", async () => {
  const failedWrite = runInTransaction(async (db) => {
    await db.run(
      `INSERT INTO audit_logs (module, action, entity_type, entity_id, actor, description, metadata_json)
       VALUES ('test', 'forced_failure', 'test', 'rollback-me', 'tester', 'rollback', '{}')`,
    );
    throw new Error("forced rollback");
  });
  const successfulWrite = commitCashIn({
    actor: "queue-survivor",
    payload: {
      id: "cash-in-after-failure",
      referenceNumber: "CSH-IN-AFTER-FAILURE",
      amount: 33000,
      description: "Queue tetap sehat",
    },
  });

  const [failedResult, successfulResult] = await Promise.allSettled([
    failedWrite,
    successfulWrite,
  ]);
  assert.equal(failedResult.status, "rejected");
  assert.equal(successfulResult.status, "fulfilled");

  const db = await testDatabase.getDb();
  const rolledBack = await db.get("SELECT id FROM audit_logs WHERE entity_id = 'rollback-me'");
  const committed = await db.get("SELECT id FROM incomes WHERE id = 'cash-in-after-failure'");
  assert.equal(rolledBack, undefined);
  assert.ok(committed);
});

test("read request menunggu transaction aktif dan tidak melihat state sebelum commit", async () => {
  let releaseTransaction;
  let markTransactionStarted;
  const transactionStarted = new Promise((resolve) => {
    markTransactionStarted = resolve;
  });
  const transactionGate = new Promise((resolve) => {
    releaseTransaction = resolve;
  });

  const heldTransaction = runInTransaction(async (db) => {
    await db.run(
      `INSERT INTO audit_logs (module, action, entity_type, entity_id, actor, description, metadata_json)
       VALUES ('test', 'held', 'test', 'held-write', 'tester', 'held', '{}')`,
    );
    markTransactionStarted();
    await transactionGate;
  });

  await transactionStarted;
  const db = await testDatabase.getDb();
  let readResolved = false;
  const blockedRead = db.get(
    "SELECT COUNT(*) AS total FROM audit_logs WHERE entity_id = 'held-write'",
  ).then((row) => {
    readResolved = true;
    return row;
  });

  await delay(25);
  assert.equal(readResolved, false);
  releaseTransaction();
  await heldTransaction;
  const row = await blockedRead;
  assert.deepEqual(row, { total: 1 });
});

test("dua create customer dengan preview sama mendapat kode unik dari runtime counter", async () => {
  const previewCode = await generateCustomerCode();
  const [first, second] = await Promise.all([
    createCustomer({
      code: previewCode,
      name: "Customer Concurrent A",
      phone: "081111111111",
    }, "concurrency-a"),
    createCustomer({
      code: previewCode,
      name: "Customer Concurrent B",
      phone: "082222222222",
    }, "concurrency-b"),
  ]);

  assert.notEqual(first.customerCode, second.customerCode);
  assert.match(first.customerCode, /^CUS-\d{8}-\d{3,}$/);
  assert.match(second.customerCode, /^CUS-\d{8}-\d{3,}$/);

  const db = await testDatabase.getDb();
  const rows = await db.all("SELECT customer_code FROM customers ORDER BY customer_code ASC");
  const counter = await db.get(
    "SELECT last_number FROM business_code_counters WHERE counter_key LIKE 'customers:CUS:%'",
  );
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((row) => row.customer_code)).size, 2);
  assert.equal(counter.last_number, 2);
});


test("dua create pricing rule dengan preview sama mendapat kode dan ID unik", async () => {
  const previewCode = await generatePricingRuleCode();
  const [first, second] = await Promise.all([
    createPricingRule({
      id: previewCode,
      code: previewCode,
      name: "Pricing Concurrent A",
      targetType: "products",
      isActive: true,
    }, "concurrency-a"),
    createPricingRule({
      id: previewCode,
      code: previewCode,
      name: "Pricing Concurrent B",
      targetType: "products",
      isActive: true,
    }, "concurrency-b"),
  ]);

  assert.notEqual(first.code, second.code);
  assert.notEqual(first.id, second.id);
  assert.equal(first.id, first.code);
  assert.equal(second.id, second.code);

  const db = await testDatabase.getDb();
  const rows = await db.all("SELECT id, code FROM pricing_rules ORDER BY code ASC");
  const counter = await db.get(
    "SELECT last_number FROM business_code_counters WHERE counter_key = 'pricing_rules:PRC'",
  );
  assert.equal(rows.length, 2);
  assert.equal(new Set(rows.map((row) => row.code)).size, 2);
  assert.equal(new Set(rows.map((row) => row.id)).size, 2);
  assert.deepEqual(counter, { last_number: 2 });
});


test("managed code lama di bawah counter tidak dipakai ulang", async () => {
  const db = await testDatabase.getDb();
  await db.run(
    `INSERT INTO business_code_counters (counter_key, prefix, last_number, notes)
     VALUES ('pricing_rules:PRC', 'PRC', 5, 'simulasi gap')`,
  );

  const created = await createPricingRule({
    id: "PRC-003",
    code: "PRC-003",
    name: "Pricing Setelah Gap",
    targetType: "products",
    isActive: true,
  }, "counter-gap-test");

  assert.equal(created.code, "PRC-006");
  assert.equal(created.id, "PRC-006");
});

test("dua perubahan admin paralel tidak dapat menurunkan administrator aktif terakhir", async () => {
  const firstAdmin = await createUser({
    username: "admin.concurrent.a",
    displayName: "Admin Concurrent A",
    password: "ConcurrentAdmin8421",
    role: "administrator",
    status: "active",
  }, { id: 999, username: "test-root" });
  const secondAdmin = await createUser({
    username: "admin.concurrent.b",
    displayName: "Admin Concurrent B",
    password: "ConcurrentAdmin8421",
    role: "administrator",
    status: "active",
  }, { id: 999, username: "test-root" });

  const results = await Promise.allSettled([
    updateUser(firstAdmin.id, { role: "user", status: "active" }, { id: 999, username: "test-root" }),
    updateUser(secondAdmin.id, { role: "user", status: "active" }, { id: 999, username: "test-root" }),
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.equal(rejected.reason.code, "LAST_ADMIN_GUARD");

  const db = await testDatabase.getDb();
  const row = await db.get(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'administrator' AND status = 'active'",
  );
  assert.deepEqual(row, { total: 1 });
});

test("runtime counter mengambil baseline kode historis tanpa scan sequence di JavaScript", async () => {
  const db = await testDatabase.getDb();
  const prefix = `CUS-${formatBusinessDateStamp()}`;

  await db.run(
    `INSERT INTO customers (customer_code, name, phone, status)
     VALUES (?, 'Customer Legacy', '080000000000', 'active')`,
    [`${prefix}-007`],
  );

  const nextPreview = await generateCustomerCode();
  assert.equal(nextPreview, `${prefix}-008`);
  const created = await createCustomer({
    code: nextPreview,
    name: "Customer Setelah Legacy",
    phone: "083333333333",
  }, "counter-test");
  assert.equal(created.customerCode, `${prefix}-008`);

  const counter = await db.get(
    "SELECT last_number FROM business_code_counters WHERE counter_key LIKE 'customers:CUS:%'",
  );
  assert.deepEqual(counter, { last_number: 8 });
});

