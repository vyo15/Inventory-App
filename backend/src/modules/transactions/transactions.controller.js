const { respondIfServiceError } = require("../../utils/httpError");
const { success } = require("../../utils/response");
const { createSqliteJsonRecordRouter } = require("../../infrastructure/http/sqliteJsonRecordRouter");
const {
  commitPurchase,
  commitReturn,
  commitSale,
  getTransactionRecordRouterDefinitions,
  updateSaleStatus,
} = require("./transactions.service");

const getActor = (req) => req.localAuth?.user?.username || "system";


const attachTransactionRecordRouters = (router) => {
  getTransactionRecordRouterDefinitions().forEach(({ path, config }) => {
    router.use(path, createSqliteJsonRecordRouter(config));
  });
};

const handleTransactionError = (res, error) => respondIfServiceError(res, error);

const commitPurchaseController = async (req, res, next) => {
  try {
    const result = await commitPurchase({
      payload: req.body || {},
      actor: getActor(req),
    });
    return success(res, "Purchase database lokal berhasil disimpan dan stok masuk.", result, undefined, 201);
  } catch (error) {
    const handled = handleTransactionError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const commitSaleController = async (req, res, next) => {
  try {
    const result = await commitSale({
      payload: req.body || {},
      actor: getActor(req),
    });
    return success(res, "Sales database lokal berhasil disimpan dan stok keluar.", result, undefined, 201);
  } catch (error) {
    const handled = handleTransactionError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const updateSaleStatusController = async (req, res, next) => {
  try {
    const result = await updateSaleStatus({
      id: req.params.id,
      status: req.body?.status,
      actor: getActor(req),
    });
    return success(res, "Status sales database lokal berhasil diubah", result);
  } catch (error) {
    const handled = handleTransactionError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

const commitReturnController = async (req, res, next) => {
  try {
    const result = await commitReturn({
      payload: req.body || {},
      actor: getActor(req),
    });
    return success(
      res,
      "Retur berhasil disimpan dari transaksi Sales dan stok dipulihkan.",
      result,
      undefined,
      201,
    );
  } catch (error) {
    const handled = handleTransactionError(res, error);
    if (handled) return handled;
    return next(error);
  }
};

module.exports = {
  commitPurchaseController,
  commitReturnController,
  attachTransactionRecordRouters,
  commitSaleController,
  updateSaleStatusController,
};
