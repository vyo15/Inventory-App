const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const { getMigrationStatusController } = require("./migrationStatus.controller");

const router = express.Router();

router.get("/", requireLocalAuth, requireLocalAdministrator, getMigrationStatusController);

module.exports = router;
