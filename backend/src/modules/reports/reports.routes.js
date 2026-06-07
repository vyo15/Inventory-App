const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");

module.exports = createSqliteJsonRecordRouter({
  tableName: "report_snapshots",
  moduleKey: "reports",
  entityType: "report_snapshot",
  codePrefix: "RPT",
  requiredName: false,
  orderBy: "source_type ASC, updated_at DESC",
  protectedWriteNote: "Report database lokal C7 adalah snapshot read/storage foundation; laporan final belum boleh menghitung draft lokal yang belum committed.",
});
