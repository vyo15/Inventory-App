const { success } = require("../../utils/response");
const { requireLocalAdministrator } = require("../../middlewares/localAuth");
const { createSqliteJsonRecordRouter } = require("../../infrastructure/http/sqliteJsonRecordRouter");
const {
  commitCashIn,
  commitCashOut,
  deleteCashOut,
  getFinanceRecordRouterDefinitions,
} = require("./finance.service");

const getActor = (req) => req.localAuth?.user?.username || "system";


const attachFinanceRecordRouters = (router) => {
  getFinanceRecordRouterDefinitions().forEach(({ path, config }) => {
    router.use(path, createSqliteJsonRecordRouter({
      ...config,
      readGuard: requireLocalAdministrator,
    }));
  });
};

const commitCashInController = async (req, res, next) => {
  try {
    const result = await commitCashIn({
      payload: req.body || {},
      actor: getActor(req),
    });
    return success(res, "Kas masuk database lokal berhasil disimpan dan ledger dibuat", result, undefined, 201);
  } catch (error) {
    return next(error);
  }
};

const commitCashOutController = async (req, res, next) => {
  try {
    const result = await commitCashOut({
      payload: req.body || {},
      actor: getActor(req),
    });
    return success(res, "Kas keluar database lokal berhasil disimpan dan ledger dibuat", result, undefined, 201);
  } catch (error) {
    return next(error);
  }
};

const deleteCashOutController = async (req, res, next) => {
  try {
    const result = await deleteCashOut({
      id: req.params.id,
      actor: getActor(req),
    });
    return success(res, "Kas keluar database lokal berhasil dinonaktifkan", result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  commitCashInController,
  commitCashOutController,
  attachFinanceRecordRouters,
  deleteCashOutController,
};
