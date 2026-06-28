const express = require("express");
const {
  requireLocalAuth,
  requireLocalAdministrator,
  requireLocalOperationalUser,
} = require("../../middlewares/localAuth");
const { createSqliteJsonRecordRouter } = require("../../infrastructure/http/sqliteJsonRecordRouter");
const { success } = require("../../utils/response");
const {
  cancelProductionPlan,
  completeProductionWorkLog,
  createOrderCommit,
  createOrderFromPlan,
  finalizeProductionPayroll,
  generatePayrollLines,
  getProductionRouterDefinitions,
  markProductionPayrollPaid,
  refreshOrderRequirements,
  startProductionOrder,
} = require("./production.service");

const getActor = (req) => req.localAuth?.user?.username || "system";

const withProductionGuards = ({
  config,
  requiresAdministratorRead,
  requiresOperationalWriteUser,
}) => ({
  ...config,
  ...(requiresAdministratorRead ? { readGuard: requireLocalAdministrator } : {}),
  ...(requiresOperationalWriteUser ? { writeGuard: requireLocalOperationalUser } : {}),
});

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    return await handler(req, res);
  } catch (error) {
    return next(error);
  }
};

const createProductionRouter = () => {
  const router = express.Router();

  router.post("/orders/commit", requireLocalAuth, requireLocalOperationalUser, asyncHandler(async (req, res) => {
    const order = await createOrderCommit({ payload: req.body || {}, actor: getActor(req) });
    return success(res, "Production Order berhasil dibuat secara atomic", order, undefined, 201);
  }));

  router.post("/planning/:id/create-order", requireLocalAuth, requireLocalOperationalUser, asyncHandler(async (req, res) => {
    const result = await createOrderFromPlan({
      planId: req.params.id,
      payload: req.body || {},
      actor: getActor(req),
    });
    return success(res, "Planning dan Production Order berhasil diproses secara atomic", result, undefined, 201);
  }));

  router.post("/planning/:id/cancel", requireLocalAuth, requireLocalOperationalUser, asyncHandler(async (req, res) => {
    const plan = await cancelProductionPlan({ planId: req.params.id, actor: getActor(req) });
    return success(res, "Planning produksi berhasil dibatalkan", plan);
  }));

  router.post("/orders/:id/refresh-requirements", requireLocalAuth, requireLocalOperationalUser, asyncHandler(async (req, res) => {
    const order = await refreshOrderRequirements({ orderId: req.params.id, actor: getActor(req) });
    return success(res, "Requirement Production Order berhasil dihitung ulang", order);
  }));

  router.post("/orders/:id/start", requireLocalAuth, requireLocalOperationalUser, asyncHandler(async (req, res) => {
    const result = await startProductionOrder({
      orderId: req.params.id,
      payload: req.body || {},
      actor: getActor(req),
    });
    return success(res, "Produksi dimulai, material dipotong, dan Work Log dibuat secara atomic", result, undefined, 201);
  }));

  router.post("/work-logs/:id/complete", requireLocalAuth, requireLocalOperationalUser, asyncHandler(async (req, res) => {
    const result = await completeProductionWorkLog({
      workLogId: req.params.id,
      payload: req.body || {},
      actor: getActor(req),
    });
    return success(res, "Work Log, output stok, payroll, HPP, dan status PO berhasil diselesaikan secara atomic", result);
  }));

  router.post("/work-logs/:id/generate-payrolls", requireLocalAuth, requireLocalOperationalUser, asyncHandler(async (req, res) => {
    const result = await generatePayrollLines({ workLogId: req.params.id, actor: getActor(req) });
    return success(res, "Payroll Work Log berhasil diproses tanpa duplikasi", result);
  }));

  router.post("/payrolls/:id/finalize", requireLocalAuth, requireLocalAdministrator, asyncHandler(async (req, res) => {
    const result = await finalizeProductionPayroll({
      payrollId: req.params.id,
      payload: req.body || {},
      actor: getActor(req),
    });
    return success(res, "Payroll berhasil dikonfirmasi dan HPP direconcile", result);
  }));

  router.post("/payrolls/:id/mark-paid", requireLocalAuth, requireLocalAdministrator, asyncHandler(async (req, res) => {
    const result = await markProductionPayrollPaid({
      payrollId: req.params.id,
      payload: req.body || {},
      actor: getActor(req),
    });
    return success(res, "Payroll paid, finance, dan HPP berhasil diproses secara atomic", result);
  }));

  getProductionRouterDefinitions().forEach((definition) => {
    router.use(
      definition.path,
      createSqliteJsonRecordRouter(withProductionGuards(definition)),
    );
  });

  return router;
};

module.exports = {
  createProductionRouter,
};
