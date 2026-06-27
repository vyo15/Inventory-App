const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("categories-hierarchy");
const { upsertJsonRecord } = require("../src/utils/sqliteStockEngine");
const {
  createCategory,
  getCategoryById,
  listCategories,
  updateCategory,
} = require("../src/modules/categories/categories.service");

before(testDatabase.initialize);
beforeEach(testDatabase.reset);
after(testDatabase.cleanup);

test("migrasi kategori menyediakan scope, parent, dan sort order", async () => {
  const db = await testDatabase.getDb();
  const columns = await db.all("PRAGMA table_info(categories)");
  const columnNames = columns.map((column) => column.name);

  assert.ok(columnNames.includes("parent_id"));
  assert.ok(columnNames.includes("sort_order"));

  const schemaVersion = await db.get(
    "SELECT value FROM schema_meta WHERE key = 'schema_version'",
  );
  assert.equal(schemaVersion.value, "9");
});

test("kategori dipisahkan per scope dan hierarchy dibatasi dua tingkat", async () => {
  const bouquet = await createCategory({
    name: "Bouquet",
    type: "product_form",
    sortOrder: 1,
  }, "tester");
  const bouquetMini = await createCategory({
    name: "Bouquet Mini",
    type: "product_form",
    parentId: bouquet.id,
  }, "tester");
  await createCategory({ name: "Mawar", type: "flower_type" }, "tester");

  const productCategories = await listCategories({ type: "product_form" });
  assert.equal(productCategories.length, 2);
  assert.equal(productCategories.find((item) => item.id === bouquet.id).childCount, 1);
  assert.equal(productCategories.find((item) => item.id === bouquetMini.id).parentId, bouquet.id);

  const flowerTypes = await listCategories({ type: "flower_type" });
  assert.deepEqual(flowerTypes.map((item) => item.name), ["Mawar"]);

  await assert.rejects(
    createCategory({
      name: "Turunan Ketiga",
      type: "product_form",
      parentId: bouquetMini.id,
    }, "tester"),
    /maksimal dua tingkat/,
  );
});

test("nama kategori unik pada parent yang sama tanpa membedakan kapital", async () => {
  const root = await createCategory({ name: "Kain Flanel", type: "raw_material_group" }, "tester");
  await createCategory({
    name: "Flanel Lembaran",
    type: "raw_material_group",
    parentId: root.id,
  }, "tester");

  await assert.rejects(
    createCategory({
      name: " flanel lembaran ",
      type: "raw_material_group",
      parentId: root.id,
    }, "tester"),
    /Nama kategori sudah digunakan/,
  );
});

test("kategori yang dipakai atau memiliki child tidak dapat dinonaktifkan", async () => {
  const bouquet = await createCategory({ name: "Bouquet", type: "product_form" }, "tester");
  const bouquetMini = await createCategory({
    name: "Bouquet Mini",
    type: "product_form",
    parentId: bouquet.id,
  }, "tester");
  const db = await testDatabase.getDb();

  await upsertJsonRecord(db, "products", {
    id: "product-bouquet-mini",
    code: "PRD-001",
    name: "Bouquet Mawar Mini",
    categoryId: bouquetMini.id,
    category: "Bouquet Mini",
    currentStock: 0,
    reservedStock: 0,
    availableStock: 0,
    status: "active",
    isActive: true,
  });

  const parentDetail = await getCategoryById(bouquet.id);
  assert.equal(parentDetail.childCount, 1);
  assert.equal(parentDetail.usageCount, 1);

  await assert.rejects(
    updateCategory(bouquetMini.id, { status: "inactive" }, "tester"),
    /masih digunakan oleh 1 data/,
  );
  await assert.rejects(
    updateCategory(bouquet.id, { status: "inactive" }, "tester"),
    /subkategori aktif terlebih dahulu/,
  );

  const kemasan = await createCategory({ name: "Kemasan", type: "raw_material_group" }, "tester");
  const kertas = await createCategory({
    name: "Kertas Bouquet",
    type: "raw_material_group",
    parentId: kemasan.id,
  }, "tester");

  await assert.rejects(
    updateCategory(kemasan.id, { status: "inactive" }, "tester"),
    /subkategori aktif terlebih dahulu/,
  );
  await updateCategory(kertas.id, { status: "inactive" }, "tester");
  const inactiveRoot = await updateCategory(kemasan.id, { status: "inactive" }, "tester");
  assert.equal(inactiveRoot.status, "inactive");
});

test("data legacy tanpa categoryId tetap dihitung untuk usage guard", async () => {
  const flowerType = await createCategory({ name: "Mawar", type: "flower_type" }, "tester");
  const db = await testDatabase.getDb();

  await upsertJsonRecord(db, "semi_finished_materials", {
    id: "semi-mawar",
    code: "SFP-001",
    name: "Kelopak Mawar",
    flowerGroup: "Mawar",
    category: "kelopak",
    currentStock: 0,
    reservedStock: 0,
    availableStock: 0,
    status: "active",
    isActive: true,
  });

  const detail = await getCategoryById(flowerType.id);
  assert.equal(detail.directUsageCount, 1);
  await assert.rejects(
    updateCategory(flowerType.id, { status: "inactive" }, "tester"),
    /masih digunakan oleh 1 data/,
  );
});
