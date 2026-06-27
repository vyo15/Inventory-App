const express = require("express");
const { requireLocalAuth, requireLocalAdministrator } = require("../../middlewares/localAuth");
const { IMPORT_BACKUP_MAX_BYTES } = require("./maintenance.service");
const {
  createBackupController,
  deleteOrphanStockReadModelsController,
  createRestorePlanController,
  downloadBackupController,
  executeRestoreController,
  exportMasterDataController,
  getDataQualityAuditController,
  getInitialSetupReadinessController,
  getMaintenanceStatusController,
  getStockReadModelAuditController,
  importBackupController,
  rebuildStockReadModelsController,
  listBackupsController,
  listRestoreLogsController,
} = require("./maintenance.controller");

const router = express.Router();
const requireAdmin = [requireLocalAuth, requireLocalAdministrator];
const backupImportParser = express.raw({
  type: ["application/octet-stream", "application/imsbackup", "application/x-imsbackup"],
  limit: IMPORT_BACKUP_MAX_BYTES,
});

router.get("/status", ...requireAdmin, getMaintenanceStatusController);
router.get("/initial-setup-readiness", ...requireAdmin, getInitialSetupReadinessController);
router.get("/data-audit", ...requireAdmin, getDataQualityAuditController);
router.get("/stock-read-model-audit", ...requireAdmin, getStockReadModelAuditController);
router.post("/stock-read-model-rebuild", ...requireAdmin, rebuildStockReadModelsController);
router.post("/stock-read-model-orphan-cleanup", ...requireAdmin, deleteOrphanStockReadModelsController);
router.get("/master-data-export", ...requireAdmin, exportMasterDataController);
router.post("/backup", ...requireAdmin, createBackupController);
router.get("/backups/:filename/download", ...requireAdmin, downloadBackupController);
router.post("/backups/import", ...requireAdmin, backupImportParser, importBackupController);
router.post("/restore-execute", ...requireAdmin, executeRestoreController);
router.post("/restore-plan", ...requireAdmin, createRestorePlanController);
router.get("/restore-logs", ...requireAdmin, listRestoreLogsController);
router.get("/backups", ...requireAdmin, listBackupsController);

module.exports = router;
