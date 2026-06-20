const { requireLocalAdministrator } = require("../../middlewares/localAuth");
const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");
const { getReportsRouterConfig } = require("./reports.service");

const createReportsRouter = () => createSqliteJsonRecordRouter({
  ...getReportsRouterConfig(),
  readGuard: requireLocalAdministrator,
});

module.exports = {
  createReportsRouter,
};
