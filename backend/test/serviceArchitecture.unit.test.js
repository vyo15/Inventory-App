const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { TABLES } = require("../src/db/schema");

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
  assert.match(serviceSource, /require\("\.\/production\.workLogs\.service"\)/);
  assert.match(serviceSource, /require\("\.\/production\.payroll\.service"\)/);
  assert.match(serviceSource, /completeProductionWorkLog/);
  assert.match(serviceSource, /markProductionPayrollPaid/);
  assert.match(orderSource, /runProductionTransaction/);
  assert.match(orderSource, /commitStockMutation/);
  assert.match(guardSource, /validateDirectCreate: assertDirectCreateAllowed/);
  assert.match(guardSource, /validateDirectUpdate: assertDirectUpdateAllowed/);
});

test("maintenance facade memisahkan data-quality, backup, restore, catalog, dan setup", () => {
  const serviceSource = readSource("src/modules/maintenance/maintenance.service.js");
  const dataQualitySource = readSource("src/modules/maintenance/maintenance.dataQuality.service.js");

  assert.match(serviceSource, /require\("\.\/maintenance\.dataQuality\.service"\)/);
  assert.match(serviceSource, /require\("\.\/maintenance\.backupTransfer\.service"\)/);
  assert.match(serviceSource, /require\("\.\/maintenance\.restore\.service"\)/);
  assert.match(serviceSource, /require\("\.\/maintenance\.catalog\.service"\)/);
  assert.match(serviceSource, /require\("\.\/maintenance\.setup\.service"\)/);
  assert.match(serviceSource, /createRestorePlan/);
  assert.match(serviceSource, /executeRestore/);
  assert.match(dataQualitySource, /const buildStockReadModelAudit/);
  assert.match(dataQualitySource, /const rebuildStockReadModels/);
  assert.match(dataQualitySource, /const getMaintenanceStatus/);
});

test("server memasang lifecycle backup startup, interval, dan shutdown", () => {
  const serverSource = readSource("src/server.js");

  assert.match(serverSource, /runBackupLifecycleMaintenance\(\{ trigger: "startup" \}\)/);
  assert.match(serverSource, /startBackupLifecycleScheduler/);
  assert.match(serverSource, /stopBackupLifecycleScheduler/);
  assert.match(serverSource, /BACKUP_LIFECYCLE_INTERVAL_MS/);
  assert.doesNotMatch(serverSource, /const \{ ensureDailyBackupForToday \} = require/);
});

test("supplier service tetap facade tipis untuk identity dan catalog", () => {
  const serviceSource = readSource("src/modules/suppliers/suppliers.service.js");

  assert.match(serviceSource, /require\("\.\/suppliers\.identity\.service"\)/);
  assert.match(serviceSource, /require\("\.\/suppliers\.catalog\.service"\)/);
  assert.match(serviceSource, /createSupplier/);
  assert.match(serviceSource, /verifySupplierCatalogOffer/);
});

test("transaction service tetap facade tipis untuk purchase, sale, return, dan router", () => {
  const serviceSource = readSource("src/modules/transactions/transactions.service.js");

  assert.match(serviceSource, /require\("\.\/purchasesSalesCommit\.service"\)/);
  assert.match(serviceSource, /require\("\.\/returns\.service"\)/);
  assert.match(serviceSource, /require\("\.\/salesStatus\.service"\)/);
  assert.match(serviceSource, /require\("\.\/transactions\.routerDefinitions"\)/);
  assert.match(serviceSource, /commitPurchase/);
  assert.match(serviceSource, /commitReturn/);
  assert.match(serviceSource, /updateSaleStatus/);
});

test("cakupan data maintenance mencantumkan seluruh tabel schema SQLite", () => {
  const helperSource = fs.readFileSync(
    path.resolve(__dirname, "..", "..", "frontend", "src", "pages", "Utilities", "components", "restorePreviewHelpers.js"),
    "utf8",
  );

  for (const tableName of Object.values(TABLES)) {
    assert.match(
      helperSource,
      new RegExp(`["']${tableName}["']`),
      `Tabel ${tableName} belum dicakup oleh ringkasan maintenance frontend`,
    );
  }
});

test("maintenance purge tetap allowlist, ber-backup, ber-audit, dan tanpa batas scan tersembunyi", () => {
  const purgeSource = readSource("src/modules/maintenance/maintenance.purge.service.js");
  const auditSource = readSource("scripts/audit-sqlite-cutover-readiness.cjs");

  assert.match(purgeSource, /const INACTIVE_PURGE_CONFIRM_KEYWORD = "HAPUS PERMANEN"/);
  assert.match(purgeSource, /createOfficialSqliteBackup/);
  assert.match(purgeSource, /action: "inactive_record_purge"/);
  assert.match(purgeSource, /DELETE FROM \$\{config\.table\} WHERE id = \?/);
  assert.doesNotMatch(purgeSource, /LIMIT\s+5000/i);
  assert.doesNotMatch(purgeSource, /LIMIT\s+500\b/i);
  assert.match(auditSource, /hardDeletePolicy/);
  assert.match(auditSource, /\/api\/realtime/);
});

