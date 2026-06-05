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
  message,
} from "antd";
import { showActionError, showActionSuccess } from "../../utils/feedback/actionResultFeedback";
import { WarningOutlined } from "@ant-design/icons";
import {
  createMaintenanceLog,
  updateMaintenanceLogStatus,
} from "../../services/Maintenance/maintenanceLogService";
import {
  DEFAULT_RESET_MODULES,
  FULL_TESTING_RESET_HPP_MODE,
  HPP_COST_RESET_OPTIONS,
  RESET_ALL_TESTING_MODULES,
  RESET_MODE_OPTIONS,
  deleteDevTestData,
  getDevTestDataPreview,
  getFullTestingResetPreview,
  getHppCostBaselineSummary,
  getHppCostResetPreview,
  getResetPreview,
  restoreHppCostBaseline,
  runFullTestingReset,
  runHppCostReset,
  runResetDataTest,
  saveCurrentStockAsTestingBaseline,
  syncAllStocks,
} from "../../services/Maintenance/resetMaintenanceDataService";
import PageHeader from "../../components/Layout/Page/PageHeader";
import useAuth from "../../hooks/useAuth";
import useResetMaintenanceAudits from "./hooks/useResetMaintenanceAudits";
import useResetMaintenanceRepairs from "./hooks/useResetMaintenanceRepairs";
import useMasterDataExport from "./hooks/useMasterDataExport";
import {
  HPP_CONFIRM_KEYWORDS,
  RESET_MODULE_OPTIONS,
  RESET_MODE_LABELS,
  TRANSACTION_SIDE_EFFECT_CONFIRM_KEYWORD,
  getResetBlockedReason,
  getResetConfirmKeyword,
  getSelectedResetModuleLabels,
  isFullTestingResetPreviewIntent,
  buildActorLabel,
  getCollectionLabels,
  mergeAuditNote,
  renderCompactTag,
  renderCompactText,
} from "./utils/resetMaintenanceUiHelpers";
import OfflineDevPanelErrorBoundary from "./components/OfflineDevPanelErrorBoundary";
import ResetStatusSummaryCard from "./components/ResetStatusSummaryCard";
import ResetConfirmModal from "./components/ResetConfirmModal";
import HppCostConfirmModal from "./components/HppCostConfirmModal";
import "./ResetMaintenanceData.css";

const { Text, Title } = Typography;

// =====================================================
// SECTION: Lazy Maintenance Panels — AKTIF / PERFORMANCE
// Fungsi:
// - memecah panel maintenance yang berat agar route Reset tidak membawa seluruh UI audit/offline DB sekaligus;
// - tidak mengubah flow reset, keyword destructive, service call, route, atau role guard.
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
// - Reset Data masih memakai service utility lama yang sudah ada.
// - Maintenance Data memakai service baru terpisah agar audit/repair tidak
//   bercampur dengan flow operasional produksi aktif.
// - Route final memakai /utilities/reset-maintenance-data. Route lama hanya redirect di AppRoutes agar bookmark lama tetap aman.
// -----------------------------------------------------------------------------

