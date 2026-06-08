const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const {
  createCategoryController,
  deleteCategoryController,
  getCategoryController,
  listCategoriesController,
  updateCategoryController,
} = require("./categories.controller");

const router = express.Router();

router.get("/", requireLocalAuth, listCategoriesController);
router.get("/:id", requireLocalAuth, getCategoryController);
router.post("/", requireLocalAuth, requireLocalAdministrator, createCategoryController);
router.put("/:id", requireLocalAuth, requireLocalAdministrator, updateCategoryController);
router.delete("/:id", requireLocalAuth, requireLocalAdministrator, deleteCategoryController);

module.exports = router;
