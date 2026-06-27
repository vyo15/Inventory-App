const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("supplier-catalog");
const { upsertJsonRecord } = require("../src/utils/sqliteStockEngine");
const {
  createSupplier,
  getSupplierById,
  listSupplierCatalogHistory,
  updateSupplier,
  verifySupplierCatalogOffer,
} = require("../src/modules/suppliers/suppliers.service");
const { runMigrations } = require("../src/db/migrate");
const { commitPurchase } = require("../src/modules/transactions/transactions.service");

before(testDatabase.initialize);
beforeEach(testDatabase.reset);
after(testDatabase.cleanup);

const seedCatalogItems = async () => {
  const db = await testDatabase.getDb();
  await upsertJsonRecord(db, "raw_materials", {
    id: "material-kain",
    code: "MAT-KAIN",
    name: "Kain Flanel",
    unit: "lembar",
    stockUnit: "lembar",
    currentStock: 5,
    reservedStock: 0,
    availableStock: 5,
    status: "active",
    isActive: true,
  });
  await upsertJsonRecord(db, "products", {
    id: "product-boneka",
    code: "PRD-BONEKA",
    name: "Boneka Flanel",
    unit: "pcs",
    stockUnit: "pcs",
    currentStock: 3,
    reservedStock: 0,
    availableStock: 3,
    status: "active",
    isActive: true,
  });
};

const createStoreA = () => createSupplier({
  name: "Toko A",
  storeLink: "https://example.com/toko-a",
  catalogOffers: [
    {
      itemType: "raw_material",
      itemId: "material-kain",
      listingName: "Paket 10 lembar",
      channel: "Marketplace A",
      productLink: "https://example.com/toko-a/kain-10",
      purchaseUnit: "paket",
      purchaseQty: 1,
      conversionValue: 10,
      stockUnit: "lembar",
      supplierItemPrice: 20000,
      isPrimary: true,
    },
    {
      itemType: "raw_material",
      itemId: "material-kain",
      listingName: "Paket 25 lembar",
      channel: "Marketplace A",
      productLink: "https://example.com/toko-a/kain-25",
      purchaseUnit: "paket",
      purchaseQty: 1,
      conversionValue: 25,
      stockUnit: "lembar",
      supplierItemPrice: 45000,
    },
    {
      itemType: "product",
      itemId: "product-boneka",
      listingName: "Boneka satuan",
      channel: "Marketplace A",
      productLink: "https://example.com/toko-a/boneka",
      purchaseUnit: "pcs",
      purchaseQty: 1,
      conversionValue: 1,
      stockUnit: "pcs",
      supplierItemPrice: 10000,
    },
  ],
}, "tester");

const createStoreB = () => createSupplier({
  name: "Toko B",
  catalogOffers: [{
    itemType: "raw_material",
    itemId: "material-kain",
    listingName: "Paket alternatif",
    purchaseType: "offline",
    purchaseUnit: "paket",
    purchaseQty: 1,
    conversionValue: 20,
    stockUnit: "lembar",
    supplierItemPrice: 39000,
  }],
}, "tester");


test("migrasi materialDetails lama idempotent dan update parsial tidak menonaktifkan katalog", async () => {
  await seedCatalogItems();
  const db = await testDatabase.getDb();
  const legacy = await db.run(
    `
      INSERT INTO suppliers (supplier_code, name, payload_json, status)
      VALUES (?, ?, ?, 'active')
    `,
    [
      "SUP-27062026-901",
      "Toko Legacy",
      JSON.stringify({
        materialDetails: [{
          materialId: "material-kain",
          materialName: "Kain Flanel",
          listingName: "Paket legacy",
          productLink: "https://example.com/legacy/kain",
          purchaseUnit: "paket",
          purchaseQty: 1,
          conversionValue: 10,
          stockUnit: "lembar",
          supplierItemPrice: 21000,
        }],
      }),
    ],
  );

  await runMigrations();
  await runMigrations();
  let supplier = await getSupplierById(legacy.lastID);
  assert.equal(supplier.catalogOffers.length, 1);
  assert.equal(supplier.catalogOffers[0].listingName, "Paket legacy");

  await updateSupplier(legacy.lastID, {
    name: "Toko Legacy Baru",
    storeLink: "https://example.com/legacy",
  }, "tester");
  supplier = await getSupplierById(legacy.lastID);
  assert.equal(supplier.name, "Toko Legacy Baru");
  assert.equal(supplier.catalogOffers.length, 1);
});

test("link toko dan link penawaran hanya menerima http atau https", async () => {
  await seedCatalogItems();
  await assert.rejects(
    createSupplier({
      name: "Toko Tidak Aman",
      storeLink: "javascript:alert(1)",
    }, "tester"),
    /http:\/\/ atau https:\/\//,
  );
  await assert.rejects(
    createSupplier({
      name: "Toko Link Tidak Aman",
      catalogOffers: [{
        itemType: "raw_material",
        itemId: "material-kain",
        listingName: "Link berbahaya",
        productLink: "data:text/html,unsafe",
        supplierItemPrice: 20000,
      }],
    }, "tester"),
    /http:\/\/ atau https:\/\//,
  );
});

