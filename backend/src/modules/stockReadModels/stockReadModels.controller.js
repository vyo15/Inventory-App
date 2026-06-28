const { createSqliteJsonRecordRouter } = require("../../infrastructure/http/sqliteJsonRecordRouter");
const { getStockReadModelsRouterConfig } = require("./stockReadModels.service");

const createStockReadModelsRouter = () => createSqliteJsonRecordRouter(getStockReadModelsRouterConfig());

module.exports = {
  createStockReadModelsRouter,
};
