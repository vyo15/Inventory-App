const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");
const { getStockReadModelsRouterConfig } = require("./stockReadModels.service");

const createStockReadModelsRouter = () => createSqliteJsonRecordRouter(getStockReadModelsRouterConfig());

module.exports = {
  createStockReadModelsRouter,
};
