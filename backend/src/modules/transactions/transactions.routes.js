const express = require("express");
const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");

const router = express.Router();

router.use("/purchases", createSqliteJsonRecordRouter({
  tableName: "purchases",
  moduleKey: "purchases",
  entityType: "purchase",
  codePrefix: "PUR",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Purchase SQLite C6 masih guarded foundation; stock-in, expense, ledger, dan purchase final atomic belum diaktifkan dari UI.",
}));

router.use("/sales", createSqliteJsonRecordRouter({
  tableName: "sales",
  moduleKey: "sales",
  entityType: "sale",
  codePrefix: "ORD",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Sales SQLite C6 masih guarded foundation; stock-out dan income final atomic belum diaktifkan dari UI.",
}));

router.use("/returns", createSqliteJsonRecordRouter({
  tableName: "returns",
  moduleKey: "returns",
  entityType: "return",
  codePrefix: "RET",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Returns SQLite C6 masih guarded foundation; stock restore/refund final atomic belum diaktifkan dari UI.",
}));

module.exports = router;
