const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");
const { getRawMaterialsRouterConfig } = require("./rawMaterials.service");

const createRawMaterialsRouter = () => createSqliteJsonRecordRouter(getRawMaterialsRouterConfig());

module.exports = {
  createRawMaterialsRouter,
};
