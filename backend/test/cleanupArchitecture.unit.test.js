const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const ROOT_DIR = path.resolve(__dirname, "../..");
const readRootFile = (relativePath) => fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf8");

const passwordFixtures = [
  "",
  "A1short",
  `A1${"x".repeat(127)}`,
  "Password123",
  "tanpaangka",
  "123456789",
  "KataSandi-2026",
  "  KataSandi-2026  ",
];

test("wrapper ESM dan CJS password memakai canonical ESM core dan menghasilkan validasi identik", async () => {
  const cjsApi = require("../../shared/passwordPolicy.cjs");
  const esmApi = await import(pathToFileURL(path.join(ROOT_DIR, "shared/passwordPolicy.js")).href);

  passwordFixtures.forEach((password) => {
    assert.equal(
      esmApi.validatePasswordStrength(password),
      cjsApi.validatePasswordStrength(password),
      `hasil validasi berbeda untuk fixture ${JSON.stringify(password)}`,
    );
  });

  assert.deepEqual(esmApi.PASSWORD_POLICY, cjsApi.PASSWORD_POLICY);
  assert.match(readRootFile("shared/passwordPolicy.js"), /passwordPolicy\.core\.js/);
  assert.match(readRootFile("shared/passwordPolicy.cjs"), /passwordPolicy\.core\.js/);
  const compatibilityFacade = readRootFile("shared/passwordPolicy.core.cjs");
  assert.match(compatibilityFacade, /passwordPolicy\.core\.js/);
  assert.ok(compatibilityFacade.split(/\r?\n/).filter(Boolean).length <= 3);
});

test("formula katalog Supplier memiliki satu canonical implementation", async () => {
  const cjsApi = require("../../shared/supplierCatalogPricing.cjs");
  const esmApi = await import(pathToFileURL(path.join(ROOT_DIR, "shared/supplierCatalogPricing.js")).href);
  const fixtures = [
    {},
    { purchaseType: "offline", purchaseQty: 2, conversionValue: 10, supplierItemPrice: 20_000, estimatedShippingCost: 5_000 },
    { purchaseType: "online", purchaseQty: 2, conversionValue: 10, supplierItemPrice: 20_000, estimatedShippingCost: 5_000, serviceFee: 1_000, discount: 2_000 },
    { purchaseType: "online", purchaseQty: 1, conversionValue: 3, supplierItemPrice: 10_000, discount: 50_000 },
    { purchaseType: "online", purchaseQty: "invalid", conversionValue: 0, supplierItemPrice: -1 },
  ];

  fixtures.forEach((fixture) => {
    assert.deepEqual(
      esmApi.calculateSupplierCatalogMetrics(fixture),
      cjsApi.calculateSupplierCatalogMetrics(fixture),
    );
  });

  const frontendSource = readRootFile("frontend/src/services/MasterData/suppliersService.js");
  const backendSource = readRootFile("backend/src/modules/suppliers/suppliers.shared.js");
  assert.match(frontendSource, /shared\/supplierCatalogPricing\.js/);
  assert.match(backendSource, /shared\/supplierCatalogPricing\.cjs/);
  assert.match(readRootFile("shared/supplierCatalogPricing.js"), /supplierCatalogPricing\.core\.js/);
  assert.doesNotMatch(readRootFile("shared/supplierCatalogPricing.js"), /\.cjs["']/);
  const compatibilityFacade = readRootFile("shared/supplierCatalogPricing.core.cjs");
  assert.match(compatibilityFacade, /supplierCatalogPricing\.core\.js/);
  assert.ok(compatibilityFacade.split(/\r?\n/).filter(Boolean).length <= 3);
});

test("compatibility facade engine tetap tipis dan canonical module berada di domain yang tepat", () => {
  const facades = [
    ["backend/src/utils/sqliteStockEngine.js", /modules\/stock\/engine/],
    ["backend/src/utils/sqliteFinanceEngine.js", /modules\/finance\/finance\.engine/],
    ["backend/src/utils/sqliteBackup.js", /modules\/maintenance\/backup/],
    ["backend/src/shared/sqliteJsonRecordRoutes.js", /infrastructure\/http\/sqliteJsonRecordRouter/],
  ];

  facades.forEach(([relativePath, targetPattern]) => {
    const source = readRootFile(relativePath);
    assert.match(source, targetPattern);
    assert.ok(source.split(/\r?\n/).filter(Boolean).length <= 6, `${relativePath} harus tetap facade tipis`);
  });
});

test("frontend tidak kembali menjadi authority reconcile HPP produksi", () => {
  const helperSource = readRootFile("frontend/src/services/Produksi/helpers/productionWorkLogsServiceHelpers.js");
  assert.doesNotMatch(helperSource, /buildOutputHppReconcilePayload/);
  assert.doesNotMatch(helperSource, /reconcileAverageUnitCost/);
  assert.doesNotMatch(helperSource, /calculateWeightedVariantUnitCost/);

  const backendSource = readRootFile("backend/src/modules/production/production.calculations.js");
  assert.match(backendSource, /reconcileAverageUnitCost/);
  assert.match(backendSource, /calculateWeightedVariantCost/);
});

test("shared contract menjadi sumber role, category, serta business-code pattern", () => {
  const authContract = require("../../shared/authContract.json");
  const categoryContract = require("../../shared/categoryContract.json");
  const businessCodeContract = require("../../shared/businessCodeContract.json");
  const authConstants = require("../src/modules/auth/auth.constants");

  assert.deepEqual(authConstants.ROLES, authContract.roles);
  assert.deepEqual(authConstants.USER_STATUSES, authContract.userStatuses);
  assert.equal(categoryContract.defaultType, categoryContract.types.PRODUCT_FORM);
  assert.match("CUS-01012026-001", new RegExp(businessCodeContract.customer.pattern));
  assert.match("SUP-01012026-001", new RegExp(businessCodeContract.supplier.pattern));
});
