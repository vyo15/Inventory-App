const { createSqliteJsonRecordRouter } = require("../../infrastructure/http/sqliteJsonRecordRouter");
const { getStockAdjustmentsRouterConfig } = require("./stockAdjustments.service");

const createStockAdjustmentsRouter = () => createSqliteJsonRecordRouter(getStockAdjustmentsRouterConfig());

module.exports = {
  createStockAdjustmentsRouter,
};
