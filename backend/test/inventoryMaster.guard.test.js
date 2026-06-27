process.env.IMS_AUTH_BOOTSTRAP_CODE = "INVENTORYTEST1234";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, beforeEach, test } = require("node:test");
const express = require("express");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("inventory-master-guard");
const authService = require("../src/modules/auth/auth.service");
const productsRoutes = require("../src/modules/products/products.routes");
const rawMaterialsRoutes = require("../src/modules/rawMaterials/rawMaterials.routes");
const semiFinishedRoutes = require("../src/modules/semiFinishedMaterials/semiFinishedMaterials.routes");
const stockReadModelsRoutes = require("../src/modules/stockReadModels/stockReadModels.routes");
const { errorHandler } = require("../src/middlewares/errorHandler");
const { getBootstrapCodeForConsole } = require("../src/modules/auth/authBootstrapGuard");
const { commitStockMutation, upsertJsonRecord } = require("../src/utils/sqliteStockEngine");

const ADMIN_PASSWORD = "Admin1234";
let server;
let baseUrl;
let authCookie;

const startServer = async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/products", productsRoutes);
  app.use("/api/raw-materials", rawMaterialsRoutes);
  app.use("/api/semi-finished-materials", semiFinishedRoutes);
  app.use("/api/stock-read-models", stockReadModelsRoutes);
  app.use(errorHandler);

  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
};

const stopServer = () => new Promise((resolve, reject) => {
  if (!server) return resolve();
  return server.close((error) => (error ? reject(error) : resolve()));
});

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      cookie: authCookie,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  return { response, payload };
};

const createRecord = async (endpoint, payload) => request(endpoint, {
  method: "POST",
  body: JSON.stringify(payload),
});

const updateRecord = async (endpoint, id, payload) => request(`${endpoint}/${id}`, {
  method: "PUT",
  body: JSON.stringify(payload),
});

const getRecord = async (endpoint, id) => request(`${endpoint}/${id}`);


const seedRawMaterialCategory = async ({ id = 1, name = "Kelompok Bahan Test" } = {}) => {
  const db = await testDatabase.getDb();
  await db.run(
    `INSERT INTO categories (id, code, name, type, status, notes)
     VALUES (?, ?, ?, 'raw_material_group', 'active', '')`,
    [id, `BAHAN-TEST-${id}`, name],
  );
  return id;
};

const loginAdministrator = async () => {
  await authService.bootstrapAdmin({
    bootstrapCode: getBootstrapCodeForConsole(),
    username: "admin",
    displayName: "Administrator Inventory Test",
    password: ADMIN_PASSWORD,
  });
  const session = await authService.login({ username: "admin", password: ADMIN_PASSWORD });
  authCookie = `ims_session=${encodeURIComponent(session.token)}`;
};

before(async () => {
  await testDatabase.initialize();
  await startServer();
});

beforeEach(async () => {
  await testDatabase.reset();
  await loginAdministrator();
});

after(async () => {
  await stopServer();
  await testDatabase.cleanup();
});

