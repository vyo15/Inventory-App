const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");

module.exports = createSqliteJsonRecordRouter({
  tableName: "raw_materials",
  moduleKey: "raw_materials",
  entityType: "raw_material",
  codePrefix: "RAW",
  requiredName: true,
  orderBy: "name ASC, updated_at DESC",
});
