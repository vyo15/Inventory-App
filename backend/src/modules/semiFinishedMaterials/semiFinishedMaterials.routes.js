const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");

module.exports = createSqliteJsonRecordRouter({
  tableName: "semi_finished_materials",
  moduleKey: "semi_finished_materials",
  entityType: "semi_finished_material",
  codePrefix: "SFP",
  requiredName: true,
  orderBy: "name ASC, updated_at DESC",
});