test("edit Product stale ditolak dan edit metadata valid mempertahankan stok/HPP terbaru", async () => {
  const created = await createRecord("/api/products", {
    id: "product-guard-1",
    code: "PRD-GUARD-1",
    name: "Produk Guard",
    hasVariants: true,
    hppPerUnit: 1200,
    variants: [{
      variantKey: "red",
      variantLabel: "Merah",
      color: "Merah",
      currentStock: 5,
      reservedStock: 0,
      hppPerUnit: 1300,
      isActive: true,
    }],
  });

  assert.equal(created.response.status, 201);
  const staleVersion = created.payload.data.versionToken;
  const db = await testDatabase.getDb();

  await commitStockMutation(db, {
    sourceType: "product",
    sourceId: "product-guard-1",
    variantKey: "RED",
    deltaCurrent: -2,
    referenceNumber: "SALE-GUARD-1",
    transactionType: "sale_stock_out",
    actor: "cashier",
  });

  const staleUpdate = await updateRecord("/api/products", "product-guard-1", {
    expectedVersion: staleVersion,
    name: "Produk Guard stale",
    currentStock: 99,
    hppPerUnit: 9999,
    variants: [{
      variantKey: "red",
      color: "Merah",
      currentStock: 99,
      hppPerUnit: 9999,
      isActive: true,
    }],
  });

  assert.equal(staleUpdate.response.status, 409);
  assert.equal(staleUpdate.payload.errorCode, "INVENTORY_STALE_UPDATE");

  const latest = await getRecord("/api/products", "product-guard-1");
  assert.equal(latest.payload.data.currentStock, 3);
  assert.equal(latest.payload.data.variants[0].currentStock, 3);

  const validUpdate = await updateRecord("/api/products", "product-guard-1", {
    expectedVersion: latest.payload.data.versionToken,
    name: "Produk Guard Baru",
    currentStock: 88,
    reservedStock: 7,
    availableStock: 81,
    hppPerUnit: 9999,
    variants: [{
      ...latest.payload.data.variants[0],
      color: "Merah Baru",
      variantLabel: "Merah Baru",
      currentStock: 88,
      reservedStock: 7,
      hppPerUnit: 9999,
    }],
  });

  assert.equal(validUpdate.response.status, 200);
  assert.equal(validUpdate.payload.data.name, "Produk Guard Baru");
  assert.equal(validUpdate.payload.data.currentStock, 3);
  assert.equal(validUpdate.payload.data.reservedStock, 0);
  assert.equal(validUpdate.payload.data.availableStock, 3);
  assert.equal(validUpdate.payload.data.hppPerUnit, 1200);
  assert.equal(validUpdate.payload.data.variants[0].currentStock, 3);
  assert.equal(validUpdate.payload.data.variants[0].hppPerUnit, 1300);
  assert.equal(validUpdate.payload.data.variants[0].variantKey, "red");
  assert.equal(validUpdate.payload.data.variants[0].variantLabel, "Merah Baru");

  const readModelRow = await db.get(
    "SELECT name, current_stock, available_stock FROM stock_read_models WHERE id = ?",
    ["product__product-guard-1"],
  );
  assert.deepEqual(readModelRow, {
    name: "Produk Guard Baru",
    current_stock: 3,
    available_stock: 3,
  });
});

test("variant guard memblokir hapus/nonaktif berstok, mengarsipkan zero-stock, dan men-zero-kan varian baru", async () => {
  const created = await createRecord("/api/products", {
    id: "product-variant-guard",
    code: "PRD-VARIANT-GUARD",
    name: "Produk Varian Guard",
    hasVariants: true,
    variants: [
      { variantKey: "red", color: "Merah", currentStock: 2, reservedStock: 0, isActive: true },
      { variantKey: "blue", color: "Biru", currentStock: 0, reservedStock: 0, isActive: true },
    ],
  });
  assert.equal(created.response.status, 201);

  const deactivateStocked = await updateRecord("/api/products", "product-variant-guard", {
    expectedVersion: created.payload.data.versionToken,
    variants: [
      { ...created.payload.data.variants[0], isActive: false },
      created.payload.data.variants[1],
    ],
  });
  assert.equal(deactivateStocked.response.status, 409);
  assert.equal(deactivateStocked.payload.errorCode, "INVENTORY_VARIANT_DEACTIVATE_BLOCKED");

  const latest = await getRecord("/api/products", "product-variant-guard");
  const guardedUpdate = await updateRecord("/api/products", "product-variant-guard", {
    expectedVersion: latest.payload.data.versionToken,
    variants: [
      latest.payload.data.variants[0],
      { color: "Hijau", currentStock: 77, reservedStock: 9, isActive: true },
    ],
  });

  assert.equal(guardedUpdate.response.status, 200);
  assert.equal(guardedUpdate.payload.data.currentStock, 2);
  assert.equal(guardedUpdate.payload.data.variants.length, 2);
  assert.equal(guardedUpdate.payload.data.variants[1].variantLabel, "Hijau");
  assert.equal(guardedUpdate.payload.data.variants[1].currentStock, 0);
  assert.equal(guardedUpdate.payload.data.variants[1].reservedStock, 0);
  assert.equal(guardedUpdate.payload.data.archivedVariants.length, 1);
  assert.equal(guardedUpdate.payload.data.archivedVariants[0].variantKey, "blue");
  assert.equal(guardedUpdate.payload.data.archivedVariants[0].isArchived, true);
  assert.ok(guardedUpdate.payload.data.variantModeHistory.some(
    (entry) => entry.action === "variant_archived" && entry.variantKey === "blue",
  ));

  const removeStocked = await updateRecord("/api/products", "product-variant-guard", {
    expectedVersion: guardedUpdate.payload.data.versionToken,
    variants: [guardedUpdate.payload.data.variants[1]],
  });
  assert.equal(removeStocked.response.status, 409);
  assert.equal(removeStocked.payload.errorCode, "INVENTORY_VARIANT_REMOVE_BLOCKED");
});

