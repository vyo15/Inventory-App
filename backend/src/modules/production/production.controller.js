const express = require("express");
const { requireLocalOperationalUser } = require("../../middlewares/localAuth");
const { createSqliteJsonRecordRouter } = require("../../shared/sqliteJsonRecordRoutes");
const { getProductionRouterDefinitions } = require("./production.service");

const withProductionGuards = ({ config, requiresOperationalWriteUser }) => ({
  ...config,
  ...(requiresOperationalWriteUser ? { writeGuard: requireLocalOperationalUser } : {}),
});

const createProductionRouter = () => {
  const router = express.Router();

  getProductionRouterDefinitions().forEach((definition) => {
    router.use(
      definition.path,
      createSqliteJsonRecordRouter(withProductionGuards(definition)),
    );
  });

  return router;
};

module.exports = {
  createProductionRouter,
};
