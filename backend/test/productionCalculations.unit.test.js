const assert = require("node:assert/strict");
const test = require("node:test");
const {
  calculatePayrollLineAmounts,
  calculateRequirementLines,
  calculateWeightedVariantCost,
  getEffectiveLaborCost,
  getMaterialCostTotal,
  normalizeSourceType,
  reconcileAverageUnitCost,
} = require("../src/modules/production/production.calculations");

test("production calculations normalize source aliases and BOM requirements", () => {
  assert.equal(normalizeSourceType("materials"), "materials");
  assert.equal(normalizeSourceType("raw_materials"), "raw_material");
  assert.equal(normalizeSourceType("products"), "product");

  assert.deepEqual(calculateRequirementLines({
    materials: [{ sourceType: "raw", sourceId: "rm-1", qtyPerUnit: 2 }],
  }, 3), [{
    sourceType: "raw",
    sourceId: "rm-1",
    qtyPerUnit: 2,
    id: "req-1",
    itemType: "raw_material",
    itemId: "rm-1",
    itemCode: "",
    itemName: "",
    requiredQty: 6,
    qtyRequired: 6,
    totalRequiredQty: 6,
    status: "ready_check_required",
  }]);
});

test("production payroll calculation preserves per-qty and per-batch behavior", () => {
  assert.deepEqual(calculatePayrollLineAmounts({
    workLog: { goodQty: 8, actualOutputQty: 10, plannedQty: 12 },
    rule: { payrollMode: "per_qty", payrollOutputBasis: "actual_output_qty", payrollQtyBase: 2, payrollRate: 1500 },
  }), {
    outputQtyUsed: 10,
    workedQty: 10,
    payableQtyFactor: 5,
    amountCalculated: 7500,
    finalAmount: 7500,
  });

  assert.equal(calculatePayrollLineAmounts({
    workLog: { goodQty: 8, plannedQty: 3 },
    rule: { payrollMode: "per_batch", payrollRate: 2500 },
  }).finalAmount, 7500);
});

test("production HPP helpers keep weighted cost and final payroll rules", () => {
  assert.equal(reconcileAverageUnitCost({
    currentStock: 10,
    currentUnitCost: 100,
    affectedQty: 2,
    previousUnitCost: 80,
    nextUnitCost: 120,
  }), 108);

  assert.equal(calculateWeightedVariantCost([
    { currentStock: 2, hppPerUnit: 100 },
    { currentStock: 3, hppPerUnit: 200 },
    { currentStock: 10, hppPerUnit: 999, isActive: false },
  ], "hppPerUnit"), 160);

  assert.equal(getMaterialCostTotal({ materialUsages: [
    { totalCostSnapshot: 500 },
    { actualQty: 2, costPerUnitSnapshot: 125 },
  ] }), 750);

  assert.equal(getEffectiveLaborCost([
    { status: "paid", finalAmount: 1000 },
    { status: "draft", amountCalculated: 500, finalAmount: 900 },
    { status: "paid", finalAmount: 9999, includePayrollInHpp: false },
  ]), 1500);
});
