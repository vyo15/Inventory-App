const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const { listAuditLogsController } = require("./auditLogs.controller");

const router = express.Router();

router.get("/", requireLocalAuth, requireLocalAdministrator, listAuditLogsController);

module.exports = router;