test("Raw Material dan Semi Finished mempertahankan valuation transaksi serta invariant stok", async () => {
  const categoryId = await seedRawMaterialCategory();
  const rawCreated = await createRecord("/api/raw-materials", {
    id: "raw-guard-1",
    code: "RAW-GUARD-1",
    name: "Raw Guard",
    categoryId,
    stockUnit: "pcs",
    averageActualUnitCost: 450,
    restockReferencePrice: 500,
    currentStock: 4,
    reservedStock: 1,
  });
  assert.equal(rawCreated.response.status, 201);

  const rawUpdated = await updateRecord("/api/raw-materials", "raw-guard-1", {
    expectedVersion: rawCreated.payload.data.versionToken,
    name: "Raw Guard Baru",
    averageActualUnitCost: 9999,
    restockReferencePrice: 550,
    stock: 100,
    currentStock: 100,
    reservedStock: 0,
    availableStock: 100,
  });
  assert.equal(rawUpdated.response.status, 200);
  assert.equal(rawUpdated.payload.data.averageActualUnitCost, 450);
  assert.equal(rawUpdated.payload.data.restockReferencePrice, 550);
  assert.equal(rawUpdated.payload.data.currentStock, 4);
  assert.equal(rawUpdated.payload.data.reservedStock, 1);
  assert.equal(rawUpdated.payload.data.availableStock, 3);
  assert.deepEqual(rawUpdated.payload.data.variantOptions, []);

  const semiCreated = await createRecord("/api/semi-finished-materials", {
    id: "semi-guard-1",
    code: "SFP-GUARD-1",
    name: "Semi Guard",
    currentStock: 6,
    reservedStock: 2,
    averageCostPerUnit: 700,
    lastProductionCostPerUnit: 750,
    referenceCostPerUnit: 800,
  });
  assert.equal(semiCreated.response.status, 201);

  const semiUpdated = await updateRecord("/api/semi-finished-materials", "semi-guard-1", {
    expectedVersion: semiCreated.payload.data.versionToken,
    name: "Semi Guard Baru",
    currentStock: 200,
    reservedStock: 0,
    averageCostPerUnit: 9000,
    lastProductionCostPerUnit: 9100,
    referenceCostPerUnit: 850,
  });
  assert.equal(semiUpdated.response.status, 200);
  assert.equal(semiUpdated.payload.data.averageCostPerUnit, 700);
  assert.equal(semiUpdated.payload.data.lastProductionCostPerUnit, 750);
  assert.equal(semiUpdated.payload.data.referenceCostPerUnit, 850);
  assert.equal(semiUpdated.payload.data.currentStock, 6);
  assert.equal(semiUpdated.payload.data.reservedStock, 2);
  assert.equal(semiUpdated.payload.data.availableStock, 4);
});

test("update tanpa version, delete master berstok, dan direct write read model ditolak", async () => {
  const created = await createRecord("/api/products", {
    id: "product-direct-guard",
    code: "PRD-DIRECT-GUARD",
    name: "Produk Direct Guard",
    currentStock: 1,
  });
  assert.equal(created.response.status, 201);

  const missingVersion = await updateRecord("/api/products", "product-direct-guard", {
    name: "Tidak boleh tersimpan",
  });
  assert.equal(missingVersion.response.status, 428);
  assert.equal(missingVersion.payload.errorCode, "INVENTORY_VERSION_REQUIRED");

  const deleteResponse = await request("/api/products/product-direct-guard", { method: "DELETE" });
  assert.equal(deleteResponse.response.status, 409);
  assert.equal(deleteResponse.payload.errorCode, "INVENTORY_MASTER_DELETE_BLOCKED");

  const directReadModelWrite = await createRecord("/api/stock-read-models", {
    id: "product__forged",
    sourceType: "product",
    sourceId: "forged",
    currentStock: 999,
  });
  assert.equal(directReadModelWrite.response.status, 405);
  assert.equal(directReadModelWrite.payload.errorCode, "DIRECT_WRITE_BLOCKED");
});


