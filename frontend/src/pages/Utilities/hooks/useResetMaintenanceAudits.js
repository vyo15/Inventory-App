import { useCallback, useMemo, useState } from "react";
import { showActionError, showActionSuccess } from "../../../utils/feedback/actionResultFeedback";
import { getProductionVariantMaintenanceAudit } from "../../../services/Maintenance/productionVariantMaintenanceService";
import {
  getInventoryLogSchemaAudit,
  getInventoryStockMaintenanceAudit,
} from "../../../services/Maintenance/inventoryMaintenanceService";
import { getHistoricalDataMaintenanceAudit } from "../../../services/Maintenance/historicalDataMaintenanceService";
import { getDataQualityAudit } from "../../../services/Maintenance/dataQualityAuditService";
import { getHppReconcileMaintenanceAudit } from "../../../services/Maintenance/hppReconcileMaintenanceService";
import { getMasterCodeMaintenanceAudit } from "../../../services/Maintenance/masterCodeMaintenanceService";
import { getPayrollSnapshotMaintenanceAudit } from "../../../services/Maintenance/payrollMaintenanceService";
import { getTransactionVariantMaintenanceAudit } from "../../../services/Maintenance/transactionVariantMaintenanceService";
import { getTransactionSideEffectRepairAudit } from "../../../services/Maintenance/transactionSideEffectRepairService";
import { MAINTENANCE_DATA_TOOLS_MODE } from "../../../services/Maintenance/resetMaintenanceDataService";
import { AUDIT_SUMMARY_AREAS } from "../utils/resetMaintenanceUiHelpers";

