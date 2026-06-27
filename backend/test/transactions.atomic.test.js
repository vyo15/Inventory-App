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
const { createSupplier } = require("../src/modules/suppliers/suppliers.service");

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

const seedPurchaseSupplier = async ({ itemId = "product-1", price = 5000 } = {}) => {
  const supplier = await createSupplier({
    name: "Supplier Test",
    catalogOffers: [{
      itemType: "product",
      itemId,
      listingName: "Produk satuan",
      purchaseType: "offline",
      purchaseUnit: "pcs",
      purchaseQty: 1,
      conversionValue: 1,
      stockUnit: "pcs",
      supplierItemPrice: price,
    }],
  }, "tester");
  return { supplier, offer: supplier.catalogOffers[0] };
};

test("purchase menambah stok dan mencatat expense serta ledger secara atomic", async () => {
  await seedProduct();
  const { supplier, offer } = await seedPurchaseSupplier();

  await commitPurchase({
    actor: "tester",
    payload: {
      referenceNumber: "PUR-TEST-001",
      transactionDate: "2026-06-20T00:00:00.000Z",
      supplierId: supplier.id,
      supplierName: supplier.name,
      catalogOfferId: offer.id,
      sourceType: "product",
      sourceId: "product-1",
      itemId: "product-1",
      itemName: "Produk product-1",
      quantity: 3,
      qty: 3,
      subtotalItems: 15000,
      verifiedCatalogPrice: 5000,
      priceVerified: true,
      priceVerifiedAt: "2026-06-20T00:00:00.000Z",
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

test("purchase tanpa supplier dan verifikasi harga ditolak sebelum mutasi stok", async () => {
  await seedProduct();
  await assert.rejects(
    commitPurchase({
      actor: "tester",
      payload: {
        totalAmount: 5000,
        items: [{ sourceType: "product", sourceId: "product-1", quantity: 1 }],
      },
    }),
    /Supplier wajib dipilih/,
  );

  const db = await testDatabase.getDb();
  const state = await db.get(`
    SELECT
      (SELECT current_stock FROM products WHERE id = 'product-1') AS stock,
      (SELECT COUNT(*) FROM purchases) AS purchase_count,
      (SELECT COUNT(*) FROM expenses) AS expense_count
  `);
  assert.deepEqual(state, { stock: 10, purchase_count: 0, expense_count: 0 });
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

const seedRawMaterial = async ({
  id = "raw-material-1",
  stock = 10,
  averageActualUnitCost = 1000,
  variants = [],
} = {}) => {
  const db = await testDatabase.getDb();
  return upsertJsonRecord(db, "raw_materials", {
    id,
    code: id.toUpperCase(),
    name: `Bahan ${id}`,
    currentStock: stock,
    reservedStock: 0,
    availableStock: stock,
    averageActualUnitCost,
    stockUnit: "pcs",
    hasVariants: variants.length > 0,
    variants,
    status: "active",
    isActive: true,
  });
};

const seedRawMaterialPurchaseSupplier = async ({ itemId = "raw-material-1", packagePrice = 5000, conversionValue = 5 } = {}) => {
  const supplier = await createSupplier({
    name: "Supplier Bahan Test",
    catalogOffers: [{
      itemType: "raw_material",
      itemId,
      itemName: `Bahan ${itemId}`,
      listingName: "Paket bahan test",
      purchaseType: "online",
      purchaseUnit: "pack",
      purchaseQty: 1,
      conversionValue,
      stockUnit: "pcs",
      supplierItemPrice: packagePrice,
    }],
  }, "tester");
  return { supplier, offer: supplier.catalogOffers[0] };
};

test("purchase Bahan Baku memperbarui weighted average cost dari total biaya aktual secara atomic", async () => {
  await seedRawMaterial({ stock: 10, averageActualUnitCost: 1000 });
  const { supplier, offer } = await seedRawMaterialPurchaseSupplier({ packagePrice: 5000, conversionValue: 5 });

  const result = await commitPurchase({
    actor: "tester",
    payload: {
      referenceNumber: "PUR-RAW-VALUATION-001",
      transactionDate: "2026-06-27T00:00:00.000Z",
      supplierId: supplier.id,
      supplierName: supplier.name,
      catalogOfferId: offer.id,
      sourceType: "raw_material",
      sourceId: "raw-material-1",
      itemId: "raw-material-1",
      itemName: "Bahan raw-material-1",
      quantity: 1,
      qty: 1,
      totalStockIn: 5,
      subtotalItems: 5000,
      shippingCost: 5000,
      totalActualPurchase: 10000,
      totalAmount: 10000,
      verifiedCatalogPrice: 5000,
      priceVerified: true,
      priceVerifiedAt: "2026-06-27T00:00:00.000Z",
      items: [{ sourceType: "raw_material", sourceId: "raw-material-1", quantity: 5 }],
    },
  });

  const db = await testDatabase.getDb();
  const row = await db.get(
    "SELECT current_stock, payload_json FROM raw_materials WHERE id = ?",
    ["raw-material-1"],
  );
  const payload = JSON.parse(row.payload_json);
  const purchase = await db.get("SELECT payload_json FROM purchases WHERE id = ?", ["PUR-RAW-VALUATION-001"]);
  const purchasePayload = JSON.parse(purchase.payload_json);

  assert.equal(row.current_stock, 15);
  assert.equal(payload.averageActualUnitCost, 1333);
  assert.equal(payload.lastPurchaseUnitCost, 2000);
  assert.equal(payload.lastPurchaseTotalCost, 10000);
  assert.equal(purchasePayload.actualUnitCost, 2000);
  assert.equal(purchasePayload.averageActualUnitCostAfter, 1333);
  assert.equal(result.valuationResult.averageActualUnitCost, 1333);

  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM purchases) AS purchase_count,
      (SELECT COUNT(*) FROM expenses) AS expense_count,
      (SELECT COUNT(*) FROM money_movement_ledger) AS ledger_count,
      (SELECT COUNT(*) FROM audit_logs WHERE action = 'raw_material_average_cost_updated') AS valuation_audit_count
  `);
  assert.deepEqual(counts, {
    purchase_count: 1,
    expense_count: 1,
    ledger_count: 1,
    valuation_audit_count: 1,
  });
});

test("purchase Bahan Baku yang gagal verifikasi tidak mengubah stok atau modal", async () => {
  await seedRawMaterial({ stock: 10, averageActualUnitCost: 1000 });
  const { supplier, offer } = await seedRawMaterialPurchaseSupplier({ packagePrice: 5000, conversionValue: 5 });

  await assert.rejects(
    commitPurchase({
      actor: "tester",
      payload: {
        referenceNumber: "PUR-RAW-ROLLBACK-001",
        supplierId: supplier.id,
        catalogOfferId: offer.id,
        sourceType: "raw_material",
        sourceId: "raw-material-1",
        itemId: "raw-material-1",
        quantity: 1,
        subtotalItems: 5000,
        totalStockIn: 5,
        totalActualPurchase: 10000,
        totalAmount: 10000,
        verifiedCatalogPrice: 4000,
        priceVerified: true,
        priceVerifiedAt: "2026-06-27T00:00:00.000Z",
        items: [{ sourceType: "raw_material", sourceId: "raw-material-1", quantity: 5 }],
      },
    }),
    /Verifikasi ulang harga/,
  );

  const db = await testDatabase.getDb();
  const row = await db.get("SELECT current_stock, payload_json FROM raw_materials WHERE id = ?", ["raw-material-1"]);
  const payload = JSON.parse(row.payload_json);
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM purchases) AS purchase_count,
      (SELECT COUNT(*) FROM expenses) AS expense_count,
      (SELECT COUNT(*) FROM inventory_logs) AS inventory_count,
      (SELECT COUNT(*) FROM audit_logs) AS audit_count
  `);

  assert.equal(row.current_stock, 10);
  assert.equal(payload.averageActualUnitCost, 1000);
  assert.deepEqual(counts, {
    purchase_count: 0,
    expense_count: 0,
    inventory_count: 0,
    audit_count: 1,
  });
});
