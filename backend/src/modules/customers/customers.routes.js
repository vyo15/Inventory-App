const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const {
  createCustomerController,
  deleteCustomerController,
  generateCustomerCodeController,
  getCustomerController,
  listCustomersController,
  updateCustomerController,
} = require("./customers.controller");

const router = express.Router();

router.get("/generate-code", requireLocalAuth, generateCustomerCodeController);
router.get("/", requireLocalAuth, listCustomersController);
router.get("/:id", requireLocalAuth, getCustomerController);
router.post("/", requireLocalAuth, requireLocalAdministrator, createCustomerController);
router.put("/:id", requireLocalAuth, requireLocalAdministrator, updateCustomerController);
router.delete("/:id", requireLocalAuth, requireLocalAdministrator, deleteCustomerController);

module.exports = router;
