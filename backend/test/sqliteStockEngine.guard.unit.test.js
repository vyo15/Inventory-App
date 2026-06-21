const assert = require("node:assert/strict");
const { test } = require("node:test");

const connectionPath = require.resolve("../src/db/connection");
require.cache[connectionPath] = {
  id: connectionPath,
  filename: connectionPath,
  loaded: true,
  exports: {
    getDb: async () => {
      throw new Error("Database tidak dipakai pada unit test Stock Engine guard.");
    },
  },
};

const {
  applyStockDeltaToPayload,
  normalizeInventoryMasterCreate,
  resolveInventoryVariantCollection,
  sanitizeInventoryMasterUpdate,
} = require("../src/utils/sqliteStockEngine");

test("item non-varian dengan variants kosong tetap memakai stok master", () => {
  const result = applyStockDeltaToPayload({
    hasVariants: false,
    variants: [],
    currentStock: 5,
    reservedStock: 0,
    availableStock: 5,
  }, { deltaCurrent: -2 });

  assert.equal(result.currentStock, 3);
  assert.equal(result.availableStock, 3);
  assert.deepEqual(result.variants, []);
});

test("stock-out ditolak ketika melebihi available stock master atau varian", () => {
  assert.throws(
    () => applyStockDeltaToPayload({
      hasVariants: false,
      variants: [],
      currentStock: 5,
      reservedStock: 4,
      availableStock: 1,
    }, { deltaCurrent: -2 }),
    (error) => error.errorCode === "INVENTORY_AVAILABLE_STOCK_INSUFFICIENT",
  );

  assert.throws(
    () => applyStockDeltaToPayload({
      hasVariants: true,
      variants: [{
        variantKey: "red",
        variantLabel: "Merah",
        currentStock: 5,
        reservedStock: 4,
        availableStock: 1,
        isActive: true,
      }],
    }, { deltaCurrent: -2, variantKey: "red" }),
    (error) => error.errorCode === "INVENTORY_AVAILABLE_STOCK_INSUFFICIENT",
  );
});

test("variants kosong tidak menutupi variantOptions legacy", () => {
  const payload = {
    hasVariants: false,
    variants: [],
    variantOptions: [{
      variantKey: "red",
      variantLabel: "Merah",
      currentStock: 3,
      reservedStock: 0,
      availableStock: 99,
      isActive: true,
    }],
  };

  const resolved = resolveInventoryVariantCollection(payload);
  assert.equal(resolved.hasVariants, true);
  assert.equal(resolved.variants.length, 1);

  const result = applyStockDeltaToPayload(payload, {
    deltaCurrent: -1,
    variantKey: "red",
  });
  assert.equal(result.currentStock, 2);
  assert.equal(result.variants[0].currentStock, 2);
  assert.equal(result.variants[0].availableStock, 2);
  assert.equal(result.variantOptions[0].availableStock, 2);
});

test("mutasi normal menolak master dan varian nonaktif", () => {
  assert.throws(
    () => applyStockDeltaToPayload({
      hasVariants: true,
      variants: [{
        variantKey: "red",
        variantLabel: "Merah",
        currentStock: 0,
        reservedStock: 0,
        isActive: false,
      }],
    }, { deltaCurrent: 1, variantKey: "red" }),
    (error) => error.errorCode === "INVENTORY_VARIANT_INACTIVE",
  );
});

test("retur internal dapat memulihkan varian arsip zero-stock secara eksplisit", () => {
  const result = applyStockDeltaToPayload({
    hasVariants: true,
    variants: [],
    archivedVariants: [{
      variantKey: "red",
      variantLabel: "Merah",
      currentStock: 0,
      reservedStock: 0,
      availableStock: 0,
      isActive: false,
      isArchived: true,
    }],
  }, {
    deltaCurrent: 2,
    variantKey: "red",
    allowInactiveVariant: true,
    allowArchivedVariantRestore: true,
    actor: "admin",
    overrideReason: "Retur historis sah.",
  });

  assert.equal(result.variants.length, 1);
  assert.equal(result.variants[0].isActive, true);
  assert.equal(result.variants[0].isArchived, false);
  assert.equal(result.variants[0].currentStock, 2);
  assert.equal(result.archivedVariants.length, 0);
  assert.ok(result.variantModeHistory.some(
    (entry) => entry.action === "variant_restored_by_stock_mutation",
  ));
});

test("create bervarian wajib memiliki minimal satu varian aktif", () => {
  assert.throws(
    () => normalizeInventoryMasterCreate({
      hasVariants: true,
      variants: [{
        variantKey: "red",
        variantLabel: "Merah",
        currentStock: 0,
        reservedStock: 0,
        isActive: false,
      }],
    }),
    (error) => error.errorCode === "INVENTORY_ACTIVE_VARIANT_REQUIRED",
  );
});

