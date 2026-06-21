const assert = require("node:assert/strict");
const { test } = require("node:test");

const connectionPath = require.resolve("../src/db/connection");
require.cache[connectionPath] = {
  id: connectionPath,
  filename: connectionPath,
  loaded: true,
  exports: {
    getDb: async () => {
      throw new Error("Database tidak dipakai pada unit test inventory guard.");
    },
  },
};

const {
  createInventoryMasterRouteGuards,
  normalizeInventoryMasterCreate,
  sanitizeInventoryMasterUpdate,
} = require("../src/utils/sqliteStockEngine");

const buildContext = (overrides = {}) => {
  const currentPayload = {
    id: "product-1",
    code: "PRD-001",
    name: "Produk Lama",
    updatedAt: "2026-06-21T00:00:00.000Z",
    hasVariants: true,
    currentStock: 3,
    stock: 3,
    reservedStock: 0,
    availableStock: 3,
    hppPerUnit: 1200,
    variants: [{
      variantKey: "red",
      variantLabel: "Merah",
      color: "Merah",
      currentStock: 3,
      stock: 3,
      reservedStock: 0,
      availableStock: 3,
      hppPerUnit: 1300,
      isActive: true,
    }],
  };
  const incomingPayload = {
    expectedVersion: currentPayload.updatedAt,
    name: "Produk Baru",
    currentStock: 99,
    hppPerUnit: 9999,
    variants: [{
      ...currentPayload.variants[0],
      variantLabel: "Merah Baru",
      color: "Merah Baru",
      currentStock: 99,
      hppPerUnit: 9999,
    }],
  };

  return {
    current: {
      ...currentPayload,
      versionToken: currentPayload.updatedAt,
    },
    currentPayload,
    incomingPayload,
    mergedPayload: {
      ...currentPayload,
      ...incomingPayload,
      updatedAt: "2026-06-21T00:01:00.000Z",
    },
    req: { localAuth: { user: { username: "admin" } } },
    protectedFields: ["hppPerUnit"],
    protectedVariantFields: ["hppPerUnit"],
    ...overrides,
  };
};

test("sanitizer mempertahankan stok, invariant, HPP, dan variantKey existing", () => {
  const result = sanitizeInventoryMasterUpdate(buildContext());

  assert.equal(result.name, "Produk Baru");
  assert.equal(result.currentStock, 3);
  assert.equal(result.stock, 3);
  assert.equal(result.reservedStock, 0);
  assert.equal(result.availableStock, 3);
  assert.equal(result.hppPerUnit, 1200);
  assert.equal(result.variants[0].variantKey, "red");
  assert.equal(result.variants[0].variantLabel, "Merah Baru");
  assert.equal(result.variants[0].currentStock, 3);
  assert.equal(result.variants[0].hppPerUnit, 1300);
  assert.equal("expectedVersion" in result, false);
});

test("sanitizer menolak update stale sebelum payload dapat disimpan", () => {
  const context = buildContext();
  context.incomingPayload.expectedVersion = "2026-06-20T00:00:00.000Z";

  assert.throws(
    () => sanitizeInventoryMasterUpdate(context),
    (error) => error.errorCode === "INVENTORY_STALE_UPDATE" && error.statusCode === 409,
  );
});

test("varian berstok tidak dapat dihapus atau dinonaktifkan", () => {
  const removeContext = buildContext();
  removeContext.incomingPayload.variants = [];
  removeContext.mergedPayload.variants = [];
  assert.throws(
    () => sanitizeInventoryMasterUpdate(removeContext),
    (error) => error.errorCode === "INVENTORY_VARIANT_REMOVE_BLOCKED",
  );

  const deactivateContext = buildContext();
  deactivateContext.incomingPayload.variants = [{
    ...deactivateContext.currentPayload.variants[0],
    isActive: false,
  }];
  deactivateContext.mergedPayload.variants = deactivateContext.incomingPayload.variants;
  assert.throws(
    () => sanitizeInventoryMasterUpdate(deactivateContext),
    (error) => error.errorCode === "INVENTORY_VARIANT_DEACTIVATE_BLOCKED",
  );
});

