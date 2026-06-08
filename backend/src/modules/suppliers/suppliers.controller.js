const { failure, success } = require("../../utils/response");
const {
  createSupplier,
  generateSupplierCode,
  getSupplierById,
  listSuppliers,
  softDeleteSupplier,
  updateSupplier,
} = require("./suppliers.service");

const getActor = (req) => req.localAuth?.user?.username || "system";

const handleSupplierError = (res, error) => {
  if (error?.code === "DUPLICATE_CODE" || String(error?.message || "").includes("UNIQUE")) {
    return failure(res, "Kode supplier sudah ada di database lokal", "DUPLICATE_CODE", 409);
  }

  if (error?.isServiceError) {
    return failure(res, error.message, error.code, error.statusCode || 400);
  }

  return null;
};

const generateSupplierCodeController = async (req, res, next) => {
  try {
    const code = await generateSupplierCode();
    return success(res, "Kode supplier database lokal berhasil dibuat", { code, supplierCode: code });
  } catch (error) {
    return next(error);
  }
};

const listSuppliersController = async (req, res, next) => {
  try {
    const suppliers = await listSuppliers();
    return success(res, "Data supplier database lokal berhasil dimuat", suppliers);
  } catch (error) {
    return next(error);
  }
};

const getSupplierController = async (req, res, next) => {
  try {
    const supplier = await getSupplierById(req.params.id);

    if (!supplier) {
      return failure(res, "Supplier database lokal tidak ditemukan", "NOT_FOUND", 404);
    }

    return success(res, "Detail supplier database lokal berhasil dimuat", supplier);
  } catch (error) {
    return next(error);
  }
};

const createSupplierController = async (req, res, next) => {
  try {
    const supplier = await createSupplier(req.body, getActor(req));
    return success(res, "Supplier berhasil ditambahkan ke database lokal", supplier, undefined, 201);
  } catch (error) {
    const handled = handleSupplierError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const updateSupplierController = async (req, res, next) => {
  try {
    const supplier = await updateSupplier(req.params.id, req.body, getActor(req));
    return success(res, "Supplier database lokal berhasil diubah", supplier);
  } catch (error) {
    const handled = handleSupplierError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const deleteSupplierController = async (req, res, next) => {
  try {
    const result = await softDeleteSupplier(req.params.id, getActor(req));
    return success(res, "Supplier database lokal berhasil dinonaktifkan", result);
  } catch (error) {
    const handled = handleSupplierError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

module.exports = {
  createSupplierController,
  deleteSupplierController,
  generateSupplierCodeController,
  getSupplierController,
  listSuppliersController,
  updateSupplierController,
};
