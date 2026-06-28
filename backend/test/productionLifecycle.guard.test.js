const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  assertDirectCreateAllowed,
  assertDirectUpdateAllowed,
} = require("../src/modules/production/production.service");
const { validateProductionBomPayload } = require("../src/modules/production/production.guards");

test("direct create Planning dan Payroll wajib memakai status awal aman", async () => {
  assert.equal(await assertDirectCreateAllowed({
    entityType: "production_planning",
    payload: { status: "draft" },
  }), true);

  await assert.rejects(assertDirectCreateAllowed({
    entityType: "production_planning",
    payload: { status: "ordered", productionOrderId: "PO-CLIENT" },
  }), /Planning baru wajib dibuat sebagai Draft/);

  assert.equal(await assertDirectCreateAllowed({
    entityType: "production_payroll",
    payload: {
      status: "draft",
      paymentStatus: "unpaid",
      workLogId: "work-1",
      workerId: "worker-1",
    },
  }), true);

  await assert.rejects(assertDirectCreateAllowed({
    entityType: "production_payroll",
    payload: { status: "paid", paymentStatus: "paid" },
  }), /wajib dibuat sebagai Draft\/Unpaid/);

  await assert.rejects(assertDirectCreateAllowed({
    entityType: "production_payroll",
    payload: {
      status: "draft",
      paymentStatus: "unpaid",
      workLogId: "work-1",
      workerId: "worker-1",
      financeExpenseId: "expense-client",
    },
  }), /tidak boleh membawa field finance/);
});

test("direct update tidak boleh mengubah lifecycle Planning", () => {
  assert.throws(() => assertDirectUpdateAllowed({
    entityType: "production_planning",
    currentPayload: { id: "plan-1", status: "draft" },
    mergedPayload: { id: "plan-1", status: "cancelled" },
  }), /endpoint create-order\/cancel resmi/);
});

test("direct update tidak boleh menulis relasi PO ke Planning", () => {
  assert.throws(() => assertDirectUpdateAllowed({
    entityType: "production_planning",
    currentPayload: { id: "plan-1", status: "draft", productionOrderId: "" },
    mergedPayload: { id: "plan-1", status: "draft", productionOrderId: "PO-CLIENT" },
  }), /Relasi Production Order.*endpoint create-order resmi/);
});

test("direct update tidak boleh menyelesaikan Work Log atau mengubah flag stok", () => {
  assert.throws(() => assertDirectUpdateAllowed({
    entityType: "production_work_log",
    currentPayload: {
      id: "work-1",
      status: "in_progress",
      stockOutputStatus: "pending",
    },
    mergedPayload: {
      id: "work-1",
      status: "completed",
      stockOutputStatus: "completed",
    },
  }), /endpoint complete resmi|Flag stok\/payroll/);
});

test("direct update tidak boleh mengubah snapshot material/output Work Log dari PO", () => {
  assert.throws(() => assertDirectUpdateAllowed({
    entityType: "production_work_log",
    currentPayload: {
      id: "work-1",
      status: "in_progress",
      productionOrderId: "PO-1",
      materialUsages: [{ itemId: "raw-1", actualQty: 2 }],
      outputs: [{ outputIdRef: "product-1", goodQty: 0 }],
    },
    mergedPayload: {
      id: "work-1",
      status: "in_progress",
      productionOrderId: "PO-1",
      materialUsages: [{ itemId: "raw-1", actualQty: 999 }],
      outputs: [{ outputIdRef: "product-1", goodQty: 0 }],
    },
  }), /Field inti Work Log.*terkunci/);
});

test("direct update tidak boleh menandai Payroll paid", () => {
  assert.throws(() => assertDirectUpdateAllowed({
    entityType: "production_payroll",
    currentPayload: {
      id: "pay-1",
      status: "draft",
      paymentStatus: "unpaid",
    },
    mergedPayload: {
      id: "pay-1",
      status: "paid",
      paymentStatus: "paid",
    },
  }), /endpoint finalize\/mark-paid resmi/);
});

test("direct update tidak boleh menulis field finance Payroll", () => {
  assert.throws(() => assertDirectUpdateAllowed({
    entityType: "production_payroll",
    currentPayload: {
      id: "pay-1",
      status: "draft",
      paymentStatus: "unpaid",
      financeExpenseId: "",
    },
    mergedPayload: {
      id: "pay-1",
      status: "draft",
      paymentStatus: "unpaid",
      financeExpenseId: "expense-client",
    },
  }), /Field finance Payroll.*mark-paid resmi/);
});

test("edit catatan Production Order draft tetap diizinkan", () => {
  assert.equal(assertDirectUpdateAllowed({
    entityType: "production_order",
    currentPayload: {
      id: "order-1",
      status: "draft",
      notes: "lama",
      bomId: "bom-1",
      targetId: "product-1",
      targetType: "product",
      orderQty: 2,
      targetQty: 2,
      requirementLines: [],
      materialRequirementLines: [],
    },
    mergedPayload: {
      id: "order-1",
      status: "draft",
      notes: "baru",
      bomId: "bom-1",
      targetId: "product-1",
      targetType: "product",
      orderQty: 2,
      targetQty: 2,
      requirementLines: [],
      materialRequirementLines: [],
    },
  }), true);
});


test("BOM wajib memiliki tepat satu Tahapan Produksi", async () => {
  const basePayload = {
    targetId: "semi-1",
    materialLines: [{ itemId: "raw-1", qtyPerUnit: 1 }],
  };

  await assert.rejects(
    validateProductionBomPayload({ payload: { ...basePayload, stepLines: [] } }),
    /tepat 1 Tahapan Produksi/,
  );
  await assert.rejects(
    validateProductionBomPayload({
      payload: {
        ...basePayload,
        stepLines: [{ stepId: "step-1" }, { stepId: "step-2" }],
      },
    }),
    /tepat 1 Tahapan Produksi/,
  );
  assert.equal(await validateProductionBomPayload({
    payload: { ...basePayload, stepLines: [{ stepId: "step-1" }] },
  }), true);
});
