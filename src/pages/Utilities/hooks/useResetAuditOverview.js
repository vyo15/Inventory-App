import { useMemo } from "react";

const AUDIT_SUMMARY_AREAS = [
  { key: "data_quality", label: "Data Quality", collection: "mixed", source: "dataQualityAudit" },
  { key: "hpp_reconcile", label: "HPP Reconcile", collection: "production_work_logs", source: "hppReconcileAudit" },
  { key: "master_code", label: "Kode Master", collection: "master", source: "masterCodeAudit" },
  { key: "stock", label: "Stok Umum", collection: "master stok", source: "stockAudit" },
  { key: "inventory_log", label: "Inventory Log", collection: "inventory_logs", source: "logSchemaAudit" },
  { key: "legacy", label: "Data Lama", collection: "legacy", source: "legacyDataAudit" },
  { key: "production", label: "Produksi", collection: "production_*", source: "maintenanceAudit" },
  { key: "payroll", label: "Payroll Snapshot", collection: "production_payrolls", source: "payrollAudit" },
  { key: "transaction_variant", label: "Variant Transaksi", collection: "sales/purchases/returns", source: "transactionVariantAudit" },
];

const getIssueCount = (summary = {}) => (
  summary.issueCount
  || summary.totalIssueRecords
  || summary.totalIssues
  || summary.problemCount
  || summary.resetManualCount
  || summary.legacyCount
  || summary.warningCount
  || 0
);

const getCheckedRecords = (summary = {}) => (
  summary.checkedRecords
  || summary.totalRecords
  || summary.totalChecked
  || summary.itemCount
  || 0
);

const getSafeRepairCount = (summary = {}) => (
  summary.safeRepairCount
  || summary.displayRepairCount
  || summary.executablePlanCount
  || summary.repairableCount
  || 0
);

const getIssueImpact = (area) => {
  if (area === "Stok Umum") return "Bisa memengaruhi Stock Management dan laporan stok.";
  if (area === "Produksi") return "Bisa memengaruhi BOM/PO/Work Log/Payroll/HPP jika tidak dipilah.";
  if (area === "Inventory Log") return "Bisa memengaruhi audit stok dan trace perubahan.";
  return "Perlu dilihat detail sebelum reset atau repair.";
};

const useResetAuditOverview = ({
  dataQualityAudit,
  hppReconcileAudit,
  masterCodeAudit,
  stockAudit,
  logSchemaAudit,
  legacyDataAudit,
  maintenanceAudit,
  payrollAudit,
  transactionVariantAudit,
} = {}) => {
  const auditSourceMap = useMemo(() => ({
    dataQualityAudit,
    hppReconcileAudit,
    masterCodeAudit,
    stockAudit,
    logSchemaAudit,
    legacyDataAudit,
    maintenanceAudit,
    payrollAudit,
    transactionVariantAudit,
  }), [
    dataQualityAudit,
    hppReconcileAudit,
    masterCodeAudit,
    legacyDataAudit,
    logSchemaAudit,
    maintenanceAudit,
    payrollAudit,
    stockAudit,
    transactionVariantAudit,
  ]);

  const auditOverviewRows = useMemo(() => AUDIT_SUMMARY_AREAS.map((area) => {
    const audit = auditSourceMap[area.source];
    const summary = audit?.summary || {};
    const checkedRecords = getCheckedRecords(summary);
    const issueCount = getIssueCount(summary);
    const safeRepairCount = getSafeRepairCount(summary);

    return {
      key: area.key,
      area: area.label,
      collection: area.collection,
      checkedRecords,
      okCount: checkedRecords && !issueCount ? checkedRecords : summary.okCount || 0,
      issueCount,
      safeRepairCount,
      recommendation: issueCount
        ? "Gunakan ringkasan audit; repair aman atau reset terarah sesuai area."
        : audit ? "Tidak ada issue besar dari summary terakhir." : "Belum dicek.",
    };
  }), [auditSourceMap]);

  const auditIssueRows = useMemo(() => auditOverviewRows
    .filter((item) => item.issueCount || item.safeRepairCount)
    .map((item) => ({
      ...item,
      sample: item.issueCount ? `${item.issueCount} issue terdeteksi` : `${item.safeRepairCount} kandidat repair aman`,
      impact: getIssueImpact(item.area),
    })), [auditOverviewRows]);

  const autoBugSummary = useMemo(() => {
    const checkedAreas = auditOverviewRows.filter((item) => item.checkedRecords > 0 || item.issueCount > 0 || item.safeRepairCount > 0).length;
    const issueCount = auditOverviewRows.reduce((total, item) => total + (Number(item.issueCount) || 0), 0);
    const safeRepairCount = auditOverviewRows.reduce((total, item) => total + (Number(item.safeRepairCount) || 0), 0);
    const uncheckedCount = Math.max(AUDIT_SUMMARY_AREAS.length - checkedAreas, 0);

    return {
      checkedAreas,
      issueCount,
      safeRepairCount,
      uncheckedCount,
      status: !checkedAreas ? "Belum dicek" : issueCount ? "Ada temuan" : safeRepairCount ? "Ada repair aman" : "OK",
      color: !checkedAreas ? "default" : issueCount ? "red" : safeRepairCount ? "blue" : "green",
    };
  }, [auditOverviewRows]);

  return {
    auditOverviewRows,
    auditIssueRows,
    autoBugSummary,
  };
};

export default useResetAuditOverview;
