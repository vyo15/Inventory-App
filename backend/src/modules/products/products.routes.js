const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");

module.exports = createSqliteJsonRecordRouter({
  tableName: "products",
  moduleKey: "products",
  entityType: "product",
  codePrefix: "PRD",
  requiredName: true,
  orderBy: "name ASC, updated_at DESC",
});
