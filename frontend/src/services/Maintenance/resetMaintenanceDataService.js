import { getSqliteMasterDataExport } from "../System/sqliteBackendStatusService";

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

export const getHppCostResetPreview = async ({ resetMode } = {}) => ({
  ...maintenanceOnly("hpp_cost_reset"),
  resetMode,
});

export const saveCurrentHppCostBaseline = async () => ({ saved: false, ...maintenanceOnly("hpp_baseline") });
export const getHppCostBaselineSummary = async () => ({ exists: false, ...maintenanceOnly("hpp_baseline_summary") });
export const restoreHppCostBaseline = async () => ({ restored: 0, ...maintenanceOnly("hpp_baseline_restore") });
export const runHppCostReset = async ({ resetMode } = {}) => ({ updated: 0, resetMode, ...maintenanceOnly("hpp_cost_reset") });
