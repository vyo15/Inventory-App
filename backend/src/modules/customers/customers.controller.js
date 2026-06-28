const { respondIfServiceError } = require("../../utils/httpError");
const { failure, success } = require("../../utils/response");
const {
  createCustomer,
  generateCustomerCode,
  getCustomerById,
  listCustomers,
  softDeleteCustomer,
  updateCustomer,
} = require("./customers.service");

const getActor = (req) => req.localAuth?.user?.username || "system";

const handleCustomerError = (res, error) => respondIfServiceError(res, error, {
  duplicateMessage: "Kode customer sudah ada di database lokal",
  duplicateCode: "DUPLICATE_CODE",
});

const generateCustomerCodeController = async (req, res, next) => {
  try {
    const code = await generateCustomerCode();
    return success(res, "Kode customer database lokal berhasil dibuat", { code, customerCode: code });
  } catch (error) {
    return next(error);
  }
};

const listCustomersController = async (req, res, next) => {
  try {
    const customers = await listCustomers();
    return success(res, "Data customer database lokal berhasil dimuat", customers);
  } catch (error) {
    return next(error);
  }
};

const getCustomerController = async (req, res, next) => {
  try {
    const customer = await getCustomerById(req.params.id);

    if (!customer) {
      return failure(res, "Customer database lokal tidak ditemukan", "NOT_FOUND", 404);
    }

    return success(res, "Detail customer database lokal berhasil dimuat", customer);
  } catch (error) {
    return next(error);
  }
};

const createCustomerController = async (req, res, next) => {
  try {
    const customer = await createCustomer(req.body, getActor(req));
    return success(res, "Customer berhasil ditambahkan ke database lokal", customer, undefined, 201);
  } catch (error) {
    const handled = handleCustomerError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const updateCustomerController = async (req, res, next) => {
  try {
    const customer = await updateCustomer(req.params.id, req.body, getActor(req));
    return success(res, "Customer database lokal berhasil diubah", customer);
  } catch (error) {
    const handled = handleCustomerError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const deleteCustomerController = async (req, res, next) => {
  try {
    const result = await softDeleteCustomer(req.params.id, getActor(req));
    return success(res, "Customer database lokal berhasil dinonaktifkan", result);
  } catch (error) {
    const handled = handleCustomerError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

module.exports = {
  createCustomerController,
  deleteCustomerController,
  generateCustomerCodeController,
  getCustomerController,
  listCustomersController,
  updateCustomerController,
};
