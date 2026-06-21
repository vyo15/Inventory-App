const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { configureTestDatabase } = require("./helpers/testDatabase");

const testDatabase = configureTestDatabase("finance-ledger");
const {
  commitCashIn,
  commitCashOut,
  deleteCashOut,
} = require("../src/modules/finance/finance.service");

before(testDatabase.initialize);
beforeEach(testDatabase.reset);
after(testDatabase.cleanup);

test("cash-in membuat income dan pasangan ledger", async () => {
  const result = await commitCashIn({
    actor: "tester",
    payload: {
      id: "cash-in-001",
      referenceNumber: "CSH-IN-001",
      amount: 50000,
      description: "Modal test",
      transactionDate: "2026-06-20T00:00:00.000Z",
    },
  });

  const db = await testDatabase.getDb();
  const income = await db.get("SELECT * FROM incomes WHERE id = 'cash-in-001'");
  const ledger = await db.get("SELECT * FROM money_movement_ledger WHERE source_id = 'cash-in-001'");
  const ledgerPayload = JSON.parse(ledger.payload_json);

  assert.equal(result.movement.id, "cash-in-001");
  assert.equal(income.total_amount, 50000);
  assert.equal(ledger.total_amount, 50000);
  assert.equal(ledgerPayload.direction, "in");
  assert.equal(ledgerPayload.debit, 50000);
  assert.equal(ledgerPayload.credit, 0);
});

test("cash-out nominal tidak valid tidak meninggalkan partial ledger", async () => {
  await assert.rejects(
    commitCashOut({
      actor: "tester",
      payload: { id: "cash-out-invalid", amount: 0 },
    }),
    /Nominal kas wajib lebih dari 0/
  );

  const db = await testDatabase.getDb();
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM expenses) AS expense_count,
      (SELECT COUNT(*) FROM money_movement_ledger) AS ledger_count,
      (SELECT COUNT(*) FROM audit_logs) AS audit_count
  `);
  assert.deepEqual(counts, { expense_count: 0, ledger_count: 0, audit_count: 0 });
});

test("hapus cash-out menonaktifkan expense dan pasangan ledger dalam satu transaksi", async () => {
  await commitCashOut({
    actor: "tester",
    payload: {
      id: "cash-out-001",
      referenceNumber: "CSH-OUT-001",
      amount: 20000,
      description: "Biaya test",
    },
  });

  const db = await testDatabase.getDb();
  await db.run(
    `INSERT INTO money_movement_ledger
      (id, code, status, is_active, source_type, source_id, payload_json)
     VALUES (?, ?, 'active', 1, ?, ?, '{}')`,
    ["ledger-unrelated-same-source-id", "LGR-UNRELATED", "legacy_other_source", "cash-out-001"],
  );

  await deleteCashOut({ id: "cash-out-001", actor: "tester" });

  const expense = await db.get("SELECT status, is_active FROM expenses WHERE id = 'cash-out-001'");
  const ledger = await db.get(
    "SELECT status, is_active FROM money_movement_ledger WHERE id = 'ledger_cash-out-001'"
  );
  const unrelatedLedger = await db.get(
    "SELECT status, is_active FROM money_movement_ledger WHERE id = 'ledger-unrelated-same-source-id'"
  );

  assert.deepEqual(expense, { status: "deleted", is_active: 0 });
  assert.deepEqual(ledger, { status: "deleted", is_active: 0 });
  assert.deepEqual(unrelatedLedger, { status: "active", is_active: 1 });
});


test("duplicate referensi kas manual ditolak tanpa mengubah record dan ledger awal", async () => {
  await commitCashIn({
    actor: "tester",
    payload: {
      id: "cash-in-duplicate",
      referenceNumber: "CSH-IN-DUPLICATE",
      amount: 10000,
      description: "Transaksi awal",
    },
  });

  await assert.rejects(
    commitCashIn({
      actor: "tester",
      payload: {
        id: "cash-in-duplicate",
        referenceNumber: "CSH-IN-DUPLICATE",
        amount: 99999,
        description: "Tidak boleh overwrite",
      },
    }),
    (error) => error?.errorCode === "FINANCE_DUPLICATE_MANUAL_REFERENCE" && error?.statusCode === 409,
  );

  const db = await testDatabase.getDb();
  const income = await db.get("SELECT total_amount FROM incomes WHERE id = ?", ["cash-in-duplicate"]);
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM incomes WHERE id = 'cash-in-duplicate') AS income_count,
      (SELECT COUNT(*) FROM money_movement_ledger WHERE source_id = 'cash-in-duplicate') AS ledger_count,
      (SELECT COUNT(*) FROM audit_logs WHERE entity_id = 'cash-in-duplicate') AS audit_count
  `);
  assert.equal(income.total_amount, 10000);
  assert.deepEqual(counts, { income_count: 1, ledger_count: 1, audit_count: 1 });
});

test("posting finance system tetap idempotent untuk source deterministik", async () => {
  const payload = {
    id: "sale-income-001",
    referenceNumber: "SALE-INCOME-001",
    amount: 25000,
    sourceModule: "sale_income",
    sourceId: "sale-001",
  };
  await commitCashIn({ actor: "system", payload });
  await commitCashIn({ actor: "system", payload });

  const db = await testDatabase.getDb();
  const counts = await db.get(`
    SELECT
      (SELECT COUNT(*) FROM incomes WHERE id = 'sale-income-001') AS income_count,
      (SELECT COUNT(*) FROM money_movement_ledger WHERE source_id = 'sale-income-001') AS ledger_count
  `);
  assert.deepEqual(counts, { income_count: 1, ledger_count: 1 });
});
