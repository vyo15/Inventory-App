const express = require("express");
const { requireLocalAuth, requireLocalOperationalUser } = require("../../middlewares/localAuth");
const { commitStockAdjustmentController, notFoundController } = require("./stock.controller");

const router = express.Router();

router.post("/adjustments/commit", requireLocalAuth, requireLocalOperationalUser, commitStockAdjustmentController);
router.use(notFoundController);

module.exports = router;