test("supplier mendukung banyak link, banyak item, dan histori tetap terpisah per toko", async () => {
  await seedCatalogItems();
  const storeA = await createStoreA();
  const storeB = await createStoreB();

  assert.equal(storeA.catalogOffers.length, 3);
  assert.equal(storeA.catalogOffers.filter((offer) => offer.itemId === "material-kain").length, 2);
  assert.equal(storeA.catalogOffers.filter((offer) => offer.itemType === "product").length, 1);

  const kainOffer = storeA.catalogOffers.find((offer) => offer.listingName === "Paket 10 lembar");
  await verifySupplierCatalogOffer({
    supplierId: storeA.id,
    offerId: kainOffer.id,
    actualPrice: 22000,
    resultStatus: "verified",
    actor: "tester",
  });

  const historyA = await listSupplierCatalogHistory(storeA.id);
  const historyB = await listSupplierCatalogHistory(storeB.id);
  assert.ok(historyA.some((event) => event.eventType === "price_changed" && event.previousPrice === 20000 && event.newPrice === 22000));
  assert.ok(historyA.every((event) => String(event.supplierId) === String(storeA.id)));
  assert.ok(historyB.every((event) => String(event.supplierId) === String(storeB.id)));
  assert.ok(!historyB.some((event) => event.newPrice === 22000));
});

test("status stok/link toko tersimpan tanpa mencampur histori supplier lain", async () => {
  await seedCatalogItems();
  const storeA = await createStoreA();
  const offer = storeA.catalogOffers.find((entry) => entry.listingName === "Paket 10 lembar");

  const unavailable = await verifySupplierCatalogOffer({
    supplierId: storeA.id,
    offerId: offer.id,
    resultStatus: "stock_unavailable",
    actor: "tester",
  });
  assert.equal(unavailable.offer.availabilityStatus, "stock_unavailable");

  const availableAgain = await verifySupplierCatalogOffer({
    supplierId: storeA.id,
    offerId: offer.id,
    actualPrice: 20000,
    resultStatus: "verified",
    actor: "tester",
  });
  assert.equal(availableAgain.offer.availabilityStatus, "available");

  const history = await listSupplierCatalogHistory(storeA.id);
  assert.ok(history.some((event) => event.eventType === "stock_unavailable"));
  assert.ok(history.some((event) => event.eventType === "price_checked"));
});

test("purchase memverifikasi harga, memperbarui katalog, dan menambah stok secara atomik", async () => {
  await seedCatalogItems();
  const storeA = await createStoreA();
  const offer = storeA.catalogOffers.find((entry) => entry.itemType === "product");

  const result = await commitPurchase({
    actor: "tester",
    payload: {
      supplierId: storeA.id,
      supplierName: "Toko A",
      catalogOfferId: offer.id,
      sourceType: "product",
      sourceId: "product-boneka",
      itemId: "product-boneka",
      itemName: "Boneka Flanel",
      quantity: 2,
      qty: 2,
      subtotalItems: 24000,
      verifiedCatalogPrice: 12000,
      priceVerified: true,
      priceVerifiedAt: "2026-06-27T10:00:00.000Z",
      totalAmount: 25000,
      items: [{ sourceType: "product", sourceId: "product-boneka", quantity: 2 }],
    },
  });

  const db = await testDatabase.getDb();
  const product = await db.get("SELECT current_stock FROM products WHERE id = ?", ["product-boneka"]);
  const updatedOffer = await db.get("SELECT supplier_item_price, last_checked_at FROM supplier_catalog_offers WHERE id = ?", [offer.id]);
  const purchase = await db.get("SELECT payload_json FROM purchases WHERE id = ?", [result.id]);
  const purchasePayload = JSON.parse(purchase.payload_json);

  assert.equal(product.current_stock, 5);
  assert.equal(updatedOffer.supplier_item_price, 12000);
  assert.ok(updatedOffer.last_checked_at);
  assert.equal(purchasePayload.catalogOfferId, offer.id);
  assert.equal(purchasePayload.productLink, offer.productLink);
  assert.equal(purchasePayload.verifiedCatalogPrice, 12000);
  assert.equal(result.catalogVerification.priceVerificationResult, "price_up");

  const history = await listSupplierCatalogHistory(storeA.id);
  assert.ok(history.some((event) => event.eventType === "purchase_price_changed"));
});

test("verifikasi harga stale me-rollback purchase, stok, finance, dan histori pembelian", async () => {
  await seedCatalogItems();
  const storeA = await createStoreA();
  const offer = storeA.catalogOffers.find((entry) => entry.itemType === "product");

  await assert.rejects(
    commitPurchase({
      actor: "tester",
      payload: {
        supplierId: storeA.id,
        catalogOfferId: offer.id,
        sourceType: "product",
        sourceId: "product-boneka",
        quantity: 2,
        subtotalItems: 24000,
        verifiedCatalogPrice: 10000,
        priceVerified: true,
        priceVerifiedAt: "2026-06-27T10:00:00.000Z",
        totalAmount: 25000,
        items: [{ sourceType: "product", sourceId: "product-boneka", quantity: 2 }],
      },
    }),
    /Verifikasi ulang harga/,
  );

  const db = await testDatabase.getDb();
  const product = await db.get("SELECT current_stock FROM products WHERE id = ?", ["product-boneka"]);
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM purchases) AS purchase_count,
      (SELECT COUNT(*) FROM expenses) AS expense_count,
      (SELECT COUNT(*) FROM money_movement_ledger) AS ledger_count,
      (SELECT COUNT(*) FROM supplier_catalog_history WHERE event_type LIKE 'purchase_%') AS purchase_history_count
  `);

  assert.equal(product.current_stock, 3);
  assert.deepEqual(counts, {
    purchase_count: 0,
    expense_count: 0,
    ledger_count: 0,
    purchase_history_count: 0,
  });
});
