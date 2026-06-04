const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");

module.exports = createSqliteJsonRecordRouter({
  tableName: "stock_adjustments",
  moduleKey: "stock_adjustments",
  entityType: "stock_adjustment",
  codePrefix: "STK-ADJ",
  requiredName: false,
  orderBy: "transaction_date DESC, updated_at DESC",
  protectedWriteNote: "Stock Adjustment list SQLite. Commit mutasi wajib lewat POST /api/stock/adjustments/commit.",
});
