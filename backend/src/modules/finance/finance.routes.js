const express = require("express");
const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");

const router = express.Router();

router.use("/incomes", createSqliteJsonRecordRouter({
  tableName: "incomes",
  moduleKey: "finance",
  entityType: "income",
  codePrefix: "CSH-IN",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Finance SQLite C7 masih storage foundation; ledger/profit-loss final belum dihitung ulang dari data lokal.",
}));

router.use("/expenses", createSqliteJsonRecordRouter({
  tableName: "expenses",
  moduleKey: "finance",
  entityType: "expense",
  codePrefix: "CSH-OT",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Finance SQLite C7 masih storage foundation; ledger/profit-loss final belum dihitung ulang dari data lokal.",
}));

router.use("/ledger", createSqliteJsonRecordRouter({
  tableName: "money_movement_ledger",
  moduleKey: "finance",
  entityType: "ledger_entry",
  codePrefix: "LGR",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Ledger SQLite C7 masih append/storage foundation; rekonsiliasi final wajib audit khusus.",
}));

module.exports = router;
