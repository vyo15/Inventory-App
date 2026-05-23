import { useCallback, useState } from "react";
import { message } from "antd";
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

// -----------------------------------------------------------------------------
// IMS NOTE [AKTIF/BATCH 19B] — hook orchestration export data pokok.
// Fungsi blok: memindahkan state + handler Preview Export, Export Master, dan
// Export Checklist dari halaman ResetMaintenanceData agar page tidak menumpuk
// orchestration UI.
// Guard: read-only/export only; hook ini tidak menjalankan reset, delete, repair,
// mutasi stok/kas/transaksi, payroll, HPP, atau destructive maintenance flow.
// -----------------------------------------------------------------------------
const useMasterDataExport = () => {
  const [loadingMasterExportPreview, setLoadingMasterExportPreview] = useState(false);
  const [loadingMasterExport, setLoadingMasterExport] = useState(false);
  const [masterExportPreview, setMasterExportPreview] = useState(null);
  const [lastMasterExport, setLastMasterExport] = useState(null);

  const handleLoadMasterExportPreview = useCallback(async () => {
    try {
      setLoadingMasterExportPreview(true);
      const result = await getMasterDataExportPreview();
      setMasterExportPreview(result);
      message.success("Preview export data pokok berhasil dimuat.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memuat preview export data pokok.");
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
        message.warning("Export berhasil, tetapi ada collection yang gagal dibaca. Cek warning di section Export.");
      } else {
        message.success("Export data pokok JSON berhasil diunduh.");
      }
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal export data pokok JSON.");
    } finally {
      setLoadingMasterExport(false);
    }
  }, []);

  const handleDownloadMasterExportChecklist = useCallback(async () => {
    try {
      setLoadingMasterExport(true);
      const previewPayload = await getMasterDataExportPreview();
      const checklistPayload = {
        exportMeta: {
          project: "IMS Bunga Flanel",
          exportType: "master-data-checklist-summary",
          exportedAt: new Date().toISOString(),
          source: "ResetMaintenanceData",
          notes: "Ringkasan checklist export data pokok; tidak berisi transaksi/log dan tidak bisa direstore otomatis.",
        },
        summary: previewPayload.summary,
        warnings: previewPayload.warnings || [],
        nextSteps: [
          "Review master product/raw material/semi finished/supplier/customer/BOM/step.",
          "Jangan import transaksi/log lama sebagai default jika logic baru berubah.",
          "Buat opening stock ulang lewat purchase/opening adjustment setelah reset.",
          "Jalankan audit ulang setelah reset/input ulang.",
        ],
      };
      downloadJsonPayload(checklistPayload, buildMasterExportFilename());
      setMasterExportPreview(previewPayload);
      setLastMasterExport({
        exportedAt: checklistPayload.exportMeta.exportedAt,
        totalCollections: previewPayload.summary?.totalCollections || 0,
        totalRecords: previewPayload.summary?.totalRecords || 0,
        openingStockRows: 0,
        warnings: previewPayload.warnings || [],
        includeOpeningStock: false,
      });
      message.success("Export Ringkasan Checklist JSON berhasil diunduh.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal export ringkasan checklist JSON.");
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
    handleDownloadMasterExportChecklist,
  };
};

export default useMasterDataExport;