test("Raw Material memvalidasi kategori, satuan, nama unik, dan modal stok awal", async () => {
  const categoryId = await seedRawMaterialCategory();

  const invalidCategory = await createRecord("/api/raw-materials", {
    id: "raw-invalid-category",
    name: "Bahan Invalid",
    categoryId: 999,
    stockUnit: "pcs",
  });
  assert.equal(invalidCategory.response.status, 400);
  assert.equal(invalidCategory.payload.errorCode, "RAW_MATERIAL_CATEGORY_NOT_FOUND");

  const invalidUnit = await createRecord("/api/raw-materials", {
    id: "raw-invalid-unit",
    name: "Bahan Unit Invalid",
    categoryId,
    stockUnit: "box-besar",
  });
  assert.equal(invalidUnit.response.status, 400);
  assert.equal(invalidUnit.payload.errorCode, "RAW_MATERIAL_UNIT_INVALID");

  const missingOpeningCost = await createRecord("/api/raw-materials", {
    id: "raw-opening-cost",
    name: "Bahan Modal Awal",
    categoryId,
    stockUnit: "meter",
    currentStock: 5,
    averageActualUnitCost: 0,
  });
  assert.equal(missingOpeningCost.response.status, 400);
  assert.equal(missingOpeningCost.payload.errorCode, "RAW_MATERIAL_OPENING_COST_REQUIRED");

  const created = await createRecord("/api/raw-materials", {
    id: "raw-unique-name",
    name: "Kain Flanel",
    categoryId,
    stockUnit: "meter",
    currentStock: 0,
    averageActualUnitCost: 0,
  });
  assert.equal(created.response.status, 201);

  const duplicate = await createRecord("/api/raw-materials", {
    id: "raw-unique-name-2",
    name: "  kain flanel  ",
    categoryId,
    stockUnit: "meter",
  });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.payload.errorCode, "RAW_MATERIAL_DUPLICATE_NAME");
});

test("Raw Material tidak dapat dinonaktifkan saat masih berstok atau dipakai BOM aktif", async () => {
  const categoryId = await seedRawMaterialCategory();
  const stocked = await createRecord("/api/raw-materials", {
    id: "raw-deactivate-stock",
    name: "Bahan Berstok",
    categoryId,
    stockUnit: "pcs",
    currentStock: 3,
    averageActualUnitCost: 1000,
  });
  assert.equal(stocked.response.status, 201);

  const blockedByStock = await updateRecord("/api/raw-materials", "raw-deactivate-stock", {
    expectedVersion: stocked.payload.data.versionToken,
    isActive: false,
  });
  assert.equal(blockedByStock.response.status, 409);
  assert.equal(blockedByStock.payload.errorCode, "RAW_MATERIAL_DEACTIVATE_STOCK_BLOCKED");

  const zeroStock = await createRecord("/api/raw-materials", {
    id: "raw-deactivate-bom",
    name: "Bahan BOM",
    categoryId,
    stockUnit: "pcs",
    currentStock: 0,
  });
  assert.equal(zeroStock.response.status, 201);

  const db = await testDatabase.getDb();
  await upsertJsonRecord(db, "production_boms", {
    id: "bom-active-raw",
    code: "BOM-ACTIVE-RAW",
    name: "BOM Aktif Raw",
    status: "active",
    isActive: true,
    materialLines: [{ itemType: "raw_material", itemId: "raw-deactivate-bom", quantity: 1 }],
  });

  const blockedByBom = await updateRecord("/api/raw-materials", "raw-deactivate-bom", {
    expectedVersion: zeroStock.payload.data.versionToken,
    isActive: false,
  });
  assert.equal(blockedByBom.response.status, 409);
  assert.equal(blockedByBom.payload.errorCode, "RAW_MATERIAL_ACTIVE_BOM_DEPENDENCY");
});

test("minimum stok Raw Material varian tersimpan per varian dan read model memakai totalnya", async () => {
  const categoryId = await seedRawMaterialCategory();
  const created = await createRecord("/api/raw-materials", {
    id: "raw-variant-minimum",
    name: "Bahan Minimum Varian",
    categoryId,
    stockUnit: "pcs",
    hasVariants: true,
    variantLabel: "Warna",
    averageActualUnitCost: 500,
    variants: [
      { name: "Merah", variantKey: "red", currentStock: 5, minStockAlert: 3, isActive: true },
      { name: "Kuning", variantKey: "yellow", currentStock: 2, minStockAlert: 4, isActive: true },
    ],
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.payload.data.minStock, 0);
  assert.equal(created.payload.data.variants[0].minStockAlert, 3);
  assert.equal(created.payload.data.variants[1].minStockAlert, 4);

  const db = await testDatabase.getDb();
  const readModel = await db.get(
    "SELECT min_stock_alert, payload_json FROM stock_read_models WHERE id = ?",
    ["raw_material__raw-variant-minimum"],
  );
  assert.equal(readModel.min_stock_alert, 7);
  assert.equal(JSON.parse(readModel.payload_json).minimumStockMode, "variant");
});
