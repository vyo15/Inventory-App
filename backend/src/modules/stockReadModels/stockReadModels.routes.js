const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");

module.exports = createSqliteJsonRecordRouter({
  tableName: "stock_read_models",
  moduleKey: "stock_read_models",
  entityType: "stock_read_model",
  codePrefix: "STK",
  requiredName: false,
  orderBy: "source_type ASC, name ASC, updated_at DESC",
  protectedWriteNote: "Data stok lokal adalah snapshot/foundation. Mutasi stok final tetap wajib melalui transaction engine yang audited.",
});
