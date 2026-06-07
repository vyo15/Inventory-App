const express = require("express");
const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");
const { getDb } = require("../../db/connection");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const { success } = require("../../utils/response");
const { createFinanceMovement, markFinanceMovementDeleted } = require("../../utils/sqliteFinanceEngine");

const router = express.Router();

router.post("/cash-in/commit", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  const db = await getDb();
  try {
    await db.run("BEGIN IMMEDIATE TRANSACTION");
    const result = await createFinanceMovement(db, {
      direction: "in",
      payload: req.body || {},
      actor: req.localAuth.user.username,
      sourceModule: req.body?.sourceModule || "cash_in_manual",
      sourceId: req.body?.sourceId || req.body?.id || req.body?.referenceNumber,
      sourceRef: req.body?.sourceRef || req.body?.referenceNumber,
      description: req.body?.description || req.body?.type || "Pemasukan manual",
    });
    await db.run("COMMIT");
    return success(res, "Kas masuk database lokal berhasil disimpan dan ledger dibuat", result, undefined, 201);
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    return next(error);
  }
});

router.post("/cash-out/commit", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  const db = await getDb();
  try {
    await db.run("BEGIN IMMEDIATE TRANSACTION");
    const result = await createFinanceMovement(db, {
      direction: "out",
      payload: req.body || {},
      actor: req.localAuth.user.username,
      sourceModule: req.body?.sourceModule || "cash_out_manual",
      sourceId: req.body?.sourceId || req.body?.id || req.body?.referenceNumber,
      sourceRef: req.body?.sourceRef || req.body?.referenceNumber,
      description: req.body?.description || req.body?.type || "Pengeluaran manual",
    });
    await db.run("COMMIT");
    return success(res, "Kas keluar database lokal berhasil disimpan dan ledger dibuat", result, undefined, 201);
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    return next(error);
  }
});

router.delete("/cash-out/:id", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  const db = await getDb();
  try {
    await db.run("BEGIN IMMEDIATE TRANSACTION");
    const result = await markFinanceMovementDeleted(db, {
      tableName: "expenses",
      id: req.params.id,
      actor: req.localAuth.user.username,
    });
    await db.run("COMMIT");
    return success(res, "Kas keluar database lokal berhasil dihapus", result);
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    return next(error);
  }
});

router.use("/incomes", createSqliteJsonRecordRouter({
  tableName: "incomes",
  moduleKey: "finance",
  entityType: "income",
  codePrefix: "CSH-IN",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Finance database lokal final: income tersimpan bersama money_movement_ledger melalui endpoint commit untuk transaksi baru.",
  allowDirectCreate: false,
  allowDirectUpdate: false,
  allowDirectDelete: false,
  blockedWriteMessage: "Kas masuk wajib lewat POST /api/finance/cash-in/commit agar income dan ledger tetap atomic.",
}));

router.use("/expenses", createSqliteJsonRecordRouter({
  tableName: "expenses",
  moduleKey: "finance",
  entityType: "expense",
  codePrefix: "CSH-OUT",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Finance database lokal final: expense tersimpan bersama money_movement_ledger melalui endpoint commit untuk transaksi baru.",
  allowDirectCreate: false,
  allowDirectUpdate: false,
  allowDirectDelete: false,
  blockedWriteMessage: "Kas keluar wajib lewat POST /api/finance/cash-out/commit atau DELETE /api/finance/cash-out/:id agar expense dan ledger tetap atomic.",
}));

router.use("/ledger", createSqliteJsonRecordRouter({
  tableName: "money_movement_ledger",
  moduleKey: "finance",
  entityType: "ledger_entry",
  codePrefix: "LGR",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Ledger database lokal final untuk transaksi baru; data historis perlu migrasi/backfill terpisah.",
  allowDirectCreate: false,
  allowDirectUpdate: false,
  allowDirectDelete: false,
  blockedWriteMessage: "Ledger tidak boleh diubah langsung. Gunakan endpoint finance commit/delete resmi agar audit dan saldo tetap konsisten.",
}));

module.exports = router;
