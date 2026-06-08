const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const {
  createSupplierController,
  deleteSupplierController,
  generateSupplierCodeController,
  getSupplierController,
  listSuppliersController,
  updateSupplierController,
} = require("./suppliers.controller");

const router = express.Router();

router.get("/generate-code", requireLocalAuth, generateSupplierCodeController);
router.get("/", requireLocalAuth, listSuppliersController);
router.get("/:id", requireLocalAuth, getSupplierController);
router.post("/", requireLocalAuth, requireLocalAdministrator, createSupplierController);
router.put("/:id", requireLocalAuth, requireLocalAdministrator, updateSupplierController);
router.delete("/:id", requireLocalAuth, requireLocalAdministrator, deleteSupplierController);

module.exports = router;
