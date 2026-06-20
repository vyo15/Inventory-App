const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("production-planning");
const { upsertJsonRecord } = require("../src/utils/sqliteStockEngine");
const {
  cancelProductionPlan,
  createOrderFromPlan,
} = require("../src/modules/production/production.service");

before(testDatabase.initialize);
beforeEach(testDatabase.reset);
after(testDatabase.cleanup);

const seedBom = async (id = "bom-plan") => {
  const db = await testDatabase.getDb();
  return upsertJsonRecord(db, "production_boms", {
    id,
    code: "BOM-PLAN",
    name: "BOM Planning",
    targetType: "product",
    targetId: "product-plan",
    targetCode: "PROD-PLAN",
    targetName: "Produk Planning",
    targetUnit: "pcs",
    materialLines: [{
      id: "line-1",
      itemType: "raw_material",
      itemId: "raw-plan",
      itemCode: "RAW-PLAN",
      itemName: "Bahan Planning",
      qtyPerUnit: 2,
    }],
    status: "active",
    isActive: true,
  });
};

const seedPlan = async ({ id = "plan-1", code = "PLN-001", status = "draft" } = {}) => {
  const db = await testDatabase.getDb();
  return upsertJsonRecord(db, "production_planning", {
    id,
    code,
    planCode: code,
    name: code,
    bomId: "bom-plan",
    targetQty: 3,
    status,
    isActive: true,
  });
};

test("create order dari planning mengikat Planning dan PO dalam satu transaksi", async () => {
  await seedBom();
  await seedPlan();

  const result = await createOrderFromPlan({
    planId: "plan-1",
    payload: { orderQty: 3, priority: "high" },
    actor: "tester",
  });

  assert.equal(result.plan.status, "ordered");
  assert.equal(result.plan.productionOrderId, result.order.id);
  assert.equal(result.order.sourcePlanId, "plan-1");
  assert.equal(result.order.bomId, "bom-plan");
  assert.equal(result.order.targetId, "product-plan");
  assert.equal(result.order.materialRequirementLines[0].requiredQty, 6);

  const db = await testDatabase.getDb();
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM production_orders) AS order_count,
      (SELECT COUNT(*) FROM audit_logs WHERE action = 'create_order_from_plan') AS audit_count
  `);
  assert.deepEqual(counts, { order_count: 1, audit_count: 1 });

  await assert.rejects(
    createOrderFromPlan({ planId: "plan-1", payload: { orderQty: 3 }, actor: "tester" }),
    /sudah memiliki Production Order/,
  );
});

test("target Production Order selalu mengikuti BOM dan tidak dapat dioverride client", async () => {
  await seedBom();
  await seedPlan({ id: "plan-target", code: "PLN-TARGET" });

  await assert.rejects(
    createOrderFromPlan({
      planId: "plan-target",
      payload: {
        orderQty: 1,
        targetType: "product",
        targetId: "product-client-tampered",
      },
      actor: "tester",
    }),
    /harus mengikuti target Resep Produksi\/BOM/,
  );

  const db = await testDatabase.getDb();
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM production_orders) AS order_count,
      (SELECT COUNT(*) FROM audit_logs WHERE action = 'create_order_from_plan') AS audit_count
  `);
  assert.deepEqual(counts, { order_count: 0, audit_count: 0 });
});

test("kegagalan update planning me-rollback insert Production Order", async () => {
  await seedBom();
  await seedPlan({ id: "plan-rollback", code: "PLN-ROLLBACK" });
  const db = await testDatabase.getDb();
  await db.exec(`
    CREATE TRIGGER fail_plan_update
    BEFORE UPDATE ON production_planning
    WHEN OLD.id = 'plan-rollback'
    BEGIN
      SELECT RAISE(ABORT, 'forced planning update failure');
    END;
  `);

  await assert.rejects(
    createOrderFromPlan({
      planId: "plan-rollback",
      payload: { code: "PO-ROLLBACK", orderQty: 2 },
      actor: "tester",
    }),
    /forced planning update failure/,
  );

  const order = await db.get("SELECT id FROM production_orders WHERE code = 'PO-ROLLBACK'");
  const plan = await db.get("SELECT status, payload_json FROM production_planning WHERE id = 'plan-rollback'");
  assert.equal(order, undefined);
  assert.equal(plan.status, "draft");
  assert.equal(JSON.parse(plan.payload_json).productionOrderId || "", "");

  await db.exec("DROP TRIGGER fail_plan_update");
});

test("planning tanpa PO dapat dibatalkan, planning dengan PO ditolak", async () => {
  await seedBom();
  await seedPlan({ id: "plan-cancel", code: "PLN-CANCEL" });
  const cancelled = await cancelProductionPlan({ planId: "plan-cancel", actor: "tester" });
  assert.equal(cancelled.status, "cancelled");

  const db = await testDatabase.getDb();
  const linkedPlan = await seedPlan({ id: "plan-linked", code: "PLN-LINKED" });
  await upsertJsonRecord(db, "production_planning", {
    ...linkedPlan,
    productionOrderId: "PO-EXISTS",
    orderId: "PO-EXISTS",
  });

  await assert.rejects(
    cancelProductionPlan({ planId: "plan-linked", actor: "tester" }),
    /sudah memiliki Production Order/,
  );
});
