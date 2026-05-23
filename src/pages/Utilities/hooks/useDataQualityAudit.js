import { useCallback, useMemo, useState } from "react";
import { message } from "antd";
import { getDataQualityAudit } from "../../../services/Maintenance/dataQualityAuditService";

const DATA_QUALITY_AUDIT_LOG_PAYLOAD = {
  mode: "dry_run",
  modules: ["data_quality", "legacy_data"],
  dryRun: true,
  status: "success",
  note: "Data Quality Audit hanya membaca data legacy/testing dan menampilkan rekomendasi; tidak ada migration, backfill, delete, stok, kas, payroll, HPP, atau transaksi yang diubah.",
};

// -----------------------------------------------------------------------------
// IMS NOTE [AKTIF/BATCH 19D] — hook orchestration Data Quality Audit.
// Fungsi blok: memindahkan state + handler Cek Data Lama dari halaman
// ResetMaintenanceData agar page tidak menumpuk orchestration audit read-only.
// Guard: dry-run only; hook ini tidak membuat repair, income, expense,
// inventory log, dan tidak mengubah stok/kas/transaksi/payroll/HPP.
// -----------------------------------------------------------------------------
const useDataQualityAudit = ({ createPageMaintenanceLog } = {}) => {
  const [dataQualityAudit, setDataQualityAudit] = useState(null);
  const [loadingDataQualityAudit, setLoadingDataQualityAudit] = useState(false);

  const dataQualityCategoryRows = useMemo(() => (dataQualityAudit?.categories || [])
    .filter((item) => Number(item.count || 0) > 0)
    .map((item) => {
      const samplePreview = (item.samples || []).slice(0, 3).map((sample) => {
        const collectionLabel = sample.collectionName || "data";
        const referenceLabel = sample.reference || sample.name || sample.id || "-";
        return `${collectionLabel} • ${referenceLabel}: ${sample.issue || item.label}`;
      }).join(" | ");

      return {
        key: item.key,
        categoryLabel: item.label,
        count: Number(item.count || 0),
        samplePreview: samplePreview || "Tidak ada sample detail.",
        recommendation: item.recommendation || "Cek manual sebelum repair/reset.",
      };
    }), [dataQualityAudit]);

  const handleLoadDataQualityAudit = useCallback(async ({ showProblemPreview = false } = {}) => {
    try {
      setLoadingDataQualityAudit(true);
      const result = await getDataQualityAudit();
      setDataQualityAudit(result);

      if (typeof createPageMaintenanceLog === "function") {
        await createPageMaintenanceLog({
          ...DATA_QUALITY_AUDIT_LOG_PAYLOAD,
          actionType: showProblemPreview ? "data_quality_problem_preview" : "data_quality_audit",
          summary: result?.summary || {},
          affectedCollections: (result?.categories || []).map((item) => item.collection || item.key).filter(Boolean),
          affectedCount: result?.summary?.checkedRecords || 0,
        });
      }

      message.success(showProblemPreview ? "Preview data bermasalah berhasil dimuat. Tidak ada data yang diubah." : "Audit data lama selesai. Tidak ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan Data Quality Audit.");
    } finally {
      setLoadingDataQualityAudit(false);
    }
  }, [createPageMaintenanceLog]);

  return {
    dataQualityAudit,
    loadingDataQualityAudit,
    dataQualityCategoryRows,
    handleLoadDataQualityAudit,
  };
};

export default useDataQualityAudit;
