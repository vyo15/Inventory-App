const { success } = require("../../utils/response");
const { getRequestActor, getRequestActorUser } = require("../../utils/requestActor");
const {
  buildMasterDataExportPayload,
  createBackup,
  createRestorePlan,
  executeRestore,
  getDataQualityAudit,
  getBackupDownload,
  getInitialSetupReadiness,
  getMaintenanceStatus,
  getStockReadModelMaintenanceAudit,
  importBackupFile,
  rebuildStockReadModels,
  deleteOrphanStockReadModels,
  listBackups,
  listInactivePurgeCandidates,
  listRestoreLogs,
  purgeInactiveRecord,
} = require("./maintenance.service");


const getMaintenanceStatusController = async (_req, res, next) => {
  try {
    const status = await getMaintenanceStatus();
    return success(res, "Status layanan database lokal berhasil dimuat", status);
  } catch (error) {
    return next(error);
  }
};

const getInitialSetupReadinessController = async (_req, res, next) => {
  try {
    const readiness = await getInitialSetupReadiness();
    return success(res, "Status setup awal IMS berhasil dimuat", readiness);
  } catch (error) {
    return next(error);
  }
};

const getDataQualityAuditController = async (req, res, next) => {
  try {
    const result = await getDataQualityAudit({ actor: getRequestActor(req) });
    return success(res, "Audit kualitas data selesai. Tidak ada data yang diubah.", result);
  } catch (error) {
    return next(error);
  }
};

const getStockReadModelAuditController = async (_req, res, next) => {
  try {
    const result = await getStockReadModelMaintenanceAudit();
    return success(res, "Audit data turunan stok selesai. Tidak ada data yang diubah.", result);
  } catch (error) {
    return next(error);
  }
};

const rebuildStockReadModelsController = async (req, res, next) => {
  try {
    const result = await rebuildStockReadModels({ actor: getRequestActor(req) });
    return success(res, result.message || "Data turunan stok berhasil diperbaiki.", result);
  } catch (error) {
    return next(error);
  }
};

const deleteOrphanStockReadModelsController = async (req, res, next) => {
  try {
    const result = await deleteOrphanStockReadModels({
      confirmKeyword: req.body?.confirmKeyword,
      actor: getRequestActor(req),
    });
    return success(res, result.message || "Data turunan stok yatim berhasil dibersihkan.", result);
  } catch (error) {
    return next(error);
  }
};

const exportMasterDataController = async (req, res, next) => {
  try {
    const includeOpeningStock = String(req.query?.includeOpeningStock ?? "true") !== "false";
    const payload = await buildMasterDataExportPayload({ includeOpeningStock });
    return success(res, "Export data master SQLite berhasil dimuat", payload);
  } catch (error) {
    return next(error);
  }
};

const createBackupController = async (req, res, next) => {
  try {
    const backup = await createBackup({
      type: req.body?.backupType || req.body?.type || "manual",
      actor: getRequestActor(req),
      notes: req.body?.notes || "Backup manual resmi dari UI IMS.",
    });
    return success(res, "Backup database berhasil dibuat dan diverifikasi", backup);
  } catch (error) {
    return next(error);
  }
};

const downloadBackupController = async (req, res, next) => {
  try {
    const backup = await getBackupDownload(req.params.filename || "");
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("X-IMS-Backup-Filename", encodeURIComponent(backup.filename));
    return res.download(backup.path, backup.filename);
  } catch (error) {
    return next(error);
  }
};

const importBackupController = async (req, res, next) => {
  try {
    const summary = await importBackupFile({
      body: req.body,
      headers: req.headers,
      query: req.query,
      actor: getRequestActor(req),
    });
    return success(res, "File Backup IMS berhasil diimport dan valid untuk restore.", summary);
  } catch (error) {
    return next(error);
  }
};

const executeRestoreController = async (req, res, next) => {
  try {
    const result = await executeRestore({
      confirmKeyword: req.body?.confirmKeyword,
      filename: req.body?.filename,
      backupFileName: req.body?.backupFileName,
      actor: getRequestActor(req),
    });

    if (!result.restored) {
      const message = result.backupRequired
        ? "Restore dibatalkan karena filename backup wajib dipilih secara eksplisit."
        : result.backupFileExists === false
          ? "Restore dibatalkan karena file backup tidak ditemukan."
          : result.preview
            ? "Restore dibatalkan karena backup tidak lolos validasi."
            : "Restore belum dijalankan. Keyword konfirmasi belum sesuai.";
      return success(res, message, result);
    }

    return success(
      res,
      "Restore database lokal guarded berhasil dijalankan. Refresh aplikasi dan login ulang bila diperlukan.",
      result,
    );
  } catch (error) {
    return next(error);
  }
};

const createRestorePlanController = async (req, res, next) => {
  try {
    const result = await createRestorePlan({
      filename: req.body?.filename,
      backupFileName: req.body?.backupFileName,
      actor: getRequestActor(req),
    });
    return success(res, "Restore plan dibuat sebagai preview-only. Tidak ada data yang diubah.", result);
  } catch (error) {
    return next(error);
  }
};

const listRestoreLogsController = async (_req, res, next) => {
  try {
    const rows = await listRestoreLogs();
    return success(res, "Daftar restore plan database lokal berhasil dimuat", rows);
  } catch (error) {
    return next(error);
  }
};


const listInactivePurgeCandidatesController = async (req, res, next) => {
  try {
    const result = await listInactivePurgeCandidates({
      entityType: req.query?.entityType || "",
      actorUser: getRequestActorUser(req),
    });
    return success(res, "Preview data nonaktif berhasil dimuat. Tidak ada data yang diubah.", result);
  } catch (error) {
    return next(error);
  }
};

const purgeInactiveRecordController = async (req, res, next) => {
  try {
    const result = await purgeInactiveRecord({
      entityType: req.body?.entityType,
      id: req.body?.id,
      confirmKeyword: req.body?.confirmKeyword,
      confirmTarget: req.body?.confirmTarget,
      actorUser: getRequestActorUser(req),
    });
    return success(res, "Data nonaktif berhasil dihapus permanen dan snapshot audit dipertahankan.", result);
  } catch (error) {
    return next(error);
  }
};

const listBackupsController = async (_req, res, next) => {
  try {
    const rows = await listBackups();
    return success(res, "Daftar backup database lokal berhasil dimuat", rows);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createBackupController,
  createRestorePlanController,
  downloadBackupController,
  executeRestoreController,
  deleteOrphanStockReadModelsController,
  exportMasterDataController,
  getDataQualityAuditController,
  getInitialSetupReadinessController,
  getMaintenanceStatusController,
  getStockReadModelAuditController,
  importBackupController,
  rebuildStockReadModelsController,
  listBackupsController,
  listInactivePurgeCandidatesController,
  listRestoreLogsController,
  purgeInactiveRecordController,
};
