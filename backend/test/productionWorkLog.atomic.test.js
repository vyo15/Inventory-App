const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("production-work-log");
const { upsertJsonRecord } = require("../src/utils/sqliteStockEngine");
const {
  completeProductionWorkLog,
  createOrderCommit,
  startProductionOrder,
} = require("../src/modules/production/production.service");

before(testDatabase.initialize);
beforeEach(testDatabase.reset);
after(testDatabase.cleanup);

const seedMasterData = async ({ missingOutput = false, secondMaterialMissing = false } = {}) => {
  const db = await testDatabase.getDb();
  await upsertJsonRecord(db, "raw_materials", {
    id: "raw-1",
    code: "RAW-001",
    name: "Bahan Utama",
    currentStock: 10,
    reservedStock: 0,
    availableStock: 10,
    averageActualUnitCost: 100,
    status: "active",
    isActive: true,
  });
  if (!missingOutput) {
    await upsertJsonRecord(db, "products", {
      id: "product-1",
      code: "PROD-001",
      name: "Produk Jadi",
      currentStock: 0,
      reservedStock: 0,
      availableStock: 0,
      hppPerUnit: 0,
      status: "active",
      isActive: true,
    });
  }
  await upsertJsonRecord(db, "production_steps", {
    id: "step-1",
    code: "STP-001",
    name: "Rakit",
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
    id: "emp-1",
    code: "EMP-001",
    name: "Operator Satu",
    status: "active",
    isActive: true,
  });

  const materialLines = [{
    id: "mat-1",
    itemType: "raw_material",
    itemId: "raw-1",
    itemCode: "RAW-001",
    itemName: "Bahan Utama",
    qtyPerUnit: 2,
  }];
  if (secondMaterialMissing) {
    materialLines.push({
      id: "mat-missing",
      itemType: "raw_material",
      itemId: "raw-missing",
      itemCode: "RAW-MISSING",
      itemName: "Bahan Hilang",
      qtyPerUnit: 1,
    });
  }

  await upsertJsonRecord(db, "production_boms", {
    id: "bom-1",
    code: "BOM-001",
    name: "BOM Produk",
    targetType: "product",
    targetId: "product-1",
    targetCode: "PROD-001",
    targetName: "Produk Jadi",
    targetUnit: "pcs",
    overheadCostEstimate: 50,
    materialLines,
    stepLines: [{
      stepId: "step-1",
      stepCode: "STP-001",
      stepName: "Rakit",
      sequenceNo: 1,
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
};

const createOrder = () => createOrderCommit({
  actor: "tester",
  payload: {
    code: "PO-001",
    bomId: "bom-1",
    orderQty: 2,
  },
});

test("Start Production memotong seluruh material dan membuat satu Work Log secara atomic", async () => {
  await seedMasterData();
  const order = await createOrder();
  const result = await startProductionOrder({ orderId: order.id, actor: "tester" });

  assert.equal(result.order.status, "in_production");
  assert.equal(result.order.workLogId, result.workLog.id);
  assert.equal(result.workLog.status, "in_progress");
  assert.equal(result.workLog.materialUsages[0].stockDeducted, true);
  assert.equal(result.workLog.materialUsages[0].actualQty, 4);
  assert.equal(result.workLog.materialUsages[0].costPerUnitSnapshot, 100);

  const db = await testDatabase.getDb();
  const raw = await db.get("SELECT current_stock FROM raw_materials WHERE id = 'raw-1'");
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM production_work_logs) AS work_log_count,
      (SELECT COUNT(*) FROM inventory_logs) AS inventory_count,
      (SELECT COUNT(*) FROM audit_logs WHERE action = 'start_production') AS start_audit_count
  `);
  assert.equal(raw.current_stock, 6);
  assert.deepEqual(counts, { work_log_count: 1, inventory_count: 1, start_audit_count: 1 });

  await assert.rejects(
    startProductionOrder({ orderId: order.id, actor: "tester" }),
    /sudah memiliki Work Log|sudah memiliki Work Log aktif/,
  );
  const rawAfterRetry = await db.get("SELECT current_stock FROM raw_materials WHERE id = 'raw-1'");
  assert.equal(rawAfterRetry.current_stock, 6);
});

test("Start Production menolak step yang tidak terdaftar pada BOM", async () => {
  await seedMasterData();
  const order = await createOrder();

  await assert.rejects(
    startProductionOrder({
      orderId: order.id,
      payload: { stepId: "step-client-tampered" },
      actor: "tester",
    }),
    /tidak terdaftar pada Resep Produksi\/BOM/,
  );

  const db = await testDatabase.getDb();
  const raw = await db.get("SELECT current_stock FROM raw_materials WHERE id = 'raw-1'");
  const orderRow = await db.get("SELECT status FROM production_orders WHERE id = ?", [order.id]);
  const workLogCount = await db.get("SELECT COUNT(*) AS count FROM production_work_logs");
  assert.equal(raw.current_stock, 10);
  assert.equal(orderRow.status, "draft");
  assert.equal(workLogCount.count, 0);
});

test("kegagalan material kedua me-rollback material pertama, Work Log, dan status PO", async () => {
  await seedMasterData({ secondMaterialMissing: true });
  const order = await createOrder();

  await assert.rejects(
    startProductionOrder({ orderId: order.id, actor: "tester" }),
    /Item stok database lokal tidak ditemukan/,
  );

  const db = await testDatabase.getDb();
  const raw = await db.get("SELECT current_stock FROM raw_materials WHERE id = 'raw-1'");
  const orderRow = await db.get("SELECT status, payload_json FROM production_orders WHERE id = ?", [order.id]);
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM production_work_logs) AS work_log_count,
      (SELECT COUNT(*) FROM inventory_logs) AS inventory_count,
      (SELECT COUNT(*) FROM audit_logs WHERE action = 'production_material_out') AS material_audit_count
  `);

  assert.equal(raw.current_stock, 10);
  assert.equal(orderRow.status, "draft");
  assert.equal(JSON.parse(orderRow.payload_json).workLogId || "", "");
  assert.deepEqual(counts, { work_log_count: 0, inventory_count: 0, material_audit_count: 0 });
});

test("Complete Work Log menambah output, membuat payroll, menutup PO, dan menghitung HPP satu kali", async () => {
  await seedMasterData();
  const order = await createOrder();
  const started = await startProductionOrder({ orderId: order.id, actor: "tester" });

  const result = await completeProductionWorkLog({
    workLogId: started.workLog.id,
    payload: {
      goodQty: 2,
      actualOutputQty: 2,
      workerIds: ["emp-1"],
      workerNames: ["Operator Satu"],
      workerCodes: ["EMP-001"],
      workerCount: 1,
      materialUsages: [{
        itemType: "raw_material",
        itemId: "raw-client-tampered",
        actualQty: 999,
        stockDeducted: true,
        totalCostSnapshot: 1,
      }],
      outputs: [{
        outputType: "product",
        outputIdRef: "product-client-tampered",
        goodQty: 999,
        stockAdded: true,
      }],
      targetId: "product-client-tampered",
      materialCostActual: 1,
      laborCostActual: 1,
      totalCostActual: 1,
      costPerGoodUnit: 1,
    },
    actor: "tester",
  });

  assert.equal(result.workLog.status, "completed");
  assert.equal(result.order.status, "completed");
  assert.equal(result.payroll.createdCount, 1);
  assert.equal(result.workLog.materialCostActual, 400);
  assert.equal(result.workLog.laborCostActual, 1000);
  assert.equal(result.workLog.overheadCostActual, 100);
  assert.equal(result.workLog.totalCostActual, 1500);
  assert.equal(result.workLog.costPerGoodUnit, 750);
  assert.equal(result.workLog.targetId, "product-1");
  assert.equal(result.workLog.materialUsages[0].itemId, "raw-1");
  assert.equal(result.workLog.outputs[0].outputIdRef, "product-1");

  const db = await testDatabase.getDb();
  const product = await db.get("SELECT current_stock, payload_json FROM products WHERE id = 'product-1'");
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM production_payrolls) AS payroll_count,
      (SELECT COUNT(*) FROM inventory_logs) AS inventory_count,
      (SELECT COUNT(*) FROM audit_logs WHERE action = 'complete_work_log') AS complete_audit_count
  `);
  assert.equal(product.current_stock, 2);
  assert.equal(JSON.parse(product.payload_json).hppPerUnit, 750);
  assert.deepEqual(counts, { payroll_count: 1, inventory_count: 2, complete_audit_count: 1 });

  await assert.rejects(
    completeProductionWorkLog({ workLogId: started.workLog.id, payload: { goodQty: 2 }, actor: "tester" }),
    /sudah completed/,
  );
  const productAfterRetry = await db.get("SELECT current_stock FROM products WHERE id = 'product-1'");
  assert.equal(productAfterRetry.current_stock, 2);
});

test("kegagalan output me-rollback payroll dan status complete tanpa mengulang material yang sudah dipotong saat Start", async () => {
  await seedMasterData({ missingOutput: true });
  const order = await createOrder();
  const started = await startProductionOrder({ orderId: order.id, actor: "tester" });

  await assert.rejects(
    completeProductionWorkLog({
      workLogId: started.workLog.id,
      payload: {
        goodQty: 2,
        actualOutputQty: 2,
        workerIds: ["emp-1"],
        workerNames: ["Operator Satu"],
      },
      actor: "tester",
    }),
    /Item stok database lokal tidak ditemukan/,
  );

  const db = await testDatabase.getDb();
  const raw = await db.get("SELECT current_stock FROM raw_materials WHERE id = 'raw-1'");
  const workLog = await db.get("SELECT status FROM production_work_logs WHERE id = ?", [started.workLog.id]);
  const orderRow = await db.get("SELECT status FROM production_orders WHERE id = ?", [order.id]);
  const payrollCount = await db.get("SELECT COUNT(*) AS count FROM production_payrolls");
  assert.equal(raw.current_stock, 6);
  assert.equal(workLog.status, "in_progress");
  assert.equal(orderRow.status, "in_production");
  assert.equal(payrollCount.count, 0);
});

test("Start Production menolak BOM legacy dengan lebih dari satu tahapan", async () => {
  await seedMasterData();
  const db = await testDatabase.getDb();
  const bomRow = await db.get("SELECT payload_json FROM production_boms WHERE id = 'bom-1'");
  const bom = JSON.parse(bomRow.payload_json);
  await upsertJsonRecord(db, "production_boms", {
    ...bom,
    stepLines: [
      ...bom.stepLines,
      { stepId: "step-2", stepCode: "STP-002", stepName: "Tahap Kedua", sequenceNo: 2 },
    ],
  });

  await assert.rejects(createOrder(), /tepat 1 Tahapan Produksi/);
  const orderCount = await db.get("SELECT COUNT(*) AS count FROM production_orders");
  assert.equal(orderCount.count, 0);
});

test("Payroll memakai snapshot tarif saat Start walau master Tahapan berubah sebelum Complete", async () => {
  await seedMasterData();
  const order = await createOrder();
  const started = await startProductionOrder({ orderId: order.id, actor: "tester" });
  const db = await testDatabase.getDb();
  const stepRow = await db.get("SELECT payload_json FROM production_steps WHERE id = 'step-1'");
  const step = JSON.parse(stepRow.payload_json);
  await upsertJsonRecord(db, "production_steps", {
    ...step,
    payrollRate: 900,
    updatedAt: new Date().toISOString(),
  });

  const result = await completeProductionWorkLog({
    workLogId: started.workLog.id,
    payload: {
      goodQty: 2,
      actualOutputQty: 2,
      workerIds: ["emp-1"],
      workerNames: ["Operator Satu"],
    },
    actor: "tester",
  });

  assert.equal(started.workLog.stepPayrollRate, 500);
  assert.equal(started.workLog.stepPayrollRuleSource, "production_step_start_snapshot");
  assert.equal(result.workLog.laborCostActual, 1000);
  const payrollRow = await db.get("SELECT payload_json FROM production_payrolls LIMIT 1");
  const payroll = JSON.parse(payrollRow.payload_json);
  assert.equal(payroll.payrollRate, 500);
  assert.equal(payroll.finalAmount, 1000);
  assert.equal(payroll.payrollRuleSource, "production_step_start_snapshot");
});

test("Complete Work Log menolak lebih dari satu operator agar payroll tidak berlipat", async () => {
  await seedMasterData();
  const db = await testDatabase.getDb();
  await upsertJsonRecord(db, "production_employees", {
    id: "emp-2",
    code: "EMP-002",
    name: "Operator Dua",
    status: "active",
    isActive: true,
  });
  const order = await createOrder();
  const started = await startProductionOrder({ orderId: order.id, actor: "tester" });

  await assert.rejects(
    completeProductionWorkLog({
      workLogId: started.workLog.id,
      payload: {
        goodQty: 2,
        actualOutputQty: 2,
        workerIds: ["emp-1", "emp-2"],
        workerNames: ["Operator Satu", "Operator Dua"],
      },
      actor: "tester",
    }),
    /hanya boleh memiliki 1 operator/,
  );

  const workLog = await db.get("SELECT status FROM production_work_logs WHERE id = ?", [started.workLog.id]);
  const product = await db.get("SELECT current_stock FROM products WHERE id = 'product-1'");
  const payrollCount = await db.get("SELECT COUNT(*) AS count FROM production_payrolls");
  assert.equal(workLog.status, "in_progress");
  assert.equal(product.current_stock, 0);
  assert.equal(payrollCount.count, 0);
});

test("Complete Work Log menolak operator nonaktif", async () => {
  await seedMasterData();
  const db = await testDatabase.getDb();
  const employeeRow = await db.get("SELECT payload_json FROM production_employees WHERE id = 'emp-1'");
  const employee = JSON.parse(employeeRow.payload_json);
  await upsertJsonRecord(db, "production_employees", {
    ...employee,
    status: "inactive",
    isActive: false,
  });
  const order = await createOrder();
  const started = await startProductionOrder({ orderId: order.id, actor: "tester" });

  await assert.rejects(
    completeProductionWorkLog({
      workLogId: started.workLog.id,
      payload: {
        goodQty: 2,
        actualOutputQty: 2,
        workerIds: ["emp-1"],
        workerNames: ["Operator Satu"],
      },
      actor: "tester",
    }),
    /sudah nonaktif/,
  );

  const payrollCount = await db.get("SELECT COUNT(*) AS count FROM production_payrolls");
  assert.equal(payrollCount.count, 0);
});
