const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");
const { getSemiFinishedMaterialsRouterConfig } = require("./semiFinishedMaterials.service");

const createSemiFinishedMaterialsRouter = () => createSqliteJsonRecordRouter(getSemiFinishedMaterialsRouterConfig());

module.exports = {
  createSemiFinishedMaterialsRouter,
};
