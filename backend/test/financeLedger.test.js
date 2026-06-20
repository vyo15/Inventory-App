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

  await deleteCashOut({ id: "cash-out-001", actor: "tester" });

  const db = await testDatabase.getDb();
  const expense = await db.get("SELECT status, is_active FROM expenses WHERE id = 'cash-out-001'");
  const ledger = await db.get(
    "SELECT status, is_active FROM money_movement_ledger WHERE source_id = 'cash-out-001'"
  );

  assert.deepEqual(expense, { status: "deleted", is_active: 0 });
  assert.deepEqual(ledger, { status: "deleted", is_active: 0 });
});
