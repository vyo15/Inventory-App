const { createSqliteJsonRecordRouter } = require("../../infrastructure/http/sqliteJsonRecordRouter");
const { getRawMaterialsRouterConfig } = require("./rawMaterials.service");

const createRawMaterialsRouter = () => createSqliteJsonRecordRouter(getRawMaterialsRouterConfig());

module.exports = {
  createRawMaterialsRouter,
};
