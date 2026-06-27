const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const {
  createSupplierController,
  deleteSupplierController,
  generateSupplierCodeController,
  getSupplierController,
  listSupplierCatalogHistoryController,
  listSuppliersController,
  updateSupplierController,
  verifySupplierCatalogOfferController,
} = require("./suppliers.controller");

const router = express.Router();

router.get("/generate-code", requireLocalAuth, generateSupplierCodeController);
router.get("/", requireLocalAuth, listSuppliersController);
router.get("/:id/history", requireLocalAuth, listSupplierCatalogHistoryController);
router.post("/:id/catalog/:offerId/verify", requireLocalAuth, requireLocalAdministrator, verifySupplierCatalogOfferController);
router.get("/:id", requireLocalAuth, getSupplierController);
router.post("/", requireLocalAuth, requireLocalAdministrator, createSupplierController);
router.put("/:id", requireLocalAuth, requireLocalAdministrator, updateSupplierController);
router.delete("/:id", requireLocalAuth, requireLocalAdministrator, deleteSupplierController);

module.exports = router;
