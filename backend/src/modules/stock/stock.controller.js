const { failure, success } = require("../../utils/response");
const { getRequestActor } = require("../../utils/requestActor");
const { commitStockAdjustment } = require("./stock.service");


const commitStockAdjustmentController = async (req, res, next) => {
  try {
    const result = await commitStockAdjustment({
      payload: req.body || {},
      actor: getRequestActor(req),
    });
    return success(res, "Penyesuaian stok berhasil disimpan", result, undefined, 201);
  } catch (error) {
    return next(error);
  }
};

const notFoundController = (_req, res) => failure(res, "Endpoint stok tidak ditemukan", "NOT_FOUND", 404);

module.exports = {
  commitStockAdjustmentController,
  notFoundController,
};
