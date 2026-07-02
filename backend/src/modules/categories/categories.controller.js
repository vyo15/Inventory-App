const { respondIfServiceError } = require("../../utils/httpError");
const { getRequestActor } = require("../../utils/requestActor");
const { failure, success } = require("../../utils/response");
const {
  createCategory,
  getCategoryById,
  listCategories,
  softDeleteCategory,
  updateCategory,
} = require("./categories.service");


const handleCategoryError = (res, error) => respondIfServiceError(res, error, {
  duplicateMessage: "Kode kategori sudah ada di database lokal",
  duplicateCode: "DUPLICATE_CODE",
});

const listCategoriesController = async (req, res, next) => {
  try {
    const categories = await listCategories({
      type: req.query.type,
      status: req.query.status,
    });
    return success(res, "Data kategori database lokal berhasil dimuat", categories);
  } catch (error) {
    const handled = handleCategoryError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const getCategoryController = async (req, res, next) => {
  try {
    const category = await getCategoryById(req.params.id);

    if (!category) {
      return failure(res, "Kategori database lokal tidak ditemukan", "NOT_FOUND", 404);
    }

    return success(res, "Detail kategori database lokal berhasil dimuat", category);
  } catch (error) {
    return next(error);
  }
};

const createCategoryController = async (req, res, next) => {
  try {
    const category = await createCategory(req.body, getRequestActor(req));
    return success(res, "Kategori berhasil ditambahkan ke database lokal", category, undefined, 201);
  } catch (error) {
    const handled = handleCategoryError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const updateCategoryController = async (req, res, next) => {
  try {
    const category = await updateCategory(req.params.id, req.body, getRequestActor(req));
    return success(res, "Kategori database lokal berhasil diubah", category);
  } catch (error) {
    const handled = handleCategoryError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const deleteCategoryController = async (req, res, next) => {
  try {
    const result = await softDeleteCategory(req.params.id, getRequestActor(req));
    return success(res, "Kategori database lokal berhasil dinonaktifkan", result);
  } catch (error) {
    const handled = handleCategoryError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

module.exports = {
  createCategoryController,
  deleteCategoryController,
  getCategoryController,
  listCategoriesController,
  updateCategoryController,
};
