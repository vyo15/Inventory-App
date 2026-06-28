process.env.IMS_AUTH_BOOTSTRAP_CODE = "TESTSETUP1234";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, beforeEach, test } = require("node:test");
const express = require("express");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("domain-error-routes");
const authRoutes = require("../src/modules/auth/auth.routes");
const authService = require("../src/modules/auth/auth.service");
const stockRoutes = require("../src/modules/stock/stock.routes");
const financeRoutes = require("../src/modules/finance/finance.routes");
const { errorHandler } = require("../src/middlewares/errorHandler");
const { getBootstrapCodeForConsole } = require("../src/modules/auth/authBootstrapGuard");
const { upsertJsonRecord } = require("../src/utils/sqliteStockEngine");

const ADMIN_PASSWORD = "Admin1234";
let server;
let baseUrl;
let cookiePair;

const startServer = async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/stock", stockRoutes);
  app.use("/api/finance", financeRoutes);
  app.use(errorHandler);

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
};

const stopServer = () => new Promise((resolve, reject) => {
  if (!server) return resolve();
  return server.close((error) => (error ? reject(error) : resolve()));
});

const request = (path, options = {}) => fetch(`${baseUrl}${path}`, {
  ...options,
  headers: {
    "content-type": "application/json",
    ...(cookiePair ? { cookie: cookiePair } : {}),
    ...(options.headers || {}),
  },
});

const bootstrapAndLogin = async () => {
  await authService.bootstrapAdmin({
    bootstrapCode: getBootstrapCodeForConsole(),
    username: "admin",
    displayName: "Administrator Test",
    password: ADMIN_PASSWORD,
  });
  const response = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username: "admin", password: ADMIN_PASSWORD }),
  });
  cookiePair = (response.headers.get("set-cookie") || "").split(";")[0];
  assert.equal(response.status, 200);
};

const seedProduct = async (payload = {}) => {
  const db = await testDatabase.getDb();
  return upsertJsonRecord(db, "products", {
    id: "product-http-1",
    code: "PRD-HTTP-001",
    name: "Produk HTTP Test",
    currentStock: 5,
    reservedStock: 0,
    availableStock: 5,
    status: "active",
    isActive: true,
    ...payload,
  });
};

before(async () => {
  await testDatabase.initialize();
  await startServer();
});

beforeEach(async () => {
  cookiePair = "";
  await testDatabase.reset();
  await bootstrapAndLogin();
});

after(async () => {
  await stopServer();
  await testDatabase.cleanup();
});

test("stock adjustment qty 0 menjadi HTTP 400 dan tidak meninggalkan partial write", async () => {
  await seedProduct();
  const response = await request("/api/stock/adjustments/commit", {
    method: "POST",
    body: JSON.stringify({
      sourceType: "product",
      sourceId: "product-http-1",
      quantity: 0,
      referenceNumber: "STK-HTTP-ZERO",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.errorCode, "STOCK_QUANTITY_ZERO");

  const db = await testDatabase.getDb();
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM stock_adjustments) AS adjustment_count,
      (SELECT COUNT(*) FROM inventory_logs) AS inventory_log_count
  `);
  assert.deepEqual(counts, { adjustment_count: 0, inventory_log_count: 0 });
});

test("stock item tidak ditemukan menjadi HTTP 404", async () => {
  const response = await request("/api/stock/adjustments/commit", {
    method: "POST",
    body: JSON.stringify({
      sourceType: "product",
      sourceId: "missing-product",
      quantity: 1,
      referenceNumber: "STK-HTTP-MISSING",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.equal(payload.errorCode, "STOCK_ITEM_NOT_FOUND");
});

test("stock source type tidak didukung menjadi HTTP 400", async () => {
  const response = await request("/api/stock/adjustments/commit", {
    method: "POST",
    body: JSON.stringify({
      sourceType: "unknown",
      sourceId: "anything",
      quantity: 1,
      referenceNumber: "STK-HTTP-TYPE",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.errorCode, "STOCK_SOURCE_TYPE_UNSUPPORTED");
});

test("item bervarian tanpa variantKey menjadi HTTP 400", async () => {
  await seedProduct({
    hasVariants: true,
    variants: [{
      variantKey: "red",
      variantLabel: "Merah",
      currentStock: 5,
      reservedStock: 0,
      availableStock: 5,
      isActive: true,
    }],
  });
  const response = await request("/api/stock/adjustments/commit", {
    method: "POST",
    body: JSON.stringify({
      sourceType: "product",
      sourceId: "product-http-1",
      quantity: -1,
      referenceNumber: "STK-HTTP-VARIANT",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.errorCode, "STOCK_VARIANT_REQUIRED");
});

test("duplicate reference stock menjadi HTTP 409 dengan kode domain", async () => {
  await seedProduct();
  const requestBody = {
    sourceType: "product",
    sourceId: "product-http-1",
    quantity: 1,
    referenceNumber: "STK-HTTP-DUPLICATE",
  };

  const first = await request("/api/stock/adjustments/commit", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
  assert.equal(first.status, 201);

  const second = await request("/api/stock/adjustments/commit", {
    method: "POST",
    body: JSON.stringify(requestBody),
  });
  const payload = await second.json();

  assert.equal(second.status, 409);
  assert.equal(payload.errorCode, "DUPLICATE_REFERENCE");
  assert.match(payload.message, /sudah pernah digunakan/i);
});

test("cash-in nominal 0 menjadi HTTP 400", async () => {
  const response = await request("/api/finance/cash-in/commit", {
    method: "POST",
    body: JSON.stringify({
      id: "cash-http-zero",
      referenceNumber: "CSH-IN-HTTP-ZERO",
      amount: 0,
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.errorCode, "FINANCE_AMOUNT_INVALID");
});

test("hapus cash-out yang tidak ada menjadi HTTP 404", async () => {
  const response = await request("/api/finance/cash-out/missing-cash-out", {
    method: "DELETE",
  });
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.equal(payload.errorCode, "FINANCE_RECORD_NOT_FOUND");
});