test("metadata update menormalisasi availableStock nested tanpa mengubah saldo", () => {
  const currentPayload = {
    id: "product-1",
    code: "PRD-001",
    name: "Produk",
    updatedAt: "2026-06-21T00:00:00.000Z",
    hasVariants: true,
    variants: [{
      variantKey: "red",
      variantLabel: "Merah",
      currentStock: 5,
      reservedStock: 2,
      availableStock: 5,
      isActive: true,
    }],
  };
  const result = sanitizeInventoryMasterUpdate({
    current: {
      ...currentPayload,
      currentStock: 5,
      reservedStock: 2,
      availableStock: 3,
      versionToken: currentPayload.updatedAt,
    },
    currentPayload,
    incomingPayload: {
      expectedVersion: currentPayload.updatedAt,
      name: "Produk Baru",
    },
    mergedPayload: {
      ...currentPayload,
      name: "Produk Baru",
      updatedAt: "2026-06-21T00:01:00.000Z",
    },
    req: { localAuth: { user: { username: "admin" } } },
  });

  assert.equal(result.variants[0].currentStock, 5);
  assert.equal(result.variants[0].reservedStock, 2);
  assert.equal(result.variants[0].availableStock, 3);
  assert.equal(result.availableStock, 3);
});

test("reference varian legacy dapat memakai label ketika variantKey berbeda", () => {
  const result = applyStockDeltaToPayload({
    hasVariants: true,
    variants: [{
      variantKey: "red",
      variantLabel: "Merah",
      currentStock: 3,
      reservedStock: 0,
      isActive: true,
    }],
  }, {
    deltaCurrent: -1,
    variantKey: "Merah",
  });

  assert.equal(result.variants[0].variantKey, "red");
  assert.equal(result.variants[0].currentStock, 2);
});

test("retur historis dapat mengaktifkan kembali mode varian yang sudah diarsipkan", () => {
  const payload = {
    hasVariants: false,
    variants: [],
    currentStock: 0,
    reservedStock: 0,
    archivedVariants: [{
      variantKey: "red",
      variantLabel: "Merah",
      currentStock: 0,
      reservedStock: 0,
      availableStock: 0,
      isActive: false,
      isArchived: true,
    }],
  };

  const restored = applyStockDeltaToPayload(payload, {
    deltaCurrent: 1,
    variantKey: "Merah",
    allowInactiveVariant: true,
    allowArchivedVariantRestore: true,
    actor: "admin",
    overrideReason: "Retur historis sah.",
  });

  assert.equal(restored.hasVariants, true);
  assert.equal(restored.currentStock, 1);
  assert.equal(restored.variants[0].variantKey, "red");

  assert.throws(
    () => applyStockDeltaToPayload({ ...payload, currentStock: 2, stock: 2 }, {
      deltaCurrent: 1,
      variantKey: "red",
      allowInactiveVariant: true,
      allowArchivedVariantRestore: true,
      actor: "admin",
      overrideReason: "Retur historis sah.",
    }),
    (error) => error.errorCode === "INVENTORY_VARIANT_MODE_RESTORE_BLOCKED",
  );
});

test("create dan update menolak duplikat varian aktif/nonaktif dengan identitas sama", () => {
  assert.throws(
    () => normalizeInventoryMasterCreate({
      hasVariants: true,
      variants: [
        {
          variantKey: "red-active",
          variantLabel: "Merah",
          currentStock: 0,
          reservedStock: 0,
          isActive: true,
        },
        {
          variantKey: "red-inactive",
          variantLabel: "Merah",
          currentStock: 0,
          reservedStock: 0,
          isActive: false,
        },
      ],
    }),
    (error) => error.errorCode === "INVENTORY_VARIANT_DUPLICATE",
  );

  const currentPayload = {
    id: "product-duplicate",
    code: "PRD-DUP",
    name: "Produk Duplikat",
    updatedAt: "2026-06-21T00:00:00.000Z",
    hasVariants: true,
    variants: [{
      variantKey: "red",
      variantLabel: "Merah",
      currentStock: 0,
      reservedStock: 0,
      isActive: true,
    }],
  };

  assert.throws(
    () => sanitizeInventoryMasterUpdate({
      current: {
        ...currentPayload,
        currentStock: 0,
        reservedStock: 0,
        availableStock: 0,
        versionToken: currentPayload.updatedAt,
      },
      currentPayload,
      incomingPayload: {
        expectedVersion: currentPayload.updatedAt,
        hasVariants: true,
        variants: [
          { variantKey: "red", variantLabel: "Merah", isActive: true },
          { variantKey: "red", variantLabel: "Merah Baru", isActive: true },
        ],
      },
      mergedPayload: currentPayload,
      req: { localAuth: { user: { username: "admin" } } },
    }),
    (error) => error.errorCode === "INVENTORY_VARIANT_DUPLICATE",
  );
});
