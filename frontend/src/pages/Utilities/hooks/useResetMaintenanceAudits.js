import { useCallback, useMemo, useState } from "react";
import { showActionError, showActionSuccess } from "../../../utils/feedback/actionResultFeedback";
import { getDataQualityAudit } from "../../../services/Maintenance/dataQualityAuditService";

const buildCategoryRows = (audit) => (audit?.categories || []).map((item) => {
  const samplePreview = (item.samples || []).slice(0, 3).map((sample) => {
    const collectionLabel = sample.collectionName || "data";
    const referenceLabel = sample.reference || sample.name || sample.id || "-";
    return `${collectionLabel} • ${referenceLabel}: ${sample.issue || item.label}`;
  }).join(" | ");

  return {
    key: item.key,
    categoryLabel: item.label,
    collection: item.collection,
    checkedRecords: Number(item.checkedRecords || 0),
    count: Number(item.count || 0),
    safeRepairCount: Number(item.safeRepairCount || 0),
    samplePreview: samplePreview || "Tidak ada temuan.",
    recommendation: item.recommendation || "Tidak ada tindakan lanjutan.",
  };
});

const useResetMaintenanceAudits = () => {
  const [dataQualityAudit, setDataQualityAudit] = useState(null);
  const [loadingDataQualityAudit, setLoadingDataQualityAudit] = useState(false);

  const handleLoadDataQualityAudit = useCallback(async ({ showSuccessMessage = true } = {}) => {
    try {
      setLoadingDataQualityAudit(true);
      const result = await getDataQualityAudit();
      setDataQualityAudit(result);
      if (showSuccessMessage) {
        showActionSuccess("Audit kualitas data selesai. Tidak ada data yang diubah.");
      }
      return result;
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menjalankan audit kualitas data.");
      return null;
    } finally {
      setLoadingDataQualityAudit(false);
    }
  }, []);

  const dataQualityCategoryRows = useMemo(
    () => buildCategoryRows(dataQualityAudit),
    [dataQualityAudit],
  );

  const autoBugSummary = useMemo(() => {
    const summary = dataQualityAudit?.summary || {};
    const checkedAreas = Number(summary.checkedAreas || 0);
    const issueCount = Number(summary.issueCount ?? summary.totalIssues ?? 0);
    const safeRepairCount = Number(summary.safeRepairCount || 0);

    return {
      checkedAreas,
      checkedRecords: Number(summary.checkedRecords || 0),
      issueCount,
      safeRepairCount,
      status: !dataQualityAudit ? "Belum dicek" : issueCount ? "Ada temuan" : "Sehat",
      color: !dataQualityAudit ? "default" : issueCount ? "orange" : "green",
      auditedAt: dataQualityAudit?.auditedAt || null,
    };
  }, [dataQualityAudit]);

  return {
    dataQualityAudit,
    loadingDataQualityAudit,
    handleLoadDataQualityAudit,
    dataQualityCategoryRows,
    autoBugSummary,
  };
};

export default useResetMaintenanceAudits;
