const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const { getAppSettingsController } = require("./settings.controller");

const router = express.Router();

router.get("/", requireLocalAuth, requireLocalAdministrator, getAppSettingsController);

module.exports = router;
