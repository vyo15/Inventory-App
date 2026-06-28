const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const controller = require("./testingLab.controller");

const router = express.Router();
const requireAdmin = [requireLocalAuth, requireLocalAdministrator];

router.get("/runtime", requireLocalAuth, controller.getTestingLabRuntimeStatusController);
router.get("/status", ...requireAdmin, controller.getTestingLabStatusController);
router.get("/result-export", ...requireAdmin, controller.exportLastTestingResultController);
router.post("/baseline", ...requireAdmin, controller.createTestingBaselineController);
router.post("/baseline/select", ...requireAdmin, controller.setActiveTestingBaselineController);
router.post("/reset", ...requireAdmin, controller.resetSandboxToBaselineController);
router.post("/sessions", ...requireAdmin, controller.startTestingSessionController);
router.post("/sessions/complete", ...requireAdmin, controller.completeTestingSessionController);
router.post("/sessions/cancel", ...requireAdmin, controller.cancelTestingSessionController);
router.post("/validate", ...requireAdmin, controller.runTestingValidationController);

module.exports = router;
