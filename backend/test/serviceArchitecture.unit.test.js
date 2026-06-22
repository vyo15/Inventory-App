const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const readSource = (relativePath) => fs.readFileSync(
  path.resolve(__dirname, "..", relativePath),
  "utf8",
);

test("production service tetap menjadi facade public API untuk lifecycle guarded", () => {
  const serviceSource = readSource("src/modules/production/production.service.js");
  const orderSource = readSource("src/modules/production/production.order.service.js");
  const guardSource = readSource("src/modules/production/production.guards.js");

  assert.match(serviceSource, /require\("\.\/production\.order\.service"\)/);
  assert.match(serviceSource, /require\("\.\/production\.guards"\)/);
  assert.match(serviceSource, /completeProductionWorkLog/);
  assert.match(serviceSource, /markProductionPayrollPaid/);
  assert.match(orderSource, /runProductionTransaction/);
  assert.match(orderSource, /commitStockMutation/);
  assert.match(guardSource, /validateDirectCreate: assertDirectCreateAllowed/);
  assert.match(guardSource, /validateDirectUpdate: assertDirectUpdateAllowed/);
});

test("maintenance facade memisahkan data-quality dari backup restore tanpa mengubah export", () => {
  const serviceSource = readSource("src/modules/maintenance/maintenance.service.js");
  const dataQualitySource = readSource("src/modules/maintenance/maintenance.dataQuality.service.js");

  assert.match(serviceSource, /require\("\.\/maintenance\.dataQuality\.service"\)/);
  assert.match(serviceSource, /const executeRestore/);
  assert.match(serviceSource, /createRestorePlan/);
  assert.match(dataQualitySource, /const buildStockReadModelAudit/);
  assert.match(dataQualitySource, /const rebuildStockReadModels/);
  assert.match(dataQualitySource, /const getMaintenanceStatus/);
});