const useResetMaintenanceAudits = ({ createPageMaintenanceLog }) => {
  // ---------------------------------------------------------------------------
  // IMS NOTE [AKTIF] — orchestration audit read-only Reset Maintenance.
  // Hook ini hanya memindahkan state/handler audit dari page jumbo agar page tetap
  // fokus ke flow maintenance lama. Service audit tetap source of truth.
  // ---------------------------------------------------------------------------
  const [maintenanceAudit, setMaintenanceAudit] = useState(null);
  const [stockAudit, setStockAudit] = useState(null);
  const [logSchemaAudit, setLogSchemaAudit] = useState(null);
  const [historicalDataAudit, setHistoricalDataAudit] = useState(null);
  const [dataQualityAudit, setDataQualityAudit] = useState(null);
  const [hppReconcileAudit, setHppReconcileAudit] = useState(null);
  const [masterCodeAudit, setMasterCodeAudit] = useState(null);
  const [payrollAudit, setPayrollAudit] = useState(null);
  const [transactionVariantAudit, setTransactionVariantAudit] = useState(null);
  const [transactionSideEffectAudit, setTransactionSideEffectAudit] = useState(null);

  const [loadingMaintenanceAudit, setLoadingMaintenanceAudit] = useState(false);
  const [loadingStockAudit, setLoadingStockAudit] = useState(false);
  const [loadingLogSchemaAudit, setLoadingLogSchemaAudit] = useState(false);
  const [loadingHistoricalDataAudit, setLoadingHistoricalDataAudit] = useState(false);
  const [loadingDataQualityAudit, setLoadingDataQualityAudit] = useState(false);
  const [loadingHppReconcileAudit, setLoadingHppReconcileAudit] = useState(false);
  const [loadingMasterCodeAudit, setLoadingMasterCodeAudit] = useState(false);
  const [loadingPayrollAudit, setLoadingPayrollAudit] = useState(false);
  const [loadingTransactionVariantAudit, setLoadingTransactionVariantAudit] = useState(false);
  const [loadingTransactionSideEffectAudit, setLoadingTransactionSideEffectAudit] = useState(false);

  const handleLoadMasterCodeAudit = useCallback(async () => {
    try {
      setLoadingMasterCodeAudit(true);
      const result = await getMasterCodeMaintenanceAudit();
      setMasterCodeAudit(result);
      await createPageMaintenanceLog({
        actionType: "master_code_audit",
        mode: "dry_run",
        modules: ["master_data", "production_setup"],
        summary: result?.summary || {},
        affectedCollections: result?.affectedCollections || [],
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
        status: "success",
        note: "Audit kode master hanya membaca format kode Product/Raw/Semi/BOM/Step/Supplier.",
      });
      showActionSuccess("Dry run kode master selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menjalankan audit kode master.");
    } finally {
      setLoadingMasterCodeAudit(false);
    }
  }, [createPageMaintenanceLog]);

  const handleLoadProductionMaintenanceAudit = useCallback(async () => {
    try {
      setLoadingMaintenanceAudit(true);
      const result = await getProductionVariantMaintenanceAudit();
      setMaintenanceAudit(result);
      await createPageMaintenanceLog({
        actionType: "production_variant_audit",
        mode: "dry_run",
        modules: ["production"],
        summary: result?.summary || {},
        affectedCollections: ["production_orders", "production_work_logs", "inventory_logs"],
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
        status: "success",
      });
      showActionSuccess("Dry run audit produksi selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menjalankan audit maintenance produksi.");
    } finally {
      setLoadingMaintenanceAudit(false);
    }
  }, [createPageMaintenanceLog]);

  const handleLoadStockAudit = useCallback(async () => {
    try {
      setLoadingStockAudit(true);
      const result = await getInventoryStockMaintenanceAudit();
      setStockAudit(result);
      await createPageMaintenanceLog({
        actionType: "inventory_stock_audit",
        mode: "dry_run",
        modules: ["inventory"],
        summary: result?.summary || {},
        affectedCollections: ["raw_materials", "semi_finished_materials", "products"],
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
        status: "success",
      });
      showActionSuccess("Dry run stok umum selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menjalankan audit stok umum.");
    } finally {
      setLoadingStockAudit(false);
    }
  }, [createPageMaintenanceLog]);

  const handleLoadLogSchemaAudit = useCallback(async () => {
    try {
      setLoadingLogSchemaAudit(true);
      const result = await getInventoryLogSchemaAudit();
      setLogSchemaAudit(result);
      await createPageMaintenanceLog({
        actionType: "inventory_log_schema_audit",
        mode: "dry_run",
        modules: ["inventory_logs"],
        summary: result?.summary || {},
        affectedCollections: ["inventory_logs"],
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
        status: "success",
      });
      showActionSuccess("Dry run schema inventory log selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menjalankan audit schema inventory log.");
    } finally {
      setLoadingLogSchemaAudit(false);
    }
  }, [createPageMaintenanceLog]);

  const handleLoadDataQualityAudit = useCallback(async ({ showProblemPreview = false } = {}) => {
    try {
      setLoadingDataQualityAudit(true);
      /*
      =====================================================
      SECTION: Data Quality Audit handler — COMPATIBILITY
      Fungsi:
      - Memanggil audit arsip data secara read-only, menampilkan ringkasan area, dan mencatat audit log metadata.

      Dipakai oleh:
      - Tombol Cek Arsip Data di panel Auto Detect Bug Data.

      Alasan perubahan:
      - Project masih development sehingga arsip data cukup dipetakan untuk reset/recreate manual, bukan dimigrasi otomatis.

      Catatan cleanup:
      - Jika nanti audit ini dipakai di halaman lain, handler bisa dipindah ke hook maintenance khusus.

      Risiko:
      - Jangan tambahkan write/delete data bisnis di handler ini; audit log hanya metadata agar tidak mengubah stok, kas, payroll, HPP, atau transaksi.
      =====================================================
      */
      const result = await getDataQualityAudit();
      setDataQualityAudit(result);
      await createPageMaintenanceLog({
        actionType: showProblemPreview ? "data_quality_problem_preview" : "data_quality_audit",
        mode: "dry_run",
        modules: ["data_quality", "historical_data"],
        summary: result?.summary || {},
        affectedCollections: (result?.categories || []).map((item) => item.collection || item.key).filter(Boolean),
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
        status: "success",
        note: "Data Quality Audit hanya membaca data historis/testing dan menampilkan rekomendasi; tidak ada migrasi massal, backfill, delete, stok, kas, payroll, HPP, atau transaksi yang diubah.",
      });
      showActionSuccess(showProblemPreview ? "Preview data bermasalah berhasil dimuat. Tidak ada data yang diubah." : "Audit data historis selesai. Tidak ada data yang diubah.");
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menjalankan Data Quality Audit.");
    } finally {
      setLoadingDataQualityAudit(false);
    }
  }, [createPageMaintenanceLog]);

  const handleLoadHppReconcileAudit = useCallback(async () => {
    try {
      setLoadingHppReconcileAudit(true);
      const result = await getHppReconcileMaintenanceAudit();
      setHppReconcileAudit(result);
      await createPageMaintenanceLog({
        actionType: "hpp_output_reconcile_audit",
        mode: "dry_run",
        modules: ["production", "hpp"],
        summary: result?.summary || {},
        affectedCollections: ["production_work_logs", "products", "semi_finished_materials"],
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
        status: "success",
        note: "Audit HPP output hanya membaca Work Log completed dan master Product/Semi Finished; tidak ada stok, inventory log, kas, payroll, atau HPP yang diubah.",
      });
      showActionSuccess("Dry run HPP output reconcile selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menjalankan audit HPP output reconcile.");
    } finally {
      setLoadingHppReconcileAudit(false);
    }
  }, [createPageMaintenanceLog]);

  const handleLoadHistoricalDataAudit = useCallback(async () => {
    try {
      setLoadingHistoricalDataAudit(true);
      const result = await getHistoricalDataMaintenanceAudit();
      setHistoricalDataAudit(result);
      await createPageMaintenanceLog({
        actionType: "historical_data_audit",
        mode: "dry_run",
        modules: ["historical_data", "cleanup_batch_3"],
        summary: result?.summary || {},
        affectedCollections: [
          "productions",
          "production_orders",
          "production_work_logs",
          "inventory_logs",
          "sales",
          "returns",
          "stock_adjustments",
          "purchases",
          "incomes",
          "expenses",
        ],
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
        status: "success",
        note: "Audit data historis hanya membaca data dan memberi rekomendasi reset/repair terarah.",
      });
      showActionSuccess("Dry run data historis selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menjalankan audit data historis.");
    } finally {
      setLoadingHistoricalDataAudit(false);
    }
  }, [createPageMaintenanceLog]);

  const handleLoadPayrollAudit = useCallback(async () => {
    try {
      setLoadingPayrollAudit(true);
      const result = await getPayrollSnapshotMaintenanceAudit();
      setPayrollAudit(result);
      await createPageMaintenanceLog({
        actionType: "payroll_snapshot_audit",
        mode: "dry_run",
        modules: ["production", "production_payroll_only"],
        summary: result?.summary || {},
        planSummary: result?.summary || {},
        affectedCollections: ["production_steps", "production_work_logs", "production_payrolls"],
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
        status: "success",
        note: "Dry run payroll snapshot hanya membaca mismatch Step vs Work Log tanpa mengubah payroll final.",
      });
      showActionSuccess("Dry run payroll/work log stale snapshot selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menjalankan audit payroll/work log stale snapshot.");
    } finally {
      setLoadingPayrollAudit(false);
    }
  }, [createPageMaintenanceLog]);

  const handleLoadTransactionVariantAudit = useCallback(async () => {
    try {
      setLoadingTransactionVariantAudit(true);
      const result = await getTransactionVariantMaintenanceAudit();
      setTransactionVariantAudit(result);
      await createPageMaintenanceLog({
        actionType: "transaction_variant_audit",
        mode: "dry_run",
        modules: ["sales", "purchases", "returns", "stock_adjustment_and_logs", "inventory_logs"],
        summary: result?.summary || {},
        planSummary: result?.summary || {},
        affectedCollections: ["sales", "returns", "purchases", "stock_adjustments", "inventory_logs"],
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
        status: "success",
        note: "Audit variant lintas modul memetakan transaksi lama yang masih memakai field data historis tanpa membuat fallback baru ke master.",
      });
      showActionSuccess("Dry run variant lintas modul selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menjalankan audit variant lintas modul.");
    } finally {
      setLoadingTransactionVariantAudit(false);
    }
  }, [createPageMaintenanceLog]);

  const handleLoadTransactionSideEffectAudit = useCallback(async () => {
    try {
      setLoadingTransactionSideEffectAudit(true);
      const result = await getTransactionSideEffectRepairAudit();
      setTransactionSideEffectAudit(result);
      await createPageMaintenanceLog({
        actionType: "transaction_side_effect_audit",
        mode: "dry_run",
        modules: ["sales", "purchases", "returns", "finance", "inventory_logs"],
        summary: result?.summary || {},
        planSummary: result?.summary || {},
        affectedCollections: result?.affectedCollections || ["sales", "purchases", "returns", "incomes", "expenses", "inventory_logs"],
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
        status: "success",
        note: "Audit side-effect transaksi hanya membaca mismatch Sales/Purchases/Returns terhadap incomes/expenses/inventory_logs. Tidak ada stok, kas, atau transaksi yang diubah.",
      });
      showActionSuccess("Dry run side-effect transaksi selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menjalankan audit side-effect transaksi.");
    } finally {
      setLoadingTransactionSideEffectAudit(false);
    }
  }, [createPageMaintenanceLog]);

  const handleRunAllAudits = useCallback(async () => {
    try {
      await handleLoadDataQualityAudit({ showProblemPreview: false });
      if (MAINTENANCE_DATA_TOOLS_MODE === "safe_subset") {
        showActionSuccess("Audit aman selesai. Area repair berisiko tinggi tetap dinonaktifkan.");
        return;
      }
      await handleLoadHppReconcileAudit();
      await handleLoadMasterCodeAudit();
      await handleLoadStockAudit();
      await handleLoadLogSchemaAudit();
      await handleLoadHistoricalDataAudit();
      await handleLoadProductionMaintenanceAudit();
      await handleLoadPayrollAudit();
      await handleLoadTransactionVariantAudit();
      await handleLoadTransactionSideEffectAudit();
      showActionSuccess("Cek Semua selesai. Audit hanya membaca data bisnis; maintenance log hanya metadata admin.");
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Cek Semua berhenti karena ada audit yang gagal.");
    }
  }, [
    handleLoadDataQualityAudit,
    handleLoadHppReconcileAudit,
    handleLoadHistoricalDataAudit,
    handleLoadLogSchemaAudit,
    handleLoadMasterCodeAudit,
    handleLoadPayrollAudit,
    handleLoadProductionMaintenanceAudit,
    handleLoadStockAudit,
    handleLoadTransactionVariantAudit,
    handleLoadTransactionSideEffectAudit,
  ]);

  const masterCodeRows = useMemo(() => masterCodeAudit?.rows || [], [masterCodeAudit]);
  const masterCodeSummary = masterCodeAudit?.summary || {};

  const auditSourceMap = useMemo(() => ({
    dataQualityAudit,
    hppReconcileAudit,
    masterCodeAudit,
    stockAudit,
    logSchemaAudit,
    historicalDataAudit,
    maintenanceAudit,
    payrollAudit,
    transactionVariantAudit,
    transactionSideEffectAudit,
  }), [
    dataQualityAudit,
    hppReconcileAudit,
    masterCodeAudit,
    historicalDataAudit,
    logSchemaAudit,
    maintenanceAudit,
    payrollAudit,
    stockAudit,
    transactionVariantAudit,
    transactionSideEffectAudit,
  ]);

  const auditOverviewRows = useMemo(() => AUDIT_SUMMARY_AREAS.map((area) => {
    const audit = auditSourceMap[area.source];
    const summary = audit?.summary || {};
    const checkedRecords = summary.checkedRecords || summary.totalRecords || summary.totalChecked || summary.itemCount || 0;
    const issueCount = summary.issueCount
      || summary.totalIssueRecords
      || summary.totalIssues
      || summary.problemCount
      || summary.resetManualCount
      || summary.historicalCount
      || summary.warningCount
      || 0;
    const safeRepairCount = summary.safeRepairCount || summary.displayRepairCount || summary.executablePlanCount || summary.repairableCount || 0;

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
      impact: item.area === "Stok Umum"
        ? "Bisa memengaruhi Stock Management dan laporan stok."
        : item.area === "Produksi"
          ? "Bisa memengaruhi BOM/PO/Work Log/Payroll/HPP jika tidak dipilah."
          : item.area === "Inventory Log"
            ? "Bisa memengaruhi audit stok dan trace perubahan."
            : "Perlu dilihat detail sebelum reset atau repair.",
    })), [auditOverviewRows]);

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

  const loadingAutoDetect = loadingDataQualityAudit
    || loadingHppReconcileAudit
    || loadingStockAudit
    || loadingLogSchemaAudit
    || loadingHistoricalDataAudit
    || loadingMaintenanceAudit
    || loadingPayrollAudit
    || loadingTransactionVariantAudit
    || loadingTransactionSideEffectAudit;

  return {
    maintenanceAudit,
    setMaintenanceAudit,
    stockAudit,
    setStockAudit,
    logSchemaAudit,
    setLogSchemaAudit,
    historicalDataAudit,
    dataQualityAudit,
    hppReconcileAudit,
    setHppReconcileAudit,
    masterCodeAudit,
    setMasterCodeAudit,
    payrollAudit,
    setPayrollAudit,
    transactionVariantAudit,
    setTransactionVariantAudit,
    transactionSideEffectAudit,
    setTransactionSideEffectAudit,
    loadingMaintenanceAudit,
    loadingStockAudit,
    loadingLogSchemaAudit,
    loadingHistoricalDataAudit,
    loadingDataQualityAudit,
    loadingHppReconcileAudit,
    loadingMasterCodeAudit,
    loadingPayrollAudit,
    loadingTransactionVariantAudit,
    loadingTransactionSideEffectAudit,
    handleLoadMasterCodeAudit,
    handleLoadProductionMaintenanceAudit,
    handleLoadStockAudit,
    handleLoadLogSchemaAudit,
    handleLoadDataQualityAudit,
    handleLoadHppReconcileAudit,
    handleLoadHistoricalDataAudit,
    handleLoadPayrollAudit,
    handleLoadTransactionVariantAudit,
    handleLoadTransactionSideEffectAudit,
    handleRunAllAudits,
    masterCodeRows,
    masterCodeSummary,
    auditOverviewRows,
    auditIssueRows,
    dataQualityCategoryRows,
    autoBugSummary,
    loadingAutoDetect,
  };
};

export default useResetMaintenanceAudits;
