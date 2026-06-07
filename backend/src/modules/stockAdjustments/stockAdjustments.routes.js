const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");

module.exports = createSqliteJsonRecordRouter({
  tableName: "stock_adjustments",
  moduleKey: "stock_adjustments",
  entityType: "stock_adjustment",
  codePrefix: "STK-ADJ",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Stock Adjustment list SQLite. Commit mutasi wajib lewat POST /api/stock/adjustments/commit.",
  allowDirectCreate: false,
  allowDirectUpdate: false,
  allowDirectDelete: false,
  blockedWriteMessage: "Stock Adjustment wajib lewat POST /api/stock/adjustments/commit agar mutasi stok, read model, inventory log, dan audit log tetap atomic.",
});
