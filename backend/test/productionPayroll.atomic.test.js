const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("production-payroll");
const { upsertJsonRecord } = require("../src/utils/sqliteStockEngine");
const { createFinanceMovement } = require("../src/utils/sqliteFinanceEngine");
const {
  assertDirectCreateAllowed,
  completeProductionWorkLog,
  createOrderCommit,
  markProductionPayrollPaid,
  startProductionOrder,
} = require("../src/modules/production/production.service");

before(testDatabase.initialize);
beforeEach(testDatabase.reset);
after(testDatabase.cleanup);

const prepareCompletedProduction = async () => {
  const db = await testDatabase.getDb();
  await upsertJsonRecord(db, "raw_materials", {
    id: "raw-pay",
    code: "RAW-PAY",
    name: "Bahan Payroll",
    currentStock: 10,
    availableStock: 10,
    averageActualUnitCost: 100,
    status: "active",
    isActive: true,
  });
  await upsertJsonRecord(db, "products", {
    id: "product-pay",
    code: "PROD-PAY",
    name: "Produk Payroll",
    currentStock: 0,
    availableStock: 0,
    hppPerUnit: 0,
    status: "active",
    isActive: true,
  });
  await upsertJsonRecord(db, "production_steps", {
    id: "step-pay",
    code: "STP-PAY",
    name: "Rakit Payroll",
    payrollMode: "per_qty",
    payrollRate: 500,
    payrollQtyBase: 1,
    payrollOutputBasis: "good_qty",
    payrollClassification: "direct_labor",
    includePayrollInHpp: true,
    status: "active",
    isActive: true,
  });
  await upsertJsonRecord(db, "production_employees", {
    id: "emp-pay",
    code: "EMP-PAY",
    name: "Operator Payroll",
    status: "active",
    isActive: true,
  });
  await upsertJsonRecord(db, "production_boms", {
    id: "bom-pay",
    code: "BOM-PAY",
    name: "BOM Payroll",
    targetType: "product",
    targetId: "product-pay",
    targetCode: "PROD-PAY",
    targetName: "Produk Payroll",
    overheadCostEstimate: 50,
    materialLines: [{
      itemType: "raw_material",
      itemId: "raw-pay",
      itemCode: "RAW-PAY",
      itemName: "Bahan Payroll",
      qtyPerUnit: 2,
    }],
    stepLines: [{
      stepId: "step-pay",
      stepCode: "STP-PAY",
      stepName: "Rakit Payroll",
      payrollMode: "per_qty",
      payrollRate: 500,
      payrollQtyBase: 1,
      payrollOutputBasis: "good_qty",
      payrollClassification: "direct_labor",
      includePayrollInHpp: true,
    }],
    status: "active",
    isActive: true,
  });

  const order = await createOrderCommit({
    actor: "tester",
    payload: { code: "PO-PAY", bomId: "bom-pay", orderQty: 2 },
  });
  const started = await startProductionOrder({ orderId: order.id, actor: "tester" });
  const completed = await completeProductionWorkLog({
    workLogId: started.workLog.id,
    payload: {
      goodQty: 2,
      actualOutputQty: 2,
      workerIds: ["emp-pay"],
      workerNames: ["Operator Payroll"],
      workerCodes: ["EMP-PAY"],
    },
    actor: "tester",
  });
  const payrolls = await db.all("SELECT * FROM production_payrolls");
  return {
    db,
    order,
    workLog: completed.workLog,
    payroll: JSON.parse(payrolls[0].payload_json),
  };
};

test("Payroll paid membuat expense dan ledger sekali serta reconcile HPP", async () => {
  const { db, workLog, payroll } = await prepareCompletedProduction();
  const result = await markProductionPayrollPaid({
    payrollId: payroll.id,
    payload: { finalAmount: 1200, paidAt: "2026-06-20T10:00:00.000Z" },
    actor: "admin",
  });

  assert.equal(result.payroll.status, "paid");
  assert.equal(result.payroll.paymentStatus, "paid");
  assert.equal(result.expenseSyncStatus, "created");
  assert.equal(result.workLog.laborCostActual, 1200);
  assert.equal(result.workLog.totalCostActual, 1700);
  assert.equal(result.workLog.costPerGoodUnit, 850);

  const product = await db.get("SELECT payload_json FROM products WHERE id = 'product-pay'");
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM expenses) AS expense_count,
      (SELECT COUNT(*) FROM money_movement_ledger) AS ledger_count,
      (SELECT COUNT(*) FROM audit_logs WHERE action = 'payroll_paid') AS payroll_audit_count
  `);
  assert.equal(JSON.parse(product.payload_json).hppPerUnit, 850);
  assert.deepEqual(counts, { expense_count: 1, ledger_count: 1, payroll_audit_count: 1 });

  const repeated = await markProductionPayrollPaid({
    payrollId: payroll.id,
    payload: { finalAmount: 1200 },
    actor: "admin",
  });
  assert.equal(repeated.expenseSyncStatus, "already_exists");
  const repeatedCounts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM expenses) AS expense_count,
      (SELECT COUNT(*) FROM money_movement_ledger) AS ledger_count
  `);
  assert.deepEqual(repeatedCounts, { expense_count: 1, ledger_count: 1 });

  const workLogRow = await db.get("SELECT payload_json FROM production_work_logs WHERE id = ?", [workLog.id]);
  assert.equal(JSON.parse(workLogRow.payload_json).costPerGoodUnit, 850);
});