test("varian zero-stock yang dihapus diarsipkan dan varian baru selalu mulai dari stok/HPP 0", () => {
  const context = buildContext();
  context.currentPayload.variants.push({
    variantKey: "blue",
    variantLabel: "Biru",
    color: "Biru",
    currentStock: 0,
    stock: 0,
    reservedStock: 0,
    availableStock: 0,
    hppPerUnit: 500,
    isActive: true,
  });
  context.current.variants = context.currentPayload.variants;
  context.incomingPayload.variants = [
    context.currentPayload.variants[0],
    {
      color: "Hijau",
      variantLabel: "Hijau",
      currentStock: 50,
      reservedStock: 10,
      hppPerUnit: 9000,
      isActive: true,
    },
  ];
  context.mergedPayload.variants = context.incomingPayload.variants;

  const result = sanitizeInventoryMasterUpdate(context);
  const newVariant = result.variants.find((variant) => variant.variantLabel === "Hijau");

  assert.equal(newVariant.currentStock, 0);
  assert.equal(newVariant.reservedStock, 0);
  assert.equal(newVariant.availableStock, 0);
  assert.equal(newVariant.hppPerUnit, 0);
  assert.ok(result.archivedVariants.some(
    (variant) => variant.variantKey === "blue" && variant.isArchived === true,
  ));
  assert.ok(result.variantModeHistory.some(
    (entry) => entry.action === "variant_archived" && entry.variantKey === "blue",
  ));
});

test("normalisasi create menghitung invariant stok dan menolak reserved melebihi current", () => {
  const normalized = normalizeInventoryMasterCreate({
    name: "Produk Baru",
    hasVariants: true,
    variants: [
      { color: "Merah", currentStock: 4, reservedStock: 1 },
      { color: "Biru", currentStock: 2, reservedStock: 2 },
    ],
  });

  assert.equal(normalized.currentStock, 6);
  assert.equal(normalized.reservedStock, 3);
  assert.equal(normalized.availableStock, 3);
  assert.equal(normalized.variants[0].availableStock, 3);
  assert.equal(normalized.variants[1].availableStock, 0);

  assert.throws(
    () => normalizeInventoryMasterCreate({ currentStock: 1, reservedStock: 2 }),
    (error) => error.errorCode === "INVENTORY_RESERVED_EXCEEDS_CURRENT",
  );
});


test("delete master ditolak bila archivedVariants legacy masih menyimpan stok", async () => {
  const guards = createInventoryMasterRouteGuards({
    sourceType: "product",
    sourceCollection: "products",
  });

  await assert.rejects(
    () => guards.validateDirectDelete({
      current: { currentStock: 0, reservedStock: 0, availableStock: 0 },
      currentPayload: {
        variants: [],
        archivedVariants: [{
          variantKey: "legacy-red",
          currentStock: 1,
          reservedStock: 0,
          availableStock: 1,
        }],
      },
    }),
    (error) => error.errorCode === "INVENTORY_MASTER_DELETE_BLOCKED",
  );
});


test("legacy varian nonaktif berstok tetap ditolak dan mode varian tidak boleh menyembunyikan total master", () => {
  const inactiveContext = buildContext();
  inactiveContext.currentPayload.variants[0].isActive = false;
  inactiveContext.current.variants = inactiveContext.currentPayload.variants;
  inactiveContext.incomingPayload.variants = [{
    ...inactiveContext.currentPayload.variants[0],
    isActive: false,
  }];
  inactiveContext.mergedPayload.variants = inactiveContext.incomingPayload.variants;

  assert.throws(
    () => sanitizeInventoryMasterUpdate(inactiveContext),
    (error) => error.errorCode === "INVENTORY_VARIANT_DEACTIVATE_BLOCKED",
  );

  const disableModeContext = buildContext();
  disableModeContext.currentPayload.variants = [{
    ...disableModeContext.currentPayload.variants[0],
    currentStock: 0,
    stock: 0,
    reservedStock: 0,
    availableStock: 0,
  }];
  disableModeContext.current.variants = disableModeContext.currentPayload.variants;
  disableModeContext.incomingPayload.hasVariants = false;
  disableModeContext.incomingPayload.variants = [];
  disableModeContext.mergedPayload.hasVariants = false;
  disableModeContext.mergedPayload.variants = [];

  assert.throws(
    () => sanitizeInventoryMasterUpdate(disableModeContext),
    (error) => error.errorCode === "INVENTORY_VARIANT_MODE_DISABLE_BLOCKED",
  );
});
