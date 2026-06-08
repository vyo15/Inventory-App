const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");
const { getStockAdjustmentsRouterConfig } = require("./stockAdjustments.service");

const createStockAdjustmentsRouter = () => createSqliteJsonRecordRouter(getStockAdjustmentsRouterConfig());

module.exports = {
  createStockAdjustmentsRouter,
};
