const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");
const { getReportsRouterConfig } = require("./reports.service");

const createReportsRouter = () => createSqliteJsonRecordRouter(getReportsRouterConfig());

module.exports = {
  createReportsRouter,
};
