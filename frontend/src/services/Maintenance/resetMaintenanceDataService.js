export {
  DEFAULT_RESET_MODULES,
  DEV_TEST_DATA_MARKER,
  FULL_TESTING_RESET_HPP_MODE,
  HPP_COST_BASELINE_DOC_ID,
  HPP_COST_RESET_OPTIONS,
  MASTER_DATA_EXPORT_COLLECTIONS,
  PROTECTED_MASTER_COLLECTIONS,
  RESET_ALL_TESTING_MODULES,
  RESET_MODE_OPTIONS,
} from "./config/resetMaintenanceDataConfig";

const sqliteOnly = (label = "maintenance") => ({ mode: "sqlite_only", label, warnings: [], destructiveAllowed: false, note: "Reset legacy sudah dihapus. Gunakan backup/restore resmi untuk maintenance data." });
export const buildMasterDataExportPayload = async ({ includeOpeningStock = true } = {}) => ({ exportMeta: { project: "IMS Bunga Flanel", exportType: "sqlite-master-data-json", exportedAt: new Date().toISOString(), includeOpeningStock }, summary: { totalCollections: 0, totalRecords: 0, openingStockRows: 0, warnings: 0 }, collections: [], openingStockReference: [], warnings: [] });
export const getMasterDataExportPreview = async () => ({ ...sqliteOnly("export_preview"), payload: await buildMasterDataExportPayload() });
export const getHppCostResetPreview = async ({ resetMode } = {}) => ({ ...sqliteOnly("hpp_cost_reset"), resetMode });
export const saveCurrentHppCostBaseline = async () => ({ saved: false, ...sqliteOnly("hpp_baseline") });
export const getHppCostBaselineSummary = async () => ({ exists: false, ...sqliteOnly("hpp_baseline_summary") });
export const restoreHppCostBaseline = async () => ({ restored: 0, ...sqliteOnly("hpp_baseline_restore") });
export const runHppCostReset = async ({ resetMode } = {}) => ({ updated: 0, resetMode, ...sqliteOnly("hpp_cost_reset") });
export const getFullTestingResetPreview = async () => ({ ...sqliteOnly("full_testing_reset") });
export const getResetPreview = async ({ resetMode, modules } = {}) => ({ resetMode, modules, ...sqliteOnly("reset_preview") });
export const saveCurrentStockAsTestingBaseline = async () => ({ saved: false, ...sqliteOnly("stock_baseline") });
export const syncAllStocks = async () => ({ synced: 0, ...sqliteOnly("sync_stocks") });
export const getDevTestDataPreview = async () => ({ ...sqliteOnly("dev_test_data") });
export const deleteDevTestData = async () => ({ deleted: 0, ...sqliteOnly("dev_test_data_delete") });
export const runFullTestingReset = async () => ({ reset: false, ...sqliteOnly("full_testing_reset") });
export const runResetDataTest = async ({ resetMode, modules } = {}) => ({ resetMode, modules, reset: false, ...sqliteOnly("reset_data_test") });