const ResetMaintenanceData = () => {
  const [confirmForm] = Form.useForm();
  const [hppConfirmForm] = Form.useForm();
  const [transactionSideEffectConfirmForm] = Form.useForm();
  const { authSessionUser, profile } = useAuth();

  // ---------------------------------------------------------------------------
  // State reset data.
  // Bagian ini tetap kompatibel dengan utility reset lama, tetapi judul UI
  // dirapikan agar user membedakan reset destructive vs maintenance non-delete.
  // ---------------------------------------------------------------------------
  const [mode, setMode] = useState("transaction_only");
  const [selectedModules, setSelectedModules] = useState([...DEFAULT_RESET_MODULES]);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [testDataPreview, setTestDataPreview] = useState(null);
  const [loadingTestDataPreview, setLoadingTestDataPreview] = useState(false);
  const [loadingDeleteTestData, setLoadingDeleteTestData] = useState(false);
  const [loadingBaseline, setLoadingBaseline] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [transactionSideEffectConfirmOpen, setTransactionSideEffectConfirmOpen] = useState(false);
  const [resetIntent, setResetIntent] = useState("standard");

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
  - Memisahkan reset modal/HPP dari reset transaksi existing agar user tidak salah menjalankan reset destructive.

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

  /*
  =====================================================
  SECTION: Reset module options — GUARDED
  Fungsi:
  - Menampilkan pilihan module reset yang diteruskan ke resetMaintenanceDataService.

  Dipakai oleh:
  - Preview reset, modal confirmation, audit log, dan eksekusi reset maintenance.

  Alasan perubahan:
  - Menambahkan opsi Production Planning Only yang hanya menargetkan production_plans.

  Catatan cleanup:
  - belum ada.

  Risiko:
  - Value UI harus sama dengan module service; mismatch membuat preview/reset ditolak guard service.
  =====================================================
  */
  const moduleOptions = RESET_MODULE_OPTIONS;

  const selectedModuleLabels = useMemo(
    () => getSelectedResetModuleLabels(selectedModules, moduleOptions),
    [moduleOptions, selectedModules],
  );

  const isFullTestingResetIntent = useMemo(() => isFullTestingResetPreviewIntent({
    resetIntent,
    mode,
    preview,
  }), [mode, preview, resetIntent]);

  const resetConfirmKeyword = getResetConfirmKeyword(isFullTestingResetIntent);

  const resetBlockedReason = useMemo(() => getResetBlockedReason({
    selectedModules,
    preview,
    mode,
  }), [mode, preview, selectedModules]);

  const maintenanceActor = useMemo(
    () => buildActorLabel({ profile, authSessionUser }),
    [authSessionUser, profile],
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
          message.warning("Aksi modal/HPP gagal, dan update audit log gagal. Cek akses maintenance_logs.");
        }
      }

      showActionError(error?.message || "Gagal menjalankan aksi modal/HPP.");
    } finally {
      setLoadingRunHppCostReset(false);
      setLoadingRestoreHppCostBaseline(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Helper preview dipisah agar bisa dipakai oleh tombol manual dan auto-refresh.
  // ---------------------------------------------------------------------------
  const loadPreview = useCallback(async (showSuccessMessage = false) => {
    try {
      setLoadingPreview(true);
      const result = resetIntent === "full_testing_reset"
        ? await getFullTestingResetPreview()
        : await getResetPreview({
          resetMode: mode,
          modules: selectedModules,
        });
      setPreview(result);
      if (result?.hppCostPreview) {
        setHppCostPreview(result.hppCostPreview);
        setHppCostResetMode(FULL_TESTING_RESET_HPP_MODE);
      }
      if (showSuccessMessage) {
        showActionSuccess(result?.isFullTestingReset ? "Preview reset semua testing berhasil dimuat." : "Preview reset berhasil dimuat.");
      }
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal memuat preview reset.");
    } finally {
      setLoadingPreview(false);
    }
  }, [mode, resetIntent, selectedModules]);

  const openFullTestingResetConfirmation = useCallback(async () => {
    try {
      setLoadingPreview(true);
      const result = await getFullTestingResetPreview();

      setMode("reset_and_zero_stock");
      setSelectedModules([...RESET_ALL_TESTING_MODULES]);
      setResetIntent("full_testing_reset");
      setPreview(result);
      setHppCostPreview(result.hppCostPreview || null);
      setHppCostResetMode(FULL_TESTING_RESET_HPP_MODE);

      if (result?.executionPlan?.isClientBatchSafe === false) {
        showActionError(`Reset semua diblokir karena estimasi ${result.executionPlan.totalWriteOperations} operasi melebihi batas aman ${result.executionPlan.safeClientLimit}.`);
        return;
      }

      confirmForm.setFieldsValue({ confirmationText: "", actionNote });
      setConfirmOpen(true);
      message.warning('Review preview lalu ketik "RESET SEMUA" untuk menjalankan reset gabungan.');
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menyiapkan reset semua testing.");
    } finally {
      setLoadingPreview(false);
    }
  }, [actionNote, confirmForm]);

  // ---------------------------------------------------------------------------
  // Preview data test bermarker.
  // ACTIVE / DEV TOOL: hanya membaca dokumen dengan marker dev_test_seed, bukan
  // data normal dan bukan master Supplier. Dipakai agar development/testing bisa
  // dibersihkan tanpa merusak master penting.
  // ---------------------------------------------------------------------------
  const loadDevTestDataPreview = useCallback(async (showSuccessMessage = false) => {
    try {
      setLoadingTestDataPreview(true);
      const result = await getDevTestDataPreview();
      setTestDataPreview(result);
      if (showSuccessMessage) {
        showActionSuccess("Preview data test berhasil dimuat.");
      }
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal memuat preview data test.");
    } finally {
      setLoadingTestDataPreview(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Preview reset dibuat manual agar halaman Testing & Reset Center tidak langsung
  // melakukan full-scan SQLite saat dibuka. Saat mode/module berubah, preview
  // lama dihapus supaya destructive reset wajib memakai preview yang fresh.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (resetIntent !== "full_testing_reset") {
      setPreview(null);
    }
  }, [mode, resetIntent, selectedModules]);

  const handleDeleteDevTestData = async () => {
    let testCleanupLogId = "";
    let cleanupCompleted = false;

    try {
      setLoadingDeleteTestData(true);

      // -----------------------------------------------------------------------
      // Audit log pre-write untuk Hapus Data Test.
      // AKTIF / GUARDED: walau hanya data bermarker dev_test_seed, aksi ini tetap
      // destructive sehingga log awal wajib berhasil sebelum batch delete jalan.
      // -----------------------------------------------------------------------
      testCleanupLogId = await createPageMaintenanceLog({
        actionType: "delete_dev_test_data",
        mode: "test_data_cleanup",
        modules: ["dev_test_seed"],
        summary: { plannedDeleteRecords: testDataPreview?.totalRecords || 0 },
        affectedCollections: getCollectionLabels(testDataPreview?.collections),
        affectedCount: testDataPreview?.totalRecords || 0,
        dryRun: false,
        status: "started",
        note: "Hapus Data Test dimulai. Log dibuat sebelum delete agar cleanup bermarker tetap punya audit trail.",
      });

      const result = await deleteDevTestData();
      cleanupCompleted = true;

      try {
        await updateMaintenanceLogStatus(testCleanupLogId, {
          status: "success",
          summary: { totalDeletedRecords: result?.totalDeletedRecords || 0 },
          affectedCollections: getCollectionLabels(result?.deletedCollections),
          affectedCount: result?.totalDeletedRecords || 0,
          note: buildPageAuditNote("Hapus Data Test hanya menghapus dokumen bermarker isTestData/dev_test_seed/dev_seed. Supplier protected tidak ikut target default."),
        });
        showActionSuccess(result?.message || "Data test berhasil dibersihkan.");
      } catch (auditError) {
        console.error(auditError);
        message.warning("Data test berhasil dibersihkan, tetapi update audit log akhir gagal. Cek akses maintenance_logs.");
      }

      await loadDevTestDataPreview(false);
      await loadPreview(false);
    } catch (error) {
      console.error(error);

      if (testCleanupLogId && !cleanupCompleted) {
        try {
          await updateMaintenanceLogStatus(testCleanupLogId, {
            status: "failed",
            errorMessage: error?.message || "Hapus Data Test gagal sebelum batch delete selesai.",
            note: buildPageAuditNote("Hapus Data Test gagal. Service memakai single batch agar tidak partial delete."),
          });
            } catch (auditError) {
          console.error(auditError);
          message.warning("Hapus Data Test gagal, dan update audit log gagal. Cek akses maintenance_logs.");
        }
      }

      if (!testCleanupLogId) {
        showActionError(error?.message || "Audit log awal gagal dibuat. Hapus Data Test tidak dijalankan.");
      } else {
        showActionError(error?.message || "Gagal menghapus data test.");
      }
    } finally {
      setLoadingDeleteTestData(false);
    }
  };

  const handleSaveBaseline = async () => {
    try {
      setLoadingBaseline(true);
      const result = await saveCurrentStockAsTestingBaseline();
      await createPageMaintenanceLog({
        actionType: "save_stock_baseline",
        mode: "baseline",
        modules: ["inventory"],
        summary: { itemCount: result?.itemCount || 0 },
        affectedCollections: ["testing_baselines"],
        affectedCount: result?.itemCount || 0,
        dryRun: false,
        status: "success",
      });
      showActionSuccess(result?.message || "Baseline stok saat ini berhasil disimpan.");
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal menyimpan baseline stok.");
    } finally {
      setLoadingBaseline(false);
    }
  };

  const handleSyncStocks = async () => {
    try {
      setLoadingSync(true);
      const result = await syncAllStocks();
      await createPageMaintenanceLog({
        actionType: "sync_all_stocks",
        mode: "repair",
        modules: ["inventory"],
        summary: { syncedCount: result?.syncedCount || 0 },
        affectedCollections: ["raw_materials", "semi_finished_materials", "products"],
        affectedCount: result?.syncedCount || 0,
        dryRun: false,
        status: "success",
        note: "Sync stok umum hanya menyamakan field turunan, bukan posting stok ulang.",
      });
      showActionSuccess(result?.message || "Sinkronisasi stok berhasil dijalankan.");
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      showActionError(error?.message || "Gagal sinkronisasi stok.");
    } finally {
      setLoadingSync(false);
    }
  };

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
    handleLoadProductionMaintenanceAudit,
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
    loadPreview,
    authSessionUser,
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

  const transactionSideEffectSummary = useMemo(
    () => transactionSideEffectAudit?.summary || {},
    [transactionSideEffectAudit],
  );

  const transactionSideEffectRows = useMemo(
    () => transactionSideEffectAudit?.rows || [],
    [transactionSideEffectAudit],
  );

  const openTransactionSideEffectRepairConfirmation = useCallback(() => {
    const planCount = transactionSideEffectAudit?.summary?.executablePlanCount || 0;

    if (!transactionSideEffectAudit) {
      showActionError("Jalankan Cek Side-Effect Transaksi dulu sebelum repair.");
      return;
    }

    if (planCount <= 0) {
      message.info("Tidak ada kandidat repair side-effect transaksi dari audit terakhir.");
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

  const openResetConfirmation = async () => {
    if (resetBlockedReason) {
      showActionError(resetBlockedReason);
      return;
    }

    confirmForm.setFieldsValue({ confirmationText: "", actionNote });
    setConfirmOpen(true);
  };

  const handleRunReset = async () => {
    let resetLogId = "";
    let resetCompleted = false;

    try {
      const values = await confirmForm.validateFields();
      if ((values.confirmationText || "").trim().toUpperCase() !== resetConfirmKeyword) {
        showActionError(`Ketik "${resetConfirmKeyword}" untuk konfirmasi.`);
        return;
      }

      if (resetBlockedReason) {
        showActionError(resetBlockedReason);
        return;
      }

      setLoadingRun(true);

      // -----------------------------------------------------------------------
      // Audit log pre-write sebelum reset destructive.
      // AKTIF / GUARDED: jika log awal gagal dibuat karena SQLite Rules,
      // reset tidak dilanjutkan. Ini menjaga destructive action tetap tercatat.
      // -----------------------------------------------------------------------
      resetLogId = await createPageMaintenanceLog({
        actionType: isFullTestingResetIntent ? "reset_all_testing_data" : "reset_data",
        mode,
        modules: selectedModules,
        summary: {
          plannedDeleteRecords: preview?.totalRecords || 0,
          plannedStockOperations: preview?.executionPlan?.stockOperations || 0,
        },
        planSummary: preview?.executionPlan || {},
        affectedCollections: getCollectionLabels(preview?.collections),
        affectedCount: preview?.executionPlan?.totalWriteOperations || preview?.totalRecords || 0,
        dryRun: false,
        status: "started",
        note: isFullTestingResetIntent
          ? "Reset semua testing dimulai setelah preview dan konfirmasi RESET SEMUA. Transaksi/log/planning/pricing, stok, dan modal/HPP allowlist diproses dalam satu batch."
          : "Reset destructive dimulai setelah preview dan konfirmasi RESET. Log ini dibuat sebelum delete agar reset tidak berjalan tanpa audit.",
      }, { note: values.actionNote });

      const result = isFullTestingResetIntent
        ? await runFullTestingReset()
        : await runResetDataTest({
          resetMode: mode,
          modules: selectedModules,
        });
      resetCompleted = true;

      try {
        await updateMaintenanceLogStatus(resetLogId, {
          status: "success",
          summary: {
            totalDeletedRecords: result?.totalDeletedRecords || 0,
            totalWriteOperations: result?.totalWriteOperations || 0,
            stockResult: result?.stockResult || {},
            hppCostResult: result?.hppCostResult || null,
          },
          resultBuckets: {
            deleted: result?.totalDeletedRecords || 0,
            stockUpdated: result?.stockResult?.affectedItems || 0,
            hppCostUpdated: result?.hppCostResult?.affectedItems || 0,
          },
          affectedCollections: getCollectionLabels(result?.deletedCollections),
          affectedCount: result?.totalWriteOperations || result?.totalDeletedRecords || 0,
          note: mergeAuditNote(isFullTestingResetIntent
            ? "Reset semua testing berhasil. Delete transaksi/log dan update stok/modal/HPP allowlist dijalankan dalam satu batch aman dari client."
            : "Reset destructive berhasil. Delete transaksi dan update stok dijalankan dalam satu batch aman dari client.", values.actionNote),
        });
        showActionSuccess(result?.message || "Reset data berhasil dijalankan.");
      } catch (auditError) {
        console.error(auditError);
        message.warning(
          "Reset data berhasil, tetapi update audit log akhir gagal. Cek koneksi/SQLite Rules untuk maintenance_logs; data reset tidak dianggap gagal.",
        );
      }

      setConfirmOpen(false);
      confirmForm.resetFields();
      if (isFullTestingResetIntent) {
        setPreview(null);
        setHppCostPreview(null);
      } else {
        await loadPreview(false);
      }
      setResetIntent("standard");
      await loadDevTestDataPreview(false);
      await handleLoadProductionMaintenanceAudit();
    } catch (error) {
      console.error(error);
      if (error?.errorFields) return;

      if (resetLogId && !resetCompleted) {
        try {
          await updateMaintenanceLogStatus(resetLogId, {
            status: "failed",
            errorMessage: error?.message || "Reset gagal sebelum batch destructive selesai.",
            note: mergeAuditNote("Reset destructive gagal. Karena service memakai preflight + single batch, kegagalan sebelum commit tidak boleh menghasilkan partial delete.", confirmForm.getFieldValue("actionNote")),
          });
            } catch (auditError) {
          console.error(auditError);
          message.warning("Reset gagal, dan update audit log gagal. Cek akses maintenance_logs di SQLite Rules.");
        }
      }

      if (!resetLogId) {
        showActionError(error?.message || "Audit log awal gagal dibuat. Reset tidak dijalankan.");
      } else {
        showActionError(error?.message || "Gagal menjalankan reset data uji.");
      }
    } finally {
      setLoadingRun(false);
    }
  };

  const previewRows = useMemo(() => {
    if (!preview) return [];

    const deleteRows = (preview.collections || []).map((item) => ({
      key: item.targetKey || item.key,
      moduleLabel: item.moduleLabel,
      name: item.scopeLabel ? `${item.label} (${item.scopeLabel})` : item.label,
      count: item.count,
      action: item.action,
      status: "delete",
    }));

    const protectedRows = (preview.protectedCollections || []).map((item) => ({
      key: `protected::${item.key}`,
      moduleLabel: item.moduleLabel || "Master Dilindungi",
      name: item.label || item.name || item.key,
      count: item.count,
      action: item.reason || item.action || "Dilindungi dari reset default",
      status: "protected",
    }));

    return [...deleteRows, ...protectedRows];
  }, [preview]);

  const testDataRows = useMemo(() => (testDataPreview?.collections || []).map((item) => ({
    key: item.key,
    moduleLabel: item.moduleLabel,
    name: item.label || item.key,
    count: item.count,
    action: item.action,
    status: item.status,
  })), [testDataPreview]);

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
            preview={preview}
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
            loadingTestDataPreview={loadingTestDataPreview}
            onLoadTestDataPreview={() => loadDevTestDataPreview(true)}
            loadingDeleteTestData={loadingDeleteTestData}
            testDataPreview={testDataPreview}
            onDeleteDevTestData={handleDeleteDevTestData}
            loadingMasterExportPreview={loadingMasterExportPreview}
            onLoadMasterExportPreview={handleLoadMasterExportPreview}
            loadingMasterExport={loadingMasterExport}
            onDownloadMasterExport={() => handleDownloadMasterExport(true)}
            onDownloadMasterExportChecklist={handleDownloadMasterExportChecklist}
            masterExportPreview={masterExportPreview}
            lastMasterExport={lastMasterExport}
            testDataRows={testDataRows}
            renderCompactText={renderCompactText}
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
        legacyResetState={{
          loadingPreview,
          loadingBaseline,
          loadingHppCostPreview,
          previewRows,
        }}
        legacyResetActions={{
          openFullTestingResetConfirmation,
          openHppCostResetAllConfirmation,
          handleSaveBaseline,
          openResetConfirmation,
        }}
      />),
    },
  ];

  /* =====================================================
  SECTION: Reset Maintenance Renderer — GUARDED
  Fungsi:
  - Menampilkan panel maintenance, preview reset, data test, audit trail, dan modal konfirmasi RESET.

  Dipakai oleh:
  - Admin utility untuk dry run, repair aman, preview reset, dan reset destructive terbatas.

  Alasan perubahan:
  - Panel dibuat lebih ringkas tanpa mengurangi warning destructive, preview wajib, scope reset, protected data, atau confirmation keyword.

  Catatan cleanup:
  - Panel maintenance dapat dipecah menjadi subkomponen jika halaman utility makin panjang.

  Risiko:
  - Jangan mengubah reset scope, preview logic, confirmation keyword RESET, protected collection, atau audit log flow.
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
            description="Mulai dari Backup & Restore, Audit Data, dan Repair Aman. Reset destructive tetap wajib preview, keyword, dan scope jelas."
          />

          <Card
            size="small"
            className="reset-maintenance-workspace"
            title={(
              <Space size={10}>
                <span>Maintenance Workspace</span>
                <Tag color="blue">Guarded</Tag>
              </Space>
            )}
            extra={(
              <Space size={8} wrap>
                <Tag color={autoBugSummary.issueCount ? "orange" : "green"}>Issue: {autoBugSummary.issueCount || 0}</Tag>
                <Tag color={autoBugSummary.safeRepairCount ? "green" : "default"}>Repair: {autoBugSummary.safeRepairCount || 0}</Tag>
                <Tag color={preview ? "gold" : "default"}>Preview: {preview ? preview.totalRecords || 0 : "belum"}</Tag>
              </Space>
            )}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <div className="reset-maintenance-hero">
                <div>
                  <Text type="secondary">Maintenance SQLite offline</Text>
                  <Title level={4} style={{ margin: "2px 0 4px" }}>Backup dulu, audit data, lalu repair atau restore bila perlu</Title>
                  <Text type="secondary">
                    Tab dipisah agar user tidak bingung: Backup/restore dan audit menjadi flow utama; reset testing berada paling akhir dan nonaktif di mode SQLite penuh.
                  </Text>
                </div>
                <Space direction="vertical" size={4} align="end" className="reset-maintenance-hero-status">
                  <Tag color="purple">Checklist auto</Tag>
                  <Text type="secondary">Keyword destructive tetap wajib</Text>
                </Space>
              </div>

              <Tabs
                className="reset-maintenance-tabs"
                defaultActiveKey="overview"
                items={resetWorkspaceTabs}
              />
            </Space>
          </Card>

        </Space>
      </Card>

      <ResetConfirmModal
        confirmForm={confirmForm}
        confirmOpen={confirmOpen}
        isFullTestingResetIntent={isFullTestingResetIntent}
        loadingRun={loadingRun}
        mode={mode}
        onCancel={() => {
          if (loadingRun) return;
          setConfirmOpen(false);
          confirmForm.resetFields();
        }}
        onConfirm={handleRunReset}
        preview={preview}
        resetConfirmKeyword={resetConfirmKeyword}
        resetModeLabels={RESET_MODE_LABELS}
        selectedModuleLabels={selectedModuleLabels}
      />

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
