const { getDb } = require("../../db/connection");
const { createFinanceMovement, markFinanceMovementDeleted } = require("../../utils/sqliteFinanceEngine");

const runFinanceTransaction = async (callback) => {
  const db = await getDb();
  try {
    await db.run("BEGIN IMMEDIATE TRANSACTION");
    const result = await callback(db);
    await db.run("COMMIT");
    return result;
  } catch (error) {
    await db.run("ROLLBACK").catch(() => {});
    throw error;
  }
};

const commitCashIn = async ({ payload = {}, actor = "system" } = {}) => runFinanceTransaction((db) => createFinanceMovement(db, {
  direction: "in",
  payload,
  actor,
  sourceModule: payload?.sourceModule || "cash_in_manual",
  sourceId: payload?.sourceId || payload?.id || payload?.referenceNumber,
  sourceRef: payload?.sourceRef || payload?.referenceNumber,
  description: payload?.description || payload?.type || "Pemasukan manual",
}));

const commitCashOut = async ({ payload = {}, actor = "system" } = {}) => runFinanceTransaction((db) => createFinanceMovement(db, {
  direction: "out",
  payload,
  actor,
  sourceModule: payload?.sourceModule || "cash_out_manual",
  sourceId: payload?.sourceId || payload?.id || payload?.referenceNumber,
  sourceRef: payload?.sourceRef || payload?.referenceNumber,
  description: payload?.description || payload?.type || "Pengeluaran manual",
}));

const deleteCashOut = async ({ id, actor = "system" } = {}) => runFinanceTransaction((db) => markFinanceMovementDeleted(db, {
  tableName: "expenses",
  id,
  actor,
}));


const getFinanceRecordRouterDefinitions = () => [
  {
    path: "/incomes",
    config: {
      tableName: "incomes",
      moduleKey: "finance",
      entityType: "income",
      codePrefix: "CSH-IN",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: [
        "Finance database lokal final: income tersimpan bersama money_movement_ledger",
        "melalui endpoint commit untuk transaksi baru.",
      ].join(" "),
      allowDirectCreate: false,
      allowDirectUpdate: false,
      allowDirectDelete: false,
      blockedWriteMessage: [
        "Kas masuk wajib lewat POST /api/finance/cash-in/commit",
        "agar income dan ledger tetap atomic.",
      ].join(" "),
    },
  },
  {
    path: "/expenses",
    config: {
      tableName: "expenses",
      moduleKey: "finance",
      entityType: "expense",
      codePrefix: "CSH-OUT",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: [
        "Finance database lokal final: expense tersimpan bersama money_movement_ledger",
        "melalui endpoint commit untuk transaksi baru.",
      ].join(" "),
      allowDirectCreate: false,
      allowDirectUpdate: false,
      allowDirectDelete: false,
      blockedWriteMessage: [
        "Kas keluar wajib lewat POST /api/finance/cash-out/commit atau DELETE /api/finance/cash-out/:id",
        "agar expense dan ledger tetap atomic.",
      ].join(" "),
    },
  },
  {
    path: "/ledger",
    config: {
      tableName: "money_movement_ledger",
      moduleKey: "finance",
      entityType: "ledger_entry",
      codePrefix: "LGR",
      requiredName: false,
      orderBy: "transaction_date DESC, updated_at DESC",
      protectedWriteNote: [
        "Ledger database lokal final untuk transaksi baru;",
        "data historis perlu migrasi/backfill terpisah.",
      ].join(" "),
      allowDirectCreate: false,
      allowDirectUpdate: false,
      allowDirectDelete: false,
      blockedWriteMessage: [
        "Ledger tidak boleh diubah langsung.",
        "Gunakan endpoint finance commit/delete resmi agar audit dan saldo tetap konsisten.",
      ].join(" "),
    },
  },
];

module.exports = {
  commitCashIn,
  commitCashOut,
  deleteCashOut,
  getFinanceRecordRouterDefinitions,
};
