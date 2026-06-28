const { success } = require("../../utils/response");
const testingLabService = require("./testingLab.service");

const getActor = (req) => req.localAuth?.user?.username || "system";
const getRole = (req) => req.localAuth?.user?.role || "";


const getTestingLabRuntimeStatusController = async (_req, res, next) => {
  try {
    const result = testingLabService.getTestingLabRuntimeStatus();
    return success(res, "Mode runtime database berhasil dimuat", result);
  } catch (error) {
    return next(error);
  }
};

const getTestingLabStatusController = async (req, res, next) => {
  try {
    const result = await testingLabService.getTestingLabStatus({ role: getRole(req) });
    return success(res, "Status Lab Pengujian berhasil dimuat", result);
  } catch (error) {
    return next(error);
  }
};

const createTestingBaselineController = async (req, res, next) => {
  try {
    const result = await testingLabService.createTestingBaseline({
      confirmKeyword: req.body?.confirmKeyword,
      actor: getActor(req),
    });
    return success(res, "Baseline testing berhasil dibuat dan diverifikasi", result);
  } catch (error) {
    return next(error);
  }
};

const setActiveTestingBaselineController = async (req, res, next) => {
  try {
    const result = await testingLabService.setActiveTestingBaseline({
      filename: req.body?.filename,
      actor: getActor(req),
    });
    return success(res, "Baseline testing aktif berhasil dipilih", result);
  } catch (error) {
    return next(error);
  }
};

const resetSandboxToBaselineController = async (req, res, next) => {
  try {
    const result = await testingLabService.resetSandboxToBaseline({
      confirmKeyword: req.body?.confirmKeyword,
      actor: getActor(req),
    });
    return success(res, "Sandbox berhasil dikembalikan ke baseline", result);
  } catch (error) {
    return next(error);
  }
};

const startTestingSessionController = async (req, res, next) => {
  try {
    const result = await testingLabService.startTestingSession({
      scenarioKey: req.body?.scenarioKey,
      actor: getActor(req),
    });
    return success(res, "Sesi pengujian berhasil dimulai", result);
  } catch (error) {
    return next(error);
  }
};

const completeTestingSessionController = async (req, res, next) => {
  try {
    const result = await testingLabService.completeTestingSession({
      actor: getActor(req),
      notes: req.body?.notes,
    });
    return success(res, "Sesi pengujian berhasil diselesaikan", result);
  } catch (error) {
    return next(error);
  }
};

const cancelTestingSessionController = async (req, res, next) => {
  try {
    const result = await testingLabService.cancelTestingSession({ actor: getActor(req) });
    return success(res, "Sesi pengujian dibatalkan", result);
  } catch (error) {
    return next(error);
  }
};

const runTestingValidationController = async (_req, res, next) => {
  try {
    const result = await testingLabService.runTestingValidation();
    return success(res, "Validasi sandbox selesai", result);
  } catch (error) {
    return next(error);
  }
};

const exportLastTestingResultController = async (_req, res, next) => {
  try {
    const result = await testingLabService.exportLastTestingResult();
    return success(res, "Hasil pengujian siap diekspor", result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  cancelTestingSessionController,
  completeTestingSessionController,
  createTestingBaselineController,
  exportLastTestingResultController,
  getTestingLabRuntimeStatusController,
  getTestingLabStatusController,
  resetSandboxToBaselineController,
  runTestingValidationController,
  setActiveTestingBaselineController,
  startTestingSessionController,
};
