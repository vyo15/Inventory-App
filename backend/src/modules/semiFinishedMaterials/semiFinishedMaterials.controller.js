const { createSqliteJsonRecordRouter } = require("../../infrastructure/http/sqliteJsonRecordRouter");
const { getSemiFinishedMaterialsRouterConfig } = require("./semiFinishedMaterials.service");

const createSemiFinishedMaterialsRouter = () => createSqliteJsonRecordRouter(getSemiFinishedMaterialsRouterConfig());

module.exports = {
  createSemiFinishedMaterialsRouter,
};
