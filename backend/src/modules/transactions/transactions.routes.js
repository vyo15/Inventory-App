const express = require("express");
const { requireLocalAuth, requireLocalOperationalUser } = require("../../middlewares/localAuth");
const {
  attachTransactionRecordRouters,
  commitPurchaseController,
  commitReturnController,
  commitSaleController,
  updateSaleStatusController,
} = require("./transactions.controller");

const router = express.Router();

router.post("/purchases/commit", requireLocalAuth, requireLocalOperationalUser, commitPurchaseController);
router.post("/sales/commit", requireLocalAuth, requireLocalOperationalUser, commitSaleController);
router.put("/sales/:id/status", requireLocalAuth, requireLocalOperationalUser, updateSaleStatusController);
router.post("/returns/commit", requireLocalAuth, requireLocalOperationalUser, commitReturnController);

attachTransactionRecordRouters(router);

module.exports = router;
