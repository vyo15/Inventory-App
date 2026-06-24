import { useCallback, useState } from "react";
import { showActionError, showActionInfo, showActionSuccess } from "../../../utils/feedback/actionResultFeedback";
import {
  buildMasterDataExportPayload,
  getMasterDataExportPreview,
} from "../../../services/Maintenance/resetMaintenanceDataService";

const MASTER_EXPORT_FILENAME_PREFIX = "ims-master-data-export";

const downloadJsonPayload = (payload, filename) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const getTimestampForFilename = () => {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
};

const buildMasterExportFilename = () => `${MASTER_EXPORT_FILENAME_PREFIX}-${getTimestampForFilename()}.json`;

const useMasterDataExport = () => {
  const [loadingMasterExportPreview, setLoadingMasterExportPreview] = useState(false);
  const [loadingMasterExport, setLoadingMasterExport] = useState(false);
  const [masterExportPreview, setMasterExportPreview] = useState(null);
  const [lastMasterExport, setLastMasterExport] = useState(null);

  const handleLoadMasterExportPreview = useCallback(async () => {
    try {
      setLoadingMasterExportPreview(true);
      const result = await getMasterDataExportPreview();
      setMasterExportPreview(result?.payload || result);
      showActionSuccess("Preview export data master berhasil dimuat.");
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal memuat preview export data master.");
    } finally {
      setLoadingMasterExportPreview(false);
    }
  }, []);

  const handleDownloadMasterExport = useCallback(async (includeOpeningStock = true) => {
    try {
      setLoadingMasterExport(true);
      const payload = await buildMasterDataExportPayload({ includeOpeningStock });
      downloadJsonPayload(payload, buildMasterExportFilename());
      setLastMasterExport({
        exportedAt: payload.exportMeta?.exportedAt,
        totalCollections: payload.summary?.totalCollections || 0,
        totalRecords: payload.summary?.totalRecords || 0,
        openingStockRows: payload.summary?.openingStockRows || 0,
        warnings: payload.warnings || [],
        includeOpeningStock,
      });
      setMasterExportPreview({
        exportMeta: payload.exportMeta,
        summary: payload.summary,
        warnings: payload.warnings,
      });
      if (payload.warnings?.length) {
        showActionInfo("Export berhasil, tetapi ada data master yang gagal dibaca. Cek jumlah warning pada panel Export.");
      } else {
        showActionSuccess("Export data master JSON berhasil diunduh.");
      }
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal export data master JSON.");
    } finally {
      setLoadingMasterExport(false);
    }
  }, []);

  return {
    loadingMasterExportPreview,
    loadingMasterExport,
    masterExportPreview,
    lastMasterExport,
    handleLoadMasterExportPreview,
    handleDownloadMasterExport,
  };
};

export default useMasterDataExport;
