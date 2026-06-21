const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const { getOpenApiDocumentController } = require("./openApi.controller");

const router = express.Router();
router.get("/", requireLocalAuth, requireLocalAdministrator, getOpenApiDocumentController);

module.exports = router;
