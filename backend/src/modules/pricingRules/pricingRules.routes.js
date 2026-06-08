const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const {
  createPricingRuleController,
  deletePricingRuleController,
  generatePricingRuleCodeController,
  getPricingRuleController,
  listPricingRulesController,
  updatePricingRuleController,
} = require("./pricingRules.controller");

const router = express.Router();

router.get("/generate-code", requireLocalAuth, generatePricingRuleCodeController);
router.get("/", requireLocalAuth, listPricingRulesController);
router.get("/:id", requireLocalAuth, getPricingRuleController);
router.post("/", requireLocalAuth, requireLocalAdministrator, createPricingRuleController);
router.put("/:id", requireLocalAuth, requireLocalAdministrator, updatePricingRuleController);
router.delete("/:id", requireLocalAuth, requireLocalAdministrator, deletePricingRuleController);

module.exports = router;
