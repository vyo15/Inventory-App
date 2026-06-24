import { getSqliteMasterDataExport } from "../System/sqliteBackendStatusService";

export const MAINTENANCE_DATA_TOOL_CAPABILITIES = Object.freeze({
  dataQualityAudit: true,
  stockReadModelAudit: true,
  stockReadModelRebuild: true,
  stockReadModelOrphanCleanup: true,
  masterDataExport: true,
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
  mode: "read_only_export_preview",
  destructiveAllowed: false,
  payload: await buildMasterDataExportPayload(),
});
