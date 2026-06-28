const { createSqliteJsonRecordRouter } = require("../../infrastructure/http/sqliteJsonRecordRouter");
const { getProductsRouterConfig } = require("./products.service");

const createProductsRouter = () => createSqliteJsonRecordRouter(getProductsRouterConfig());

module.exports = {
  createProductsRouter,
};
