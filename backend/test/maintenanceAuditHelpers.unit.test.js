const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildStockReadModelSourceAuditRow,
  getCanonicalVariantSnapshot,
  getSnapshotIssues,
  getStockReadModelActualSnapshot,
  getStockReadModelExpectedSnapshot,
  toInventoryMasterPayload,
} = require("../src/modules/maintenance/maintenance.auditHelpers");

test("maintenance audit helper normalizes master and legacy variants deterministically", () => {
  const payload = toInventoryMasterPayload({
    id: "rm-1",
    code: "rm-001",
    name: "Kain",
    current_stock: 8.4,
    reserved_stock: 2,
    available_stock: 6,
    min_stock_alert: 3,
    payload_json: JSON.stringify({
      variantOptions: [
        { variantKey: "B", stock: 3, reservedStock: 1 },
        { variantKey: "a", currentStock: 5, reservedStock: 1 },
      ],
    }),
  });

  assert.equal(payload.currentStock, 8);
  assert.deepEqual(getCanonicalVariantSnapshot(payload), [
    { key: "a", currentStock: 5, reservedStock: 1, availableStock: 4, isActive: true, isArchived: false },
    { key: "b", currentStock: 3, reservedStock: 1, availableStock: 2, isActive: true, isArchived: false },
  ]);
});

test("maintenance audit helper compares expected and actual read model snapshots", () => {
  const sourceConfig = {
    sourceType: "raw_material",
    sourceCollection: "raw_materials",
    sourceLabel: "Bahan Baku",
  };
  const payload = {
    id: "rm-1",
    code: "RM-001",
    name: "Kain",
    status: "active",
    isActive: true,
    currentStock: 8,
    reservedStock: 2,
    availableStock: 6,
    minStockAlert: 3,
    variants: [],
  };
  const expected = getStockReadModelExpectedSnapshot(payload, sourceConfig);
  const actual = getStockReadModelActualSnapshot({
    id: expected.id,
    code: expected.code,
    name: expected.name,
    status: expected.status,
    is_active: 1,
    current_stock: 8,
    reserved_stock: 2,
    available_stock: 5,
    min_stock_alert: 3,
    source_type: sourceConfig.sourceType,
    source_id: payload.id,
    payload_json: JSON.stringify({
      sourceCollection: sourceConfig.sourceCollection,
      sourceType: sourceConfig.sourceType,
      sourceId: payload.id,
      variants: [],
    }),
  });

  assert.deepEqual(getSnapshotIssues(expected, actual), ["available stock"]);
  assert.deepEqual(buildStockReadModelSourceAuditRow({ sourceConfig, expected }, {
    category: "safe_repair",
    issueType: "stale",
  }), {
    key: "raw_material__rm-1",
    readModelId: "raw_material__rm-1",
    sourceCollection: "raw_materials",
    sourceType: "raw_material",
    sourceId: "rm-1",
    sourceLabel: "Bahan Baku",
    itemName: "Kain",
    category: "safe_repair",
    issueType: "stale",
  });
});
