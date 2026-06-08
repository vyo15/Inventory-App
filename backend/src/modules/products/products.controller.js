const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");
const { getProductsRouterConfig } = require("./products.service");

const createProductsRouter = () => createSqliteJsonRecordRouter(getProductsRouterConfig());

module.exports = {
  createProductsRouter,
};
