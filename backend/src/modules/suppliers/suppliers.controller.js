const { respondIfServiceError } = require("../../utils/httpError");
const { getRequestActor } = require("../../utils/requestActor");
const { failure, success } = require("../../utils/response");
const {
  createSupplier,
  generateSupplierCode,
  getSupplierById,
  listSupplierCatalogHistory,
  listSuppliers,
  softDeleteSupplier,
  updateSupplier,
  verifySupplierCatalogOffer,
} = require("./suppliers.service");


const handleSupplierError = (res, error) => respondIfServiceError(res, error, {
  duplicateMessage: "Kode supplier sudah ada di database lokal",
  duplicateCode: "DUPLICATE_CODE",
});

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


const listSupplierCatalogHistoryController = async (req, res, next) => {
  try {
    const history = await listSupplierCatalogHistory(req.params.id, {
      limit: req.query.limit,
      offset: req.query.offset,
      eventType: req.query.eventType,
    });
    return success(res, "Histori toko berhasil dimuat", history);
  } catch (error) {
    const handled = handleSupplierError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const verifySupplierCatalogOfferController = async (req, res, next) => {
  try {
    const result = await verifySupplierCatalogOffer({
      supplierId: req.params.id,
      offerId: req.params.offerId,
      actualPrice: req.body?.actualPrice,
      resultStatus: req.body?.resultStatus,
      note: req.body?.note,
      actor: getRequestActor(req),
    });
    return success(res, "Pengecekan harga katalog Supplier berhasil disimpan", result);
  } catch (error) {
    const handled = handleSupplierError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const createSupplierController = async (req, res, next) => {
  try {
    const supplier = await createSupplier(req.body, getRequestActor(req));
    return success(res, "Supplier berhasil ditambahkan ke database lokal", supplier, undefined, 201);
  } catch (error) {
    const handled = handleSupplierError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const updateSupplierController = async (req, res, next) => {
  try {
    const supplier = await updateSupplier(req.params.id, req.body, getRequestActor(req));
    return success(res, "Supplier database lokal berhasil diubah", supplier);
  } catch (error) {
    const handled = handleSupplierError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const deleteSupplierController = async (req, res, next) => {
  try {
    const result = await softDeleteSupplier(req.params.id, getRequestActor(req));
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
  listSupplierCatalogHistoryController,
  listSuppliersController,
  updateSupplierController,
  verifySupplierCatalogOfferController,
};