test("manual payroll duplicate untuk Work Log, Step, dan Operator yang sama ditolak", async () => {
  const { db, workLog, payroll } = await prepareCompletedProduction();

  await assert.rejects(assertDirectCreateAllowed({
    db,
    entityType: "production_payroll",
    payload: {
      status: "draft",
      paymentStatus: "unpaid",
      workLogId: workLog.id,
      stepId: payroll.stepId,
      workerId: payroll.workerId,
      workerName: payroll.workerName,
    },
  }), /sudah ada/);
});

test("Payroll paid mengenali expense legacy berdasarkan source payroll dan tidak membuat duplikat", async () => {
  const { db, payroll } = await prepareCompletedProduction();
  await createFinanceMovement(db, {
    direction: "out",
    actor: "legacy",
    sourceModule: "production_payrolls",
    sourceId: payroll.id,
    sourceRef: payroll.payrollNumber,
    description: "Legacy payroll expense",
    payload: {
      id: "legacy-payroll-expense",
      referenceNumber: "CSH-OUT-LEGACY-PAYROLL",
      type: "Payroll Produksi",
      amount: payroll.finalAmount,
      sourceModule: "production_payrolls",
      sourceType: "auto_production_payroll",
      sourceId: payroll.id,
      sourceRef: payroll.payrollNumber,
      relatedPayrollId: payroll.id,
      status: "Tercatat",
    },
  });

  const result = await markProductionPayrollPaid({
    payrollId: payroll.id,
    payload: { finalAmount: payroll.finalAmount },
    actor: "admin",
  });

  assert.equal(result.expenseSyncStatus, "already_exists");
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM expenses) AS expense_count,
      (SELECT COUNT(*) FROM money_movement_ledger) AS ledger_count
  `);
  assert.deepEqual(counts, { expense_count: 1, ledger_count: 1 });
});

test("kegagalan finance me-rollback status paid dan HPP payroll", async () => {
  const { db, workLog, payroll } = await prepareCompletedProduction();
  await db.exec(`
    CREATE TRIGGER fail_payroll_expense
    BEFORE INSERT ON expenses
    WHEN NEW.id = 'production_payroll_expense_PAY-001'
    BEGIN
      SELECT RAISE(ABORT, 'forced payroll expense failure');
    END;
  `);

  await assert.rejects(
    markProductionPayrollPaid({
      payrollId: payroll.id,
      payload: { finalAmount: 1200 },
      actor: "admin",
    }),
    /forced payroll expense failure/,
  );

  const payrollRow = await db.get("SELECT payload_json FROM production_payrolls WHERE id = ?", [payroll.id]);
  const workLogRow = await db.get("SELECT payload_json FROM production_work_logs WHERE id = ?", [workLog.id]);
  const productRow = await db.get("SELECT payload_json FROM products WHERE id = 'product-pay'");
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM expenses) AS expense_count,
      (SELECT COUNT(*) FROM money_movement_ledger) AS ledger_count
  `);

  const payrollPayload = JSON.parse(payrollRow.payload_json);
  const workLogPayload = JSON.parse(workLogRow.payload_json);
  const productPayload = JSON.parse(productRow.payload_json);
  assert.equal(payrollPayload.status, "draft");
  assert.equal(payrollPayload.paymentStatus, "unpaid");
  assert.equal(workLogPayload.costPerGoodUnit, 750);
  assert.equal(productPayload.hppPerUnit, 750);
  assert.deepEqual(counts, { expense_count: 0, ledger_count: 0 });

  await db.exec("DROP TRIGGER fail_payroll_expense");
});
