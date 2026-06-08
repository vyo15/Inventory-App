import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { showActionError, showActionInfo, showActionSuccess } from "../../utils/feedback/actionResultFeedback";
import { WarningOutlined } from "@ant-design/icons";
import {
  createMaintenanceLog,
  updateMaintenanceLogStatus,
} from "../../services/Maintenance/maintenanceLogService";
import {
  HPP_COST_RESET_OPTIONS,
  getHppCostBaselineSummary,
  getHppCostResetPreview,
  restoreHppCostBaseline,
  runHppCostReset,
} from "../../services/Maintenance/resetMaintenanceDataService";
import PageHeader from "../../components/Layout/Page/PageHeader";
import useAuth from "../../hooks/useAuth";
import useResetMaintenanceAudits from "./hooks/useResetMaintenanceAudits";
import useResetMaintenanceRepairs from "./hooks/useResetMaintenanceRepairs";
import useMasterDataExport from "./hooks/useMasterDataExport";
import {
  HPP_CONFIRM_KEYWORDS,
  TRANSACTION_SIDE_EFFECT_CONFIRM_KEYWORD,
  buildActorLabel,
  getCollectionLabels,
  mergeAuditNote,
  renderCompactTag,
  renderCompactText,
} from "./utils/resetMaintenanceUiHelpers";
import OfflineDevPanelErrorBoundary from "./components/OfflineDevPanelErrorBoundary";
import ResetStatusSummaryCard from "./components/ResetStatusSummaryCard";
import HppCostConfirmModal from "./components/HppCostConfirmModal";
import "./ResetMaintenanceData.css";

const { Text } = Typography;

// =====================================================
// SECTION: Lazy Maintenance Panels — AKTIF / PERFORMANCE
// Fungsi:
// - memecah panel maintenance yang berat agar route Reset tidak membawa seluruh UI audit/offline DB sekaligus;
// - tidak mengubah flow backup/restore, audit, repair, modal HPP, route, atau role guard.
// Status:
// - AKTIF.
// - GUARDED: jangan pindahkan business logic ke lazy wrapper; wrapper ini hanya code-splitting UI.
// =====================================================
const ResetAutoDetectPanel = lazy(() => import("./components/ResetAutoDetectPanel"));
const ResetDangerZonePanel = lazy(() => import("./components/ResetDangerZonePanel"));
const ResetExportPanel = lazy(() => import("./components/ResetExportPanel"));
const ResetSafeRepairPanel = lazy(() => import("./components/ResetSafeRepairPanel"));
const ResetUsageGuidePanel = lazy(() => import("./components/ResetUsageGuidePanel"));
const OfflineDatabaseCenter = lazy(() => import("./components/OfflineDatabaseCenter"));
const MaintenanceChecklistPanel = lazy(() => import("./components/MaintenanceChecklistPanel"));
const MaintenanceHistoryPanel = lazy(() => import("./components/MaintenanceHistoryPanel"));

const ResetPanelRuntime = (
  <Card
    size="small"
    loading
    className="reset-maintenance-lazy-panel"
  />
);

const renderLazyResetPanel = (children) => (
  <Suspense fallback={ResetPanelRuntime}>{children}</Suspense>
);

// -----------------------------------------------------------------------------
// Maintenance & Backup Center Page
// ACTIVE / FINAL:
// - Backup/restore, audit data, repair aman, dan export master menjadi flow utama.
// - Reset destructive lama tidak lagi tersedia di UI operasional.
// - Route final memakai /utilities/reset-maintenance-data. Route lama hanya redirect di AppRoutes agar bookmark lama tetap aman.
// -----------------------------------------------------------------------------

