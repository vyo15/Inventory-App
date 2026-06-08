const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const {
  attachFinanceRecordRouters,
  commitCashInController,
  commitCashOutController,
  deleteCashOutController,
} = require("./finance.controller");

const router = express.Router();

router.post("/cash-in/commit", requireLocalAuth, requireLocalAdministrator, commitCashInController);
router.post("/cash-out/commit", requireLocalAuth, requireLocalAdministrator, commitCashOutController);
router.delete("/cash-out/:id", requireLocalAuth, requireLocalAdministrator, deleteCashOutController);

attachFinanceRecordRouters(router);

module.exports = router;
