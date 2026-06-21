import { getSqliteMasterDataExport } from "../System/sqliteBackendStatusService";

export const MAINTENANCE_DATA_TOOL_CAPABILITIES = Object.freeze({
  dataQualityAudit: true,
  stockReadModelAudit: true,
  stockReadModelRebuild: true,
  stockReadModelOrphanCleanup: true,
});

export const MAINTENANCE_DATA_TOOLS_MODE = "safe_subset";
export const MAINTENANCE_DATA_TOOLS_AVAILABLE = true;
export const MAINTENANCE_DATA_TOOLS_UNAVAILABLE_MESSAGE =
  "Audit read-only dan repair data turunan stok tersedia. Repair stok utama, transaksi, finance, production, payroll, dan HPP otomatis tetap dinonaktifkan agar data bisnis tidak berubah tanpa kontrak yang teruji.";

export const throwUnavailableMaintenanceTool = (label = "Maintenance tool") => {
  const error = new Error(`${label} belum tersedia pada backend SQLite aktif.`);
  error.code = "MAINTENANCE_TOOL_UNAVAILABLE";
  throw error;
};

export {
  HPP_COST_BASELINE_DOC_ID,
  HPP_COST_RESET_OPTIONS,
  MASTER_DATA_EXPORT_COLLECTIONS,
  PROTECTED_MASTER_COLLECTIONS,
} from "./config/resetMaintenanceDataConfig";

const maintenanceOnly = (label = "maintenance") => ({
  mode: "database_local_active",
  label,
  warnings: [],
  destructiveAllowed: false,
  note: "Maintenance aktif dibatasi ke backup/restore, audit data, repair aman, dan export master.",
});

export const buildMasterDataExportPayload = async ({ includeOpeningStock = true } = {}) => {
  const response = await getSqliteMasterDataExport({ includeOpeningStock });
  return response?.data || {
    exportMeta: {
      project: "IMS Bunga Flanel",
      exportType: "master-data-json",
      dataSource: "sqlite_backend_unavailable",
      exportedAt: new Date().toISOString(),
      includeOpeningStock,
    },
    summary: {
      totalCollections: 0,
      totalRecords: 0,
      openingStockRows: 0,
      warnings: 1,
    },
    collections: [],
    openingStockReference: [],
    warnings: [{ message: "Export data master belum menerima payload dari layanan lokal." }],
  };
};

export const getMasterDataExportPreview = async () => ({
  ...maintenanceOnly("export_preview"),
  payload: await buildMasterDataExportPayload(),
});

export const getHppCostResetPreview = async () =>
  throwUnavailableMaintenanceTool("Preview reset modal/HPP");

export const saveCurrentHppCostBaseline = async () =>
  throwUnavailableMaintenanceTool("Simpan baseline modal/HPP");

export const getHppCostBaselineSummary = async () => ({
  exists: false,
  available: MAINTENANCE_DATA_TOOLS_AVAILABLE,
  ...maintenanceOnly("hpp_baseline_summary"),
});

export const restoreHppCostBaseline = async () =>
  throwUnavailableMaintenanceTool("Restore baseline modal/HPP");

export const runHppCostReset = async () =>
  throwUnavailableMaintenanceTool("Reset modal/HPP");