const ResetMaintenanceData = () => {
  const [hppConfirmForm] = Form.useForm();
  const [transactionSideEffectConfirmForm] = Form.useForm();
  const { authUser, profile } = useAuth();

  // ---------------------------------------------------------------------------
  // State maintenance aktif.
  // Halaman ini tidak lagi menyimpan state reset testing lama; aksi utama
  // dibatasi ke backup/restore, audit data, repair aman, dan export master.
  // ---------------------------------------------------------------------------
  const [loadingBaseline, setLoadingBaseline] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [transactionSideEffectConfirmOpen, setTransactionSideEffectConfirmOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // State audit trail maintenance/reset.
  // Log ini hanya mencatat metadata aksi admin, bukan sumber mutasi operasional.
  // ---------------------------------------------------------------------------
  const [actionNote, setActionNote] = useState("");
  const [stockReadModelAudit, setStockReadModelAudit] = useState(null);

  const {
    loadingMasterExportPreview,
    loadingMasterExport,
    masterExportPreview,
    lastMasterExport,
    handleLoadMasterExportPreview,
    handleDownloadMasterExport,
    handleDownloadMasterExportChecklist,
  } = useMasterDataExport();

  /*
  =====================================================
  SECTION: HPP Cost Testing UI state — GUARDED
  Fungsi:
  - Menyimpan mode, preview, baseline summary, loading, dan modal konfirmasi untuk reset/restore modal HPP.

  Dipakai oleh:
  - Kartu HPP Trial ringkas di halaman Reset Maintenance.

  Alasan perubahan:
  - Memisahkan reset modal/HPP dari reset transaksi existing agar user tidak salah memahami reset testing lama.

  Catatan cleanup:
  - Bisa dipindah ke subcomponent jika halaman Reset Maintenance semakin panjang.

  Risiko:
  - Jika state reset HPP digabung dengan reset transaksi, confirmation keyword dan preview bisa tertukar.
  =====================================================
  */
  const [hppCostResetMode, setHppCostResetMode] = useState("all_hpp_cost_sources");
  const [hppCostPreview, setHppCostPreview] = useState(null);
  const [hppCostBaselineSummary, setHppCostBaselineSummary] = useState(null);
  const [loadingHppCostPreview, setLoadingHppCostPreview] = useState(false);
  const [loadingRestoreHppCostBaseline, setLoadingRestoreHppCostBaseline] = useState(false);
  const [loadingRunHppCostReset, setLoadingRunHppCostReset] = useState(false);
  const [hppCostConfirmOpen, setHppCostConfirmOpen] = useState(false);
  const [hppCostConfirmAction, setHppCostConfirmAction] = useState("reset");

  const maintenanceActor = useMemo(
    () => buildActorLabel({ profile, authUser }),
    [authUser, profile],
  );

  const buildPageAuditNote = useCallback(
    (systemNote = "", overrideNote) => mergeAuditNote(systemNote, overrideNote ?? actionNote),
    [actionNote],
  );

  const createPageMaintenanceLog = useCallback(
    (payload, options = {}) => {
      const normalizedNote = buildPageAuditNote(payload.note, options.note);
      return createMaintenanceLog({
        ...payload,
        executedBy: maintenanceActor,
        ...(normalizedNote ? { note: normalizedNote } : {}),
      });
    },
    [buildPageAuditNote, maintenanceActor],
  );

  const {
    maintenanceAudit,
    setMaintenanceAudit,
    stockAudit,
    setStockAudit,
    logSchemaAudit,
    setLogSchemaAudit,
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
    loadingStockAudit,
    loadingDataQualityAudit,
    loadingHppReconcileAudit,
    loadingMasterCodeAudit,
    loadingTransactionVariantAudit,
    loadingTransactionSideEffectAudit,
    handleLoadMasterCodeAudit,
    handleLoadStockAudit,
    handleLoadDataQualityAudit,
    handleLoadHppReconcileAudit,
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
  } = useResetMaintenanceAudits({ createPageMaintenanceLog });

  const refreshAfterSafeRepair = useCallback(async () => {
    // Setiap handler repair sudah memuat ulang audit area terkait.
    // Hook repair tetap menerima callback ini agar tidak ada wiring undefined
    // tanpa menjalankan ulang semua audit dan membuat log audit berlebih.
  }, []);

  const {
    loadingMasterCodeRepair,
    loadingMaintenanceRepair,
    loadingStockRepair,
    loadingLogSchemaRepair,
    loadingHppReconcileRepair,
    loadingPayrollRepair,
    loadingTransactionVariantRepair,
    loadingTransactionSideEffectRepair,
    loadingStockReadModelAudit,
    loadingStockReadModelRepair,
    loadingStockReadModelRestockBackfill,
    loadingStockReadModelCleanup,
    handleRepairMasterCodeAudit,
    handleRepairProductionMaintenance,
    handleRepairStockAudit,
    handleRepairLogSchema,
    handleRepairHppReconcileAudit,
    handleRepairPayrollAudit,
    handleRepairTransactionVariantAudit,
    handleRepairTransactionSideEffects,
    handleLoadStockReadModelAudit,
    handleRepairStockReadModelAudit,
    handleBackfillStockReadModelRestockMetadata,
    handleCleanupStockReadModelOrphans,
  } = useResetMaintenanceRepairs({
    createPageMaintenanceLog,
    loadPreview: refreshAfterSafeRepair,
    authUser,
    profile,
    maintenanceActor,
    setMasterCodeAudit,
    setMaintenanceAudit,
    setStockAudit,
    setLogSchemaAudit,
    setHppReconcileAudit,
    setPayrollAudit,
    setTransactionVariantAudit,
    setTransactionSideEffectAudit,
    setStockReadModelAudit,
  });

  const transactionSideEffectSummary = transactionSideEffectAudit?.summary || {};
  const transactionSideEffectRows = transactionSideEffectAudit?.rows || [];

  const handleSyncStocks = useCallback(async () => {
    try {
      setLoadingSync(true);
      await handleRepairStockAudit();
    } finally {
      setLoadingSync(false);
    }
  }, [handleRepairStockAudit]);


  const loadHppCostBaselineSummary = useCallback(async () => {
    try {
      const result = await getHppCostBaselineSummary();
      setHppCostBaselineSummary(result);
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal memuat baseline modal/HPP.");
    }
  }, []);

  useEffect(() => {
    loadHppCostBaselineSummary();
  }, [loadHppCostBaselineSummary]);

  const loadHppCostPreview = useCallback(async (showSuccessMessage = false, resetModeOverride = "") => {
    const modeToPreview = resetModeOverride || hppCostResetMode;

    try {
      setLoadingHppCostPreview(true);
      const result = await getHppCostResetPreview({ resetMode: modeToPreview });
      setHppCostPreview(result);
      if (resetModeOverride && resetModeOverride !== hppCostResetMode) {
        setHppCostResetMode(resetModeOverride);
      }
      if (showSuccessMessage) {
        showActionSuccess("Preview reset modal/HPP berhasil dimuat.");
      }
      return result;
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal memuat preview reset modal/HPP.");
      return null;
    } finally {
      setLoadingHppCostPreview(false);
    }
  }, [hppCostResetMode]);

  useEffect(() => {
    setHppCostPreview((currentPreview) => (
      currentPreview?.resetMode === hppCostResetMode ? currentPreview : null
    ));
  }, [hppCostResetMode]);

  const openHppCostResetAllConfirmation = async () => {
    const resetAllMode = "all_hpp_cost_sources";
    const previewToUse = hppCostPreview?.resetMode === resetAllMode
      ? hppCostPreview
      : await loadHppCostPreview(true, resetAllMode);

    if (!previewToUse) return;

    if (previewToUse.isClientBatchSafe === false) {
      showActionError(`Reset semua diblokir karena estimasi ${previewToUse.estimatedWriteOperations} operasi melebihi batas aman ${previewToUse.safeClientLimit}.`);
      return;
    }

    setHppCostResetMode(resetAllMode);
    setHppCostPreview(previewToUse);
    setHppCostConfirmAction("reset");
    hppConfirmForm.setFieldsValue({ confirmationText: "", actionNote });
    setHppCostConfirmOpen(true);
  };

  const handleHppCostConfirmAction = async () => {
    const actionType = hppCostConfirmAction;
    const expectedKeyword = HPP_CONFIRM_KEYWORDS[actionType];
    let logId = "";
    let actionCompleted = false;

    try {
      const values = await hppConfirmForm.validateFields();
      if ((values.confirmationText || "").trim().toUpperCase() !== expectedKeyword) {
        showActionError(`Ketik "${expectedKeyword}" untuk konfirmasi.`);
        return;
      }

      if (actionType === "reset") {
        if (!hppCostPreview || hppCostPreview.resetMode !== hppCostResetMode) {
          showActionError("Preview reset modal/HPP wajib dimuat ulang sebelum reset dijalankan.");
          return;
        }

        setLoadingRunHppCostReset(true);
        logId = await createPageMaintenanceLog({
          actionType: "hpp_cost_reset",
          mode: hppCostResetMode,
          modules: ["hpp_cost_testing"],
          summary: {
            totalAffectedDocs: hppCostPreview?.totalAffectedDocs || 0,
            totalAffectedVariantRows: hppCostPreview?.totalAffectedVariantRows || 0,
          },
          planSummary: {
            estimatedWriteOperations: hppCostPreview?.estimatedWriteOperations || 0,
            safeClientLimit: hppCostPreview?.safeClientLimit || 0,
            isClientBatchSafe: hppCostPreview?.isClientBatchSafe !== false,
          },
          affectedCollections: getCollectionLabels(hppCostPreview?.affectedCollections),
          affectedCount: hppCostPreview?.estimatedWriteOperations || 0,
          dryRun: false,
          status: "started",
          note: "Reset modal/HPP dimulai setelah preview dan keyword RESET MODAL HPP. Aksi hanya menyentuh field cost/HPP master.",
        }, { note: values.actionNote });

        const result = await runHppCostReset({ resetMode: hppCostResetMode });
        actionCompleted = true;

        await updateMaintenanceLogStatus(logId, {
          status: "success",
          summary: {
            totalAffectedDocs: result?.totalAffectedDocs || 0,
            totalAffectedVariantRows: result?.totalAffectedVariantRows || 0,
            totalWriteOperations: result?.totalWriteOperations || 0,
          },
          affectedCollections: getCollectionLabels(result?.affectedCollections),
          affectedCount: result?.totalWriteOperations || 0,
          note: mergeAuditNote("Reset modal/HPP berhasil. Tidak ada delete transaksi, stock mutation, inventory log, payroll, cash out, atau proses ulang Work Log.", values.actionNote),
        });

        showActionSuccess(result?.message || "Reset modal/HPP berhasil dijalankan.");
        setHppCostConfirmOpen(false);
        hppConfirmForm.resetFields();
        await loadHppCostPreview(false);
        await loadHppCostBaselineSummary();
          return;
      }

      setLoadingRestoreHppCostBaseline(true);
      logId = await createPageMaintenanceLog({
        actionType: "restore_hpp_cost_baseline",
        mode: "hpp_cost_baseline_restore",
        modules: ["hpp_cost_testing"],
        summary: { itemCount: hppCostBaselineSummary?.itemCount || 0 },
        affectedCollections: Object.keys(hppCostBaselineSummary?.collectionCounts || {}),
        affectedCount: hppCostBaselineSummary?.itemCount || 0,
        dryRun: false,
        status: "started",
        note: "Restore baseline modal/HPP dimulai setelah keyword RESTORE MODAL HPP. Aksi hanya restore field cost/HPP dari baseline.",
      }, { note: values.actionNote });

      const result = await restoreHppCostBaseline();
      actionCompleted = true;

      await updateMaintenanceLogStatus(logId, {
        status: "success",
        summary: { restoredCount: result?.restoredCount || 0, itemCount: result?.itemCount || 0 },
        affectedCollections: Object.keys(hppCostBaselineSummary?.collectionCounts || {}),
        affectedCount: result?.restoredCount || 0,
        note: mergeAuditNote("Restore baseline modal/HPP berhasil. Stok dan transaksi tidak disentuh.", values.actionNote),
      });

      showActionSuccess(result?.message || "Restore baseline modal/HPP berhasil.");
      setHppCostConfirmOpen(false);
      hppConfirmForm.resetFields();
      await loadHppCostPreview(false);
      await loadHppCostBaselineSummary();
    } catch (error) {
      console.error(error);
      if (error?.errorFields) return;

      if (logId && !actionCompleted) {
        try {
          await updateMaintenanceLogStatus(logId, {
            status: "failed",
            errorMessage: error?.message || "Aksi modal/HPP gagal sebelum batch selesai.",
            note: mergeAuditNote("Aksi modal/HPP gagal. Service melakukan preflight sebelum write agar tidak partial.", hppConfirmForm.getFieldValue("actionNote")),
          });
            } catch (auditError) {
          console.error(auditError);
          showActionInfo("Aksi modal/HPP gagal, dan update audit log gagal. Cek akses maintenance_logs.");
        }
      }

      showActionError(error?.message || "Gagal menjalankan aksi modal/HPP.");
    } finally {
      setLoadingRunHppCostReset(false);
      setLoadingRestoreHppCostBaseline(false);
    }
  };

  const openTransactionSideEffectRepairConfirmation = useCallback(() => {
    const planCount = transactionSideEffectAudit?.summary?.executablePlanCount || 0;

    if (!transactionSideEffectAudit) {
      showActionError("Jalankan Cek Side-Effect Transaksi dulu sebelum repair.");
      return;
    }

    if (planCount <= 0) {
      showActionInfo("Tidak ada kandidat repair side-effect transaksi dari audit terakhir.");
      return;
    }

    transactionSideEffectConfirmForm.setFieldsValue({ confirmationText: "", actionNote });
    setTransactionSideEffectConfirmOpen(true);
  }, [actionNote, transactionSideEffectAudit, transactionSideEffectConfirmForm]);

  const handleConfirmTransactionSideEffectRepair = useCallback(async () => {
    try {
      const values = await transactionSideEffectConfirmForm.validateFields();
      if ((values.confirmationText || "").trim().toUpperCase() !== TRANSACTION_SIDE_EFFECT_CONFIRM_KEYWORD) {
        showActionError(`Ketik "${TRANSACTION_SIDE_EFFECT_CONFIRM_KEYWORD}" untuk konfirmasi.`);
        return;
      }

      await handleRepairTransactionSideEffects({ actionNote: values.actionNote ?? actionNote });
      setTransactionSideEffectConfirmOpen(false);
      transactionSideEffectConfirmForm.resetFields();
    } catch (error) {
      if (error?.errorFields) return;
      console.error(error);
    }
  }, [actionNote, handleRepairTransactionSideEffects, transactionSideEffectConfirmForm]);

  const hppCostSelectedOption = useMemo(
    () => HPP_COST_RESET_OPTIONS.find((item) => item.value === hppCostResetMode),
    [hppCostResetMode],
  );

  const hppCostConfirmKeyword = HPP_CONFIRM_KEYWORDS[hppCostConfirmAction] || HPP_CONFIRM_KEYWORDS.reset;

  const resetWorkspaceTabs = [
    {
      key: "overview",
      label: "Ringkasan",
      children: (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <ResetStatusSummaryCard
            actionNote={actionNote}
            autoBugSummary={autoBugSummary}
            hppCostBaselineSummary={hppCostBaselineSummary}
            maintenanceActor={maintenanceActor}
            onActionNoteChange={setActionNote}
          />
          {renderLazyResetPanel(<ResetUsageGuidePanel />)}
        </Space>
      ),
    },
    {
      key: "backup-restore",
      label: "Backup & Restore",
      children: (
        <OfflineDevPanelErrorBoundary>
          {renderLazyResetPanel(<OfflineDatabaseCenter />)}
        </OfflineDevPanelErrorBoundary>
      ),
    },
    {
      key: "audit-data",
      label: `Audit Data${autoBugSummary.issueCount ? ` (${autoBugSummary.issueCount})` : ""}`,
      children: (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {renderLazyResetPanel(<ResetAutoDetectPanel
            autoBugSummary={autoBugSummary}
            loadingAutoDetect={loadingAutoDetect}
            loadingDataQualityAudit={loadingDataQualityAudit}
            loadingStockAudit={loadingStockAudit}
            loadingTransactionVariantAudit={loadingTransactionVariantAudit}
            onRunAllAudits={handleRunAllAudits}
            onLoadDataQualityAudit={handleLoadDataQualityAudit}
            onLoadStockAudit={handleLoadStockAudit}
            onLoadTransactionVariantAudit={handleLoadTransactionVariantAudit}
            auditOverviewRows={auditOverviewRows}
            auditIssueRows={auditIssueRows}
            dataQualityCategoryRows={dataQualityCategoryRows}
            renderCompactText={renderCompactText}
          />)}
        </Space>
      ),
    },
    {
      key: "safe-repair",
      label: "Repair Aman",
      children: renderLazyResetPanel(<ResetSafeRepairPanel
          loadingStockRepair={loadingStockRepair}
          onRepairStockAudit={handleRepairStockAudit}
          loadingHppReconcileAudit={loadingHppReconcileAudit}
          onLoadHppReconcileAudit={handleLoadHppReconcileAudit}
          loadingHppReconcileRepair={loadingHppReconcileRepair}
          onRepairHppReconcileAudit={handleRepairHppReconcileAudit}
          hppReconcileAudit={hppReconcileAudit}
          hppReconcileSummary={hppReconcileAudit?.summary || {}}
          hppReconcileRows={hppReconcileAudit?.rows || []}
          stockAudit={stockAudit}
          stockRepairSummary={stockAudit?.summary || {}}
          loadingLogSchemaRepair={loadingLogSchemaRepair}
          onRepairLogSchema={handleRepairLogSchema}
          logSchemaAudit={logSchemaAudit}
          logSchemaRepairSummary={logSchemaAudit?.summary || {}}
          loadingMaintenanceRepair={loadingMaintenanceRepair}
          onRepairProductionMaintenance={handleRepairProductionMaintenance}
          maintenanceAudit={maintenanceAudit}
          maintenanceRepairSummary={maintenanceAudit?.summary || {}}
          loadingPayrollRepair={loadingPayrollRepair}
          onRepairPayrollAudit={handleRepairPayrollAudit}
          payrollAudit={payrollAudit}
          payrollRepairSummary={payrollAudit?.summary || {}}
          loadingTransactionVariantRepair={loadingTransactionVariantRepair}
          onRepairTransactionVariantAudit={handleRepairTransactionVariantAudit}
          transactionVariantAudit={transactionVariantAudit}
          transactionVariantRepairSummary={transactionVariantAudit?.summary || {}}
          loadingTransactionSideEffectAudit={loadingTransactionSideEffectAudit}
          onLoadTransactionSideEffectAudit={handleLoadTransactionSideEffectAudit}
          loadingTransactionSideEffectRepair={loadingTransactionSideEffectRepair}
          onOpenTransactionSideEffectRepairConfirm={openTransactionSideEffectRepairConfirmation}
          transactionSideEffectAudit={transactionSideEffectAudit}
          transactionSideEffectSummary={transactionSideEffectSummary}
          transactionSideEffectRows={transactionSideEffectRows}
          loadingStockReadModelAudit={loadingStockReadModelAudit}
          onLoadStockReadModelAudit={handleLoadStockReadModelAudit}
          loadingStockReadModelRepair={loadingStockReadModelRepair}
          onRepairStockReadModelAudit={handleRepairStockReadModelAudit}
          loadingStockReadModelRestockBackfill={loadingStockReadModelRestockBackfill}
          onBackfillStockReadModelRestockMetadata={handleBackfillStockReadModelRestockMetadata}
          loadingStockReadModelCleanup={loadingStockReadModelCleanup}
          onCleanupStockReadModelOrphans={handleCleanupStockReadModelOrphans}
          stockReadModelAudit={stockReadModelAudit}
          stockReadModelSummary={stockReadModelAudit?.summary || {}}
          stockReadModelRows={stockReadModelAudit?.rows || []}
          loadingSync={loadingSync}
          onSyncStocks={handleSyncStocks}
          loadingMasterCodeAudit={loadingMasterCodeAudit}
          onLoadMasterCodeAudit={handleLoadMasterCodeAudit}
          loadingMasterCodeRepair={loadingMasterCodeRepair}
          onRepairMasterCodeAudit={handleRepairMasterCodeAudit}
          masterCodeSummary={masterCodeSummary}
          masterCodeAudit={masterCodeAudit}
          masterCodeRows={masterCodeRows}
          renderCompactText={renderCompactText}
          renderCompactTag={renderCompactTag}
        />),
    },
    {
      key: "data-tools",
      label: "Data Tools",
      children: (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {renderLazyResetPanel(<ResetExportPanel
            loadingMasterExportPreview={loadingMasterExportPreview}
            onLoadMasterExportPreview={handleLoadMasterExportPreview}
            loadingMasterExport={loadingMasterExport}
            onDownloadMasterExport={() => handleDownloadMasterExport(true)}
            onDownloadMasterExportChecklist={handleDownloadMasterExportChecklist}
            masterExportPreview={masterExportPreview}
            lastMasterExport={lastMasterExport}
          />)}
        </Space>
      ),
    },
    {
      key: "checklist",
      label: "Checklist",
      children: renderLazyResetPanel(<MaintenanceChecklistPanel />),
    },
    {
      key: "history",
      label: "Riwayat",
      children: renderLazyResetPanel(<MaintenanceHistoryPanel />),
    },
    {
      key: "reset-testing",
      label: "Reset Testing",
      children: renderLazyResetPanel(<ResetDangerZonePanel
        loadingAutoDetect={loadingAutoDetect}
        onRunAllAudits={handleRunAllAudits}
      />),
    },
  ];

  /* =====================================================
  SECTION: Reset Maintenance Renderer — GUARDED
  Fungsi:
  - Menampilkan panel maintenance, backup/restore, audit trail, repair aman, export master, dan reset testing nonaktif.

  Dipakai oleh:
  - Admin utility untuk backup/restore, audit data, repair aman, export master, dan dokumentasi reset testing nonaktif.

  Alasan perubahan:
  - Panel dibuat lebih ringkas tanpa membawa handler reset testing lama.

  Catatan cleanup:
  - Panel maintenance dapat dipecah menjadi subkomponen jika halaman utility makin panjang.

  Risiko:
  - Jangan mengaktifkan ulang reset testing tanpa desain guard baru, backup otomatis, preview, keyword, dan audit log.
  ===================================================== */
  return (
    <div className="page-container">
      <Card className="content-card">
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <PageHeader
            title="Maintenance & Backup Center"
            subtitle="Pusat backup, restore, audit data, repair aman, checklist operasional, dan reset testing terbatas."
          />

          <Alert
            type="warning"
            showIcon
            message="Backup dan audit menjadi langkah utama; reset hanya untuk testing/development."
            description="Mulai dari Backup & Restore, Audit Data, dan Repair Aman. Reset testing lama tetap nonaktif dan tidak menjalankan aksi destructive."
          />

          <div className="reset-maintenance-workspace reset-maintenance-workspace-flat">
            <div className="reset-maintenance-toolbar">
              <div className="reset-maintenance-toolbar-main">
                <Space size={8} wrap>
                  <Text strong>Maintenance Workspace</Text>
                  <Tag color="blue">Guarded</Tag>
                </Space>
                <Text type="secondary">
                  Backup dan audit menjadi flow utama. Reset testing hanya menampilkan status nonaktif.
                </Text>
              </div>
              <Space size={8} wrap className="reset-maintenance-toolbar-status">
                <Tag color={autoBugSummary.issueCount ? "orange" : "green"}>Issue: {autoBugSummary.issueCount || 0}</Tag>
                <Tag color={autoBugSummary.safeRepairCount ? "green" : "default"}>Repair: {autoBugSummary.safeRepairCount || 0}</Tag>
                <Tag color="purple">Checklist auto</Tag>
              </Space>
            </div>

            <Tabs
              className="reset-maintenance-tabs"
              defaultActiveKey="overview"
              items={resetWorkspaceTabs}
            />
          </div>

        </Space>
      </Card>

      <HppCostConfirmModal
        hppConfirmForm={hppConfirmForm}
        hppCostBaselineSummary={hppCostBaselineSummary}
        hppCostConfirmAction={hppCostConfirmAction}
        hppCostConfirmKeyword={hppCostConfirmKeyword}
        hppCostConfirmOpen={hppCostConfirmOpen}
        hppCostPreview={hppCostPreview}
        hppCostSelectedOption={hppCostSelectedOption}
        loadingRestoreHppCostBaseline={loadingRestoreHppCostBaseline}
        loadingRunHppCostReset={loadingRunHppCostReset}
        onCancel={() => {
          if (loadingRunHppCostReset || loadingRestoreHppCostBaseline) return;
          setHppCostConfirmOpen(false);
          hppConfirmForm.resetFields();
        }}
        onConfirm={handleHppCostConfirmAction}
      />


      <Modal
        open={transactionSideEffectConfirmOpen}
        title="Konfirmasi Repair Side-Effect Transaksi"
        onCancel={() => {
          if (loadingTransactionSideEffectRepair) return;
          setTransactionSideEffectConfirmOpen(false);
          transactionSideEffectConfirmForm.resetFields();
        }}
        onOk={handleConfirmTransactionSideEffectRepair}
        okText="Ya, Repair Transaksi"
        cancelText="Batal"
        okButtonProps={{
          danger: true,
          loading: loadingTransactionSideEffectRepair,
          icon: <WarningOutlined />,
        }}
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            message="Repair ini membuat side-effect transaksi yang hilang"
            description="Aksi hanya membuat dokumen incomes, expenses, atau inventory_logs yang benar-benar hilang dari Sales/Purchases/Returns aktif. Stok master, dokumen transaksi utama, payroll, HPP, dan reset data tidak diubah. Income/expense/log lama tidak dihapus."
          />

          <Row gutter={[12, 12]}>
            <Col xs={12}>
              <Card size="small">
                <Statistic title="Kandidat Repair" value={transactionSideEffectSummary.executablePlanCount || 0} />
              </Card>
            </Col>
            <Col xs={12}>
              <Card size="small">
                <Statistic title="Manual Review" value={transactionSideEffectSummary.manualReviewCount || 0} />
              </Card>
            </Col>
          </Row>

          <Alert
            type="info"
            showIcon
            message="Guard idempotent"
            description="Service melakukan audit ulang sebelum write dan memakai document ID deterministik untuk repair agar klik ulang tidak membuat side-effect dobel. Tetap jalankan audit ulang setelah repair."
          />

          <Form form={transactionSideEffectConfirmForm} layout="vertical">
            <Form.Item
              name="actionNote"
              label="Catatan percobaan"
              extra="Opsional. Jika diisi, catatan ini digabung ke field note audit tanpa menghapus note sistem."
            >
              <Input.TextArea rows={2} placeholder="Contoh: repair missing income/expense/log dari data trial Batch 18B" allowClear />
            </Form.Item>
            <Form.Item
              name="confirmationText"
              label={`Ketik "${TRANSACTION_SIDE_EFFECT_CONFIRM_KEYWORD}" untuk konfirmasi terakhir`}
              rules={[{ required: true, message: `Ketik "${TRANSACTION_SIDE_EFFECT_CONFIRM_KEYWORD}" untuk melanjutkan.` }]}
              extra="Aksi hanya berjalan jika keyword benar."
            >
              <Input placeholder={`Ketik ${TRANSACTION_SIDE_EFFECT_CONFIRM_KEYWORD} di sini`} allowClear autoFocus />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </div>
  );
};

export default ResetMaintenanceData;
