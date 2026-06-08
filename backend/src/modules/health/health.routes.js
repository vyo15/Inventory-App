const express = require("express");
const { getHealthStatusController } = require("./health.controller");

const router = express.Router();

router.get("/", getHealthStatusController);

module.exports = router;
