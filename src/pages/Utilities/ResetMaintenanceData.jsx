import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  FileSearchOutlined,
  ReloadOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  getProductionVariantMaintenanceAudit,
  repairProductionVariantMaintenance,
} from "../../services/Maintenance/productionVariantMaintenanceService";
import {
  getInventoryLogSchemaAudit,
  getInventoryStockMaintenanceAudit,
  repairInventoryLogSchema,
  repairInventoryStockMaintenance,
} from "../../services/Maintenance/inventoryMaintenanceService";
import {
  createMaintenanceLog,
  updateMaintenanceLogStatus,
} from "../../services/Maintenance/maintenanceLogService";
import { getLegacyDataMaintenanceAudit } from "../../services/Maintenance/legacyDataMaintenanceService";
import { getDataQualityAudit } from "../../services/Maintenance/dataQualityAuditService";
import {
  getMasterCodeMaintenanceAudit,
  repairMasterCodeMaintenance,
} from "../../services/Maintenance/masterCodeMaintenanceService";
import {
  getPayrollSnapshotMaintenanceAudit,
  repairPayrollSnapshotMaintenance,
} from "../../services/Maintenance/payrollMaintenanceService";
import {
  getTransactionVariantMaintenanceAudit,
  repairTransactionVariantMaintenance,
} from "../../services/Maintenance/transactionVariantMaintenanceService";
import {
  DEFAULT_RESET_MODULES,
  FULL_TESTING_RESET_HPP_MODE,
  HPP_COST_RESET_OPTIONS,
  RESET_ALL_TESTING_MODULES,
  buildMasterDataExportPayload,
  getMasterDataExportPreview,
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
import ResetAutoDetectPanel from "./components/ResetAutoDetectPanel";
import ResetPreviewPanel from "./components/ResetPreviewPanel";
import ResetSafeRepairPanel from "./components/ResetSafeRepairPanel";
import ResetUsageGuidePanel from "./components/ResetUsageGuidePanel";

const { Paragraph, Text } = Typography;

// -----------------------------------------------------------------------------
// Reset & Maintenance Data Page
// ACTIVE / FINAL:
// - Reset Data masih memakai service utility lama yang sudah ada.
// - Maintenance Data memakai service baru terpisah agar audit/repair tidak
//   bercampur dengan flow operasional produksi aktif.
// - Route final memakai /utilities/reset-maintenance-data. Route lama hanya redirect di AppRoutes agar bookmark lama tetap aman.
// -----------------------------------------------------------------------------

const RESET_MODE_LABELS = {
  transaction_only: "Reset Transaksi",
  reset_and_zero_stock: "Reset + Nolkan Semua Stok",
  reset_and_restore_baseline: "Reset + Baseline Testing",
};

const HPP_CONFIRM_KEYWORDS = {
  reset: "RESET MODAL HPP",
  restore: "RESTORE MODAL HPP",
};

const RESET_CONFIRM_KEYWORDS = {
  standard: "RESET",
  full_testing_reset: "RESET SEMUA",
};

const formatMaintenanceDate = (value) => {
  if (!value) return "-";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID");
};

const MAINTENANCE_CATEGORY_META = {
  ok: { label: "Sesuai", color: "green" },
  safe_repair: { label: "Aman Diperbaiki", color: "blue" },
  display_repair: { label: "Display/Snapshot", color: "purple" },
  manual: { label: "Butuh Reset/Manual", color: "red" },
  legacy: { label: "Data Lama/Transisi", color: "orange" },
  scoped_reset: { label: "Aman Reset Terarah", color: "volcano" },
};

// -----------------------------------------------------------------------------
// IMS NOTE [AKTIF/CLEANUP CANDIDATE] — helper lokal untuk label collection.
// Fungsi blok: menjaga audit log reset/dev-test memakai bentuk label yang sama.
// Alasan cleanup: mengurangi map duplikatif tanpa membuat abstraction global.
// Hubungan flow: hanya metadata UI/audit, tidak mengubah target reset atau data.
// Behavior-preserving cleanup.
// -----------------------------------------------------------------------------
const getCollectionLabels = (collections = []) => (
  Array.isArray(collections) ? collections.map((item) => item.label || item.key).filter(Boolean) : []
);

/*
=====================================================
SECTION: Compact audit table render helpers — AKTIF
Fungsi:
- Memadatkan teks panjang di tabel audit/maintenance dengan ellipsis dan tooltip agar field penting tetap bisa dibaca.

Dipakai oleh:
- ResetMaintenanceData.jsx pada tabel audit produksi, stok, schema log, legacy, payroll, variant, preview reset, data test, dan audit trail.

Alasan perubahan:
- Mengurangi kebutuhan scroll.x besar tanpa menghilangkan informasi audit seperti issue, recommendation, resetScope, action, note, dan error.

Catatan cleanup:
- Bisa dipindah ke helper table global jika pola compact audit dipakai di halaman utility lain.

Risiko:
- Jika helper ini diubah sembarangan, teks audit panjang bisa terpotong tanpa tooltip atau kolom penting menjadi sulit dibaca.
=====================================================
*/
const renderCompactText = (value, maxWidth = 220, fallback = "-") => {
  const text = Array.isArray(value) ? value.filter(Boolean).join(", ") : value;

  if (text === undefined || text === null || text === "") {
    return fallback;
  }

  return (
    <Text
      style={{ display: "inline-block", maxWidth: "100%", width: maxWidth }}
      ellipsis={{ tooltip: String(text) }}
    >
      {String(text)}
    </Text>
  );
};

const renderCompactTag = (value, maxWidth = 160, fallback = "-") => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return (
    <Tag
      title={String(value)}
      style={{ maxWidth, overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "middle" }}
    >
      {String(value)}
    </Tag>
  );
};

const ACTION_RISK_META = {
  safe: { label: "Aman / Non-destructive", color: "green" },
  maintenance: { label: "Maintenance", color: "blue" },
  destructive: { label: "Destructive", color: "red" },
  guarded: { label: "Guarded", color: "orange" },
};

const AUDIT_SUMMARY_AREAS = [
  { key: "data_quality", label: "Data Quality", collection: "mixed", source: "dataQualityAudit" },
  { key: "master_code", label: "Kode Master", collection: "master", source: "masterCodeAudit" },
  { key: "stock", label: "Stok Umum", collection: "master stok", source: "stockAudit" },
  { key: "inventory_log", label: "Inventory Log", collection: "inventory_logs", source: "logSchemaAudit" },
  { key: "legacy", label: "Data Lama", collection: "legacy", source: "legacyDataAudit" },
  { key: "production", label: "Produksi", collection: "production_*", source: "maintenanceAudit" },
  { key: "payroll", label: "Payroll Snapshot", collection: "production_payrolls", source: "payrollAudit" },
  { key: "transaction_variant", label: "Variant Transaksi", collection: "sales/purchases/returns", source: "transactionVariantAudit" },
];

const buildActorLabel = ({ profile, firebaseUser } = {}) => (
  profile?.displayName
  || profile?.username
  || profile?.email
  || firebaseUser?.email
  || firebaseUser?.uid
  || "client-ui"
);

const mergeAuditNote = (systemNote = "", userNote = "") => {
  const cleanedSystemNote = String(systemNote || "").trim();
  const cleanedUserNote = String(userNote || "").trim();

  return [
    cleanedSystemNote,
    cleanedUserNote ? `Catatan percobaan: ${cleanedUserNote}` : "",
  ].filter(Boolean).join(" | ");
};

const ResetActionGuide = ({
  risk = "maintenance",
  description,
  preview = "Preview / informasi dampak tersedia sesuai tombol aksi.",
  scope = "Target dijelaskan di section ini.",
  impact = "Dampak ditampilkan melalui summary, tabel preview, atau message hasil.",
  confirmation = "Ikuti konfirmasi pada tombol/modal sebelum eksekusi.",
  audit = "Dicatat ke Riwayat Maintenance bila action membuat audit log.",
}) => {
  const meta = ACTION_RISK_META[risk] || ACTION_RISK_META.maintenance;

  return (
    <Alert
      type={risk === "destructive" ? "warning" : "info"}
      showIcon
      message={(
        <Space wrap>
          <span>{description}</span>
          <Tag color={meta.color}>{meta.label}</Tag>
        </Space>
      )}
      description={(
        <Space direction="vertical" size={2}>
          <Text><Text strong>Preview:</Text> {preview}</Text>
          <Text><Text strong>Target:</Text> {scope}</Text>
          <Text><Text strong>Dampak:</Text> {impact}</Text>
          <Text><Text strong>Konfirmasi:</Text> {confirmation}</Text>
          <Text><Text strong>Audit/Error Trail:</Text> {audit}</Text>
        </Space>
      )}
    />
  );
};

const resetStatisticValueStyle = {
  fontSize: "var(--ims-font-size-stat)",
  fontWeight: "var(--ims-font-weight-display)",
};

const ResetMaintenanceData = () => {
  const [confirmForm] = Form.useForm();
  const [hppConfirmForm] = Form.useForm();
  const { firebaseUser, profile } = useAuth();

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
  const [resetIntent, setResetIntent] = useState("standard");

  // ---------------------------------------------------------------------------
  // State maintenance produksi.
  // ACTIVE / FINAL tahap awal: fokus produksi varian lama.
  // Service maintenance hanya audit/repair field turunan, tidak posting stok ulang.
  // ---------------------------------------------------------------------------
  const [maintenanceAudit, setMaintenanceAudit] = useState(null);
  const [loadingMaintenanceAudit, setLoadingMaintenanceAudit] = useState(false);
  const [loadingMaintenanceRepair, setLoadingMaintenanceRepair] = useState(false);

  // ---------------------------------------------------------------------------
  // State maintenance stok umum dan schema inventory log.
  // ACTIVE / FINAL FOUNDATION: dry run tidak mengubah data, sedangkan repair
  // hanya menyentuh field turunan/display yang aman tanpa posting stok ulang.
  // ---------------------------------------------------------------------------
  const [stockAudit, setStockAudit] = useState(null);
  const [logSchemaAudit, setLogSchemaAudit] = useState(null);
  const [legacyDataAudit, setLegacyDataAudit] = useState(null);
  const [dataQualityAudit, setDataQualityAudit] = useState(null);
  const [loadingStockAudit, setLoadingStockAudit] = useState(false);
  const [loadingStockRepair, setLoadingStockRepair] = useState(false);
  const [loadingLogSchemaAudit, setLoadingLogSchemaAudit] = useState(false);
  const [loadingLogSchemaRepair, setLoadingLogSchemaRepair] = useState(false);
  const [loadingLegacyDataAudit, setLoadingLegacyDataAudit] = useState(false);
  const [loadingDataQualityAudit, setLoadingDataQualityAudit] = useState(false);
  const [masterCodeAudit, setMasterCodeAudit] = useState(null);
  const [loadingMasterCodeAudit, setLoadingMasterCodeAudit] = useState(false);
  const [loadingMasterCodeRepair, setLoadingMasterCodeRepair] = useState(false);

  // ---------------------------------------------------------------------------
  // State maintenance payroll snapshot dan varian lintas modul.
  // ACTIVE / TRANSITION TO FINAL:
  // - payroll snapshot stale wajib punya jalur audit + repair aman sendiri sebelum
  //   cleanup besar logic payroll dilakukan;
  // - variant lintas modul dipisah agar reset scoped tidak menjadi satu-satunya
  //   opsi untuk sales/returns/purchases/adjustment lama.
  // ---------------------------------------------------------------------------
  const [payrollAudit, setPayrollAudit] = useState(null);
  const [transactionVariantAudit, setTransactionVariantAudit] = useState(null);
  const [loadingPayrollAudit, setLoadingPayrollAudit] = useState(false);
  const [loadingPayrollRepair, setLoadingPayrollRepair] = useState(false);
  const [loadingTransactionVariantAudit, setLoadingTransactionVariantAudit] = useState(false);
  const [loadingTransactionVariantRepair, setLoadingTransactionVariantRepair] = useState(false);

  // ---------------------------------------------------------------------------
  // State audit trail maintenance/reset.
  // Log ini hanya mencatat metadata aksi admin, bukan sumber mutasi operasional.
  // ---------------------------------------------------------------------------
  const [actionNote, setActionNote] = useState("");

  /*
  =====================================================
  SECTION: Testing & Reset Center export state — AKTIF
  Fungsi:
  - Menyimpan jawaban wizard, preview/export data pokok, dan ringkasan export terakhir.

  Dipakai oleh:
  - Section Rekomendasi Sekarang, Wizard Keputusan, Export Data Pokok, dan Preview Dampak Reset.

  Alasan perubahan:
  - Halaman reset harus membantu owner/developer menjalankan audit, export, baseline, dan reset guarded tanpa membuka semua detail teknis di awal.

  Catatan cleanup:
  - Bisa dipindah ke subcomponent setelah flow stabil.

  Risiko:
  - Jangan hubungkan wizard ini langsung ke delete service; wizard hanya menyiapkan mode/module dan tetap wajib preview + confirmation RESET.
  =====================================================
  */
  const [loadingMasterExportPreview, setLoadingMasterExportPreview] = useState(false);
  const [loadingMasterExport, setLoadingMasterExport] = useState(false);
  const [masterExportPreview, setMasterExportPreview] = useState(null);
  const [lastMasterExport, setLastMasterExport] = useState(null);

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
  const moduleOptions = useMemo(
    () => [
      { label: "Penjualan + Income Sales", value: "sales" },
      { label: "Pembelian + Expense Purchases", value: "purchases" },
      { label: "Retur", value: "returns" },
      { label: "Production Planning / Planning Produksi", value: "production_planning_only" },
      { label: "Produksi (Lengkap)", value: "production" },
      { label: "Produksi + Inventory Log Produksi", value: "production_core_and_logs" },
      { label: "Payroll Produksi Saja", value: "production_payroll_only" },
      { label: "Produksi Data Lama Saja", value: "productions_legacy_only" },
      { label: "Kas & Biaya", value: "cash_and_expenses" },
      { label: "Penyesuaian + Log Adjustment", value: "stock_adjustment_and_logs" },
      { label: "Semua Inventory Log", value: "all_inventory_logs" },
      { label: "Pricing Log", value: "pricing_logs" },
    ],
    [],
  );

  const selectedModuleLabels = useMemo(() => {
    const labelMap = new Map(moduleOptions.map((item) => [item.value, item.label]));
    return selectedModules.map((value) => labelMap.get(value) || value);
  }, [moduleOptions, selectedModules]);


  const isFullTestingResetIntent = useMemo(() => (
    resetIntent === "full_testing_reset"
    && mode === "reset_and_zero_stock"
    && preview?.isFullTestingReset === true
  ), [mode, preview?.isFullTestingReset, resetIntent]);

  const resetConfirmKeyword = isFullTestingResetIntent
    ? RESET_CONFIRM_KEYWORDS.full_testing_reset
    : RESET_CONFIRM_KEYWORDS.standard;

  const resetBlockedReason = useMemo(() => {
    // -------------------------------------------------------------------------
    // Destructive reset UI preflight.
    // AKTIF / GUARDED: blokir konfirmasi sebelum service dipanggil jika baseline
    // belum siap atau jumlah write melebihi batas aman single-batch client.
    // Service tetap menjadi guard utama, blok UI ini hanya early warning admin.
    // -------------------------------------------------------------------------
    if (!selectedModules.length) {
      return "Pilih minimal 1 modul sebelum reset dijalankan.";
    }

    if (!preview) {
      return "Muat preview reset terbaru sebelum reset dijalankan.";
    }

    if (mode === "reset_and_restore_baseline" && !preview?.baselineSummary?.exists) {
      return "Baseline testing belum ada. Simpan baseline dulu sebelum menjalankan Reset + Baseline Testing.";
    }

    if (preview?.executionPlan?.isClientBatchSafe === false) {
      return `Reset diblokir karena estimasi ${preview.executionPlan.totalWriteOperations} operasi tulis melebihi batas aman ${preview.executionPlan.safeClientLimit} operasi dari browser. Perkecil scope modul agar tidak partial delete.`;
    }

    return "";
  }, [mode, preview, selectedModules.length]);

  const maintenanceActor = useMemo(
    () => buildActorLabel({ profile, firebaseUser }),
    [firebaseUser, profile],
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

  const downloadJsonPayload = useCallback((payload, filename) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const getTimestampForFilename = useCallback(() => {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  }, []);

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
      const filename = `ims-master-data-export-${getTimestampForFilename()}.json`;
      downloadJsonPayload(payload, filename);
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
  }, [downloadJsonPayload, getTimestampForFilename]);

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
      downloadJsonPayload(checklistPayload, `ims-master-data-export-${getTimestampForFilename()}.json`);
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
  }, [downloadJsonPayload, getTimestampForFilename]);

  const loadHppCostBaselineSummary = useCallback(async () => {
    try {
      const result = await getHppCostBaselineSummary();
      setHppCostBaselineSummary(result);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memuat baseline modal/HPP.");
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
        message.success("Preview reset modal/HPP berhasil dimuat.");
      }
      return result;
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memuat preview reset modal/HPP.");
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
      message.error(`Reset semua diblokir karena estimasi ${previewToUse.estimatedWriteOperations} operasi melebihi batas aman ${previewToUse.safeClientLimit}.`);
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
        message.error(`Ketik "${expectedKeyword}" untuk konfirmasi.`);
        return;
      }

      if (actionType === "reset") {
        if (!hppCostPreview || hppCostPreview.resetMode !== hppCostResetMode) {
          message.error("Preview reset modal/HPP wajib dimuat ulang sebelum reset dijalankan.");
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

        message.success(result?.message || "Reset modal/HPP berhasil dijalankan.");
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

      message.success(result?.message || "Restore baseline modal/HPP berhasil.");
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

      message.error(error?.message || "Gagal menjalankan aksi modal/HPP.");
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
        message.success(result?.isFullTestingReset ? "Preview reset semua testing berhasil dimuat." : "Preview reset berhasil dimuat.");
      }
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memuat preview reset.");
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
        message.error(`Reset semua diblokir karena estimasi ${result.executionPlan.totalWriteOperations} operasi melebihi batas aman ${result.executionPlan.safeClientLimit}.`);
        return;
      }

      confirmForm.setFieldsValue({ confirmationText: "", actionNote });
      setConfirmOpen(true);
      message.warning('Review preview lalu ketik "RESET SEMUA" untuk menjalankan reset gabungan.');
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyiapkan reset semua testing.");
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
        message.success("Preview data test berhasil dimuat.");
      }
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memuat preview data test.");
    } finally {
      setLoadingTestDataPreview(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Preview reset dibuat manual agar halaman Testing & Reset Center tidak langsung
  // melakukan full-scan Firestore saat dibuka. Saat mode/module berubah, preview
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
        message.success(result?.message || "Data test berhasil dibersihkan.");
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
        message.error(error?.message || "Audit log awal gagal dibuat. Hapus Data Test tidak dijalankan.");
      } else {
        message.error(error?.message || "Gagal menghapus data test.");
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
      message.success(result?.message || "Baseline stok saat ini berhasil disimpan.");
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyimpan baseline stok.");
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
      message.success(result?.message || "Sinkronisasi stok berhasil dijalankan.");
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal sinkronisasi stok.");
    } finally {
      setLoadingSync(false);
    }
  };

  const handleLoadMasterCodeAudit = async () => {
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
      message.success("Dry run kode master selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit kode master.");
    } finally {
      setLoadingMasterCodeAudit(false);
    }
  };

  const handleRepairMasterCodeAudit = async () => {
    try {
      setLoadingMasterCodeRepair(true);
      const result = await repairMasterCodeMaintenance();
      await createPageMaintenanceLog({
        actionType: "master_code_repair",
        mode: "repair",
        modules: ["master_data", "production_setup"],
        summary: result?.summary || {},
        affectedCollections: result?.affectedCollections || [],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
        note: "Normalisasi kode master tidak rename document ID dan tidak menyentuh transaksi/history.",
      });
      message.success(result?.message || "Normalisasi kode master selesai.");
      const nextAudit = await getMasterCodeMaintenanceAudit();
      setMasterCodeAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan normalisasi kode master.");
    } finally {
      setLoadingMasterCodeRepair(false);
    }
  };

  const handleLoadProductionMaintenanceAudit = async () => {
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
      message.success("Dry run audit produksi selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit maintenance produksi.");
    } finally {
      setLoadingMaintenanceAudit(false);
    }
  };

  const handleRepairProductionMaintenance = async () => {
    try {
      setLoadingMaintenanceRepair(true);
      const result = await repairProductionVariantMaintenance();
      await createPageMaintenanceLog({
        actionType: "production_variant_repair",
        mode: "repair",
        modules: ["production"],
        summary: result?.summary || {},
        affectedCollections: ["production_orders", "production_work_logs", "inventory_logs"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
      });
      message.success(result?.message || "Repair varian produksi selesai.");
      const nextAudit = await getProductionVariantMaintenanceAudit();
      setMaintenanceAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair varian produksi.");
    } finally {
      setLoadingMaintenanceRepair(false);
    }
  };

  const handleLoadStockAudit = async () => {
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
      message.success("Dry run stok umum selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit stok umum.");
    } finally {
      setLoadingStockAudit(false);
    }
  };

  const handleRepairStockAudit = async () => {
    try {
      setLoadingStockRepair(true);
      const result = await repairInventoryStockMaintenance();
      await createPageMaintenanceLog({
        actionType: "inventory_stock_repair",
        mode: "repair",
        modules: ["inventory"],
        summary: result?.summary || {},
        affectedCollections: ["raw_materials", "semi_finished_materials", "products"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
      });
      message.success(result?.message || "Repair stok umum selesai.");
      const nextAudit = await getInventoryStockMaintenanceAudit();
      setStockAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair stok umum.");
    } finally {
      setLoadingStockRepair(false);
    }
  };

  const handleLoadLogSchemaAudit = async () => {
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
      message.success("Dry run schema inventory log selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit schema inventory log.");
    } finally {
      setLoadingLogSchemaAudit(false);
    }
  };

  const handleRepairLogSchema = async () => {
    try {
      setLoadingLogSchemaRepair(true);
      const result = await repairInventoryLogSchema();
      await createPageMaintenanceLog({
        actionType: "inventory_log_schema_repair",
        mode: "repair",
        modules: ["inventory_logs"],
        summary: result?.summary || {},
        affectedCollections: ["inventory_logs"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
      });
      message.success(result?.message || "Repair schema inventory log selesai.");
      const nextAudit = await getInventoryLogSchemaAudit();
      setLogSchemaAudit(nextAudit);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair schema inventory log.");
    } finally {
      setLoadingLogSchemaRepair(false);
    }
  };

  const handleLoadDataQualityAudit = async ({ showProblemPreview = false } = {}) => {
    try {
      setLoadingDataQualityAudit(true);
      /*
      =====================================================
      SECTION: Data Quality Audit handler — LEGACY-COMPAT
      Fungsi:
      - Memanggil audit data lama secara read-only, menampilkan ringkasan area, dan mencatat audit log metadata.

      Dipakai oleh:
      - Tombol Cek Data Lama di panel Auto Detect Bug Data.

      Alasan perubahan:
      - Project masih development sehingga data lama cukup dipetakan untuk reset/recreate manual, bukan dimigrasi otomatis.

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
        modules: ["data_quality", "legacy_data"],
        summary: result?.summary || {},
        affectedCollections: (result?.categories || []).map((item) => item.collection || item.key).filter(Boolean),
        affectedCount: result?.summary?.checkedRecords || 0,
        dryRun: true,
        status: "success",
        note: "Data Quality Audit hanya membaca data legacy/testing dan menampilkan rekomendasi; tidak ada migration, backfill, delete, stok, kas, payroll, HPP, atau transaksi yang diubah.",
      });
      message.success(showProblemPreview ? "Preview data bermasalah berhasil dimuat. Tidak ada data yang diubah." : "Audit data lama selesai. Tidak ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan Data Quality Audit.");
    } finally {
      setLoadingDataQualityAudit(false);
    }
  };

  const handleLoadLegacyDataAudit = async () => {
    try {
      setLoadingLegacyDataAudit(true);
      const result = await getLegacyDataMaintenanceAudit();
      setLegacyDataAudit(result);
      await createPageMaintenanceLog({
        actionType: "legacy_data_audit",
        mode: "dry_run",
        modules: ["legacy_data", "cleanup_batch_3"],
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
        note: "Audit data lama hanya membaca data dan memberi rekomendasi reset/repair terarah.",
      });
      message.success("Dry run data lama selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit data lama.");
    } finally {
      setLoadingLegacyDataAudit(false);
    }
  };

  // -------------------------------------------------------------------------
  // Audit payroll snapshot stale.
  // ACTIVE / TRANSITION TO FINAL:
  // - dipakai sebelum cleanup besar payroll/Work Log;
  // - hanya membaca mismatch master Step vs snapshot Work Log;
  // - belum mengubah payroll final atau posting ulang stok.
  // -------------------------------------------------------------------------
  const handleLoadPayrollAudit = async () => {
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
      message.success("Dry run payroll/work log stale snapshot selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit payroll/work log stale snapshot.");
    } finally {
      setLoadingPayrollAudit(false);
    }
  };

  // -------------------------------------------------------------------------
  // Repair snapshot payroll stale.
  // ACTIVE / GUARDED:
  // - hanya berjalan untuk record yang sumber Step-nya jelas dan belum punya
  //   history payroll yang mengunci;
  // - dipakai agar cleanup fallback payroll bisa dilakukan bertahap dengan aman.
  // -------------------------------------------------------------------------
  const handleRepairPayrollAudit = async () => {
    try {
      setLoadingPayrollRepair(true);
      const result = await repairPayrollSnapshotMaintenance();
      await createPageMaintenanceLog({
        actionType: "payroll_snapshot_repair",
        mode: "repair",
        modules: ["production", "production_payroll_only"],
        summary: result?.summary || {},
        resultBuckets: {
          repaired: result?.updatedCount || 0,
          skipped: result?.skippedCount || 0,
        },
        affectedCollections: ["production_work_logs"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
        note: "Repair payroll/work log stale snapshot hanya berjalan bila master Step jelas dan belum ada history payroll yang mengunci.",
      });
      message.success(result?.message || "Repair snapshot payroll selesai.");
      const nextAudit = await getPayrollSnapshotMaintenanceAudit();
      setPayrollAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair payroll snapshot.");
    } finally {
      setLoadingPayrollRepair(false);
    }
  };

  // -------------------------------------------------------------------------
  // Audit variant lintas modul.
  // ACTIVE / TRANSITION:
  // - memetakan transaksi lama yang masih memakai field variant legacy;
  // - dipakai untuk memisahkan record aman repair vs reset terarah/manual review.
  // -------------------------------------------------------------------------
  const handleLoadTransactionVariantAudit = async () => {
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
        note: "Audit variant lintas modul memetakan transaksi lama yang masih memakai field legacy tanpa membuat fallback baru ke master.",
      });
      message.success("Dry run variant lintas modul selesai. Belum ada data yang diubah.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan audit variant lintas modul.");
    } finally {
      setLoadingTransactionVariantAudit(false);
    }
  };

  // -------------------------------------------------------------------------
  // Repair variant lintas modul.
  // ACTIVE / GUARDED:
  // - hanya melengkapi snapshot variant dari asal data lama yang sudah jelas;
  // - tidak mengubah qty, stok, atau kas final.
  // -------------------------------------------------------------------------
  const handleRepairTransactionVariantAudit = async () => {
    try {
      setLoadingTransactionVariantRepair(true);
      const result = await repairTransactionVariantMaintenance();
      await createPageMaintenanceLog({
        actionType: "transaction_variant_repair",
        mode: "repair",
        modules: ["sales", "purchases", "returns", "stock_adjustment_and_logs"],
        summary: result?.summary || {},
        resultBuckets: { repaired: result?.updatedCount || 0 },
        affectedCollections: ["sales", "returns", "purchases", "stock_adjustments"],
        affectedCount: result?.updatedCount || 0,
        dryRun: false,
        status: "success",
        note: "Repair variant lintas modul hanya mengisi snapshot/field turunan yang asal data lamanya jelas; qty dan kas tidak berubah.",
      });
      message.success(result?.message || "Repair variant lintas modul selesai.");
      const nextAudit = await getTransactionVariantMaintenanceAudit();
      setTransactionVariantAudit(nextAudit);
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair variant lintas modul.");
    } finally {
      setLoadingTransactionVariantRepair(false);
    }
  };

  const handleRunAllAudits = async () => {
    try {
      await handleLoadDataQualityAudit({ showProblemPreview: false });
      await handleLoadMasterCodeAudit();
      await handleLoadStockAudit();
      await handleLoadLogSchemaAudit();
      await handleLoadLegacyDataAudit();
      await handleLoadProductionMaintenanceAudit();
      await handleLoadPayrollAudit();
      await handleLoadTransactionVariantAudit();
      message.success("Cek Semua selesai. Audit hanya membaca data bisnis; maintenance log hanya metadata admin.");
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Cek Semua berhenti karena ada audit yang gagal.");
    }
  };

  const openResetConfirmation = async () => {
    if (resetBlockedReason) {
      message.error(resetBlockedReason);
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
        message.error(`Ketik "${resetConfirmKeyword}" untuk konfirmasi.`);
        return;
      }

      if (resetBlockedReason) {
        message.error(resetBlockedReason);
        return;
      }

      setLoadingRun(true);

      // -----------------------------------------------------------------------
      // Audit log pre-write sebelum reset destructive.
      // AKTIF / GUARDED: jika log awal gagal dibuat karena Firestore Rules,
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
        message.success(result?.message || "Reset data berhasil dijalankan.");
      } catch (auditError) {
        console.error(auditError);
        message.warning(
          "Reset data berhasil, tetapi update audit log akhir gagal. Cek koneksi/Firestore Rules untuk maintenance_logs; data reset tidak dianggap gagal.",
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
          message.warning("Reset gagal, dan update audit log gagal. Cek akses maintenance_logs di Firestore Rules.");
        }
      }

      if (!resetLogId) {
        message.error(error?.message || "Audit log awal gagal dibuat. Reset tidak dijalankan.");
      } else {
        message.error(error?.message || "Gagal menjalankan reset data uji.");
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

  const masterCodeRows = useMemo(() => masterCodeAudit?.rows || [], [masterCodeAudit]);
  const masterCodeSummary = masterCodeAudit?.summary || {};

  const auditSourceMap = useMemo(() => ({
    dataQualityAudit,
    masterCodeAudit,
    stockAudit,
    logSchemaAudit,
    legacyDataAudit,
    maintenanceAudit,
    payrollAudit,
    transactionVariantAudit,
  }), [
    dataQualityAudit,
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
    const checkedRecords = summary.checkedRecords || summary.totalRecords || summary.totalChecked || summary.itemCount || 0;
    const issueCount = summary.issueCount
      || summary.totalIssues
      || summary.problemCount
      || summary.resetManualCount
      || summary.legacyCount
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
    || loadingStockAudit
    || loadingLogSchemaAudit
    || loadingLegacyDataAudit
    || loadingMaintenanceAudit
    || loadingPayrollAudit
    || loadingTransactionVariantAudit;

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
            title="Testing & Reset Center"
            subtitle="Cockpit ringkas untuk auto detect bug data, repair turunan, baseline testing, dan reset guarded."
          />

          <Alert
            type="warning"
            showIcon
            message="Reset adalah langkah terakhir; mulai dari Auto Detect Bug dan Repair Turunan dulu."
            description="Halaman ini tidak lagi auto full-scan saat dibuka. Pilih skenario, jalankan audit/preview manual, lalu eksekusi hanya jika scope dan keyword sudah jelas."
          />

          <Card title="Status Ringkas" size="small" extra={<Tag color="green">Actor: {maintenanceActor}</Tag>}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Row gutter={[12, 12]}>
                <Col xs={12} md={6}>
                  <Statistic title="Bug/Data Issue" value={autoBugSummary.issueCount} />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic title="Repair Aman" value={autoBugSummary.safeRepairCount} />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic title="Preview Reset" value={preview ? preview.totalRecords || 0 : "Belum"} />
                </Col>
                <Col xs={12} md={6}>
                  <Statistic title="Baseline HPP" value={hppCostBaselineSummary?.exists ? "Ada" : "Belum"} />
                </Col>
              </Row>
              <Input.TextArea
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                rows={2}
                allowClear
                placeholder="Catatan trial opsional untuk audit log, contoh: cek ulang data lama setelah patch reset UI"
              />
            </Space>
          </Card>

          <Card title="Pilih Kebutuhan Testing" size="small" extra={<Tag color="blue">Flow utama</Tag>}>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12} xl={6}>
                <Card size="small" title="Pakai Data Lama">
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    <Text type="secondary">Untuk patch baru: cek bug data lama, lalu repair field turunan yang aman.</Text>
                    <Button block type="primary" icon={<FileSearchOutlined />} loading={loadingAutoDetect} onClick={handleRunAllAudits}>
                      Auto Detect Bug
                    </Button>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Card size="small" title="Testing dari Baseline">
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    <Text type="secondary">Untuk test berulang dari stok awal yang sama tanpa input ulang.</Text>
                    <Button block onClick={() => { setMode("reset_and_restore_baseline"); setSelectedModules([...DEFAULT_RESET_MODULES]); setResetIntent("standard"); message.info("Mode Reset + Baseline dipilih. Muat preview sebelum eksekusi."); }}>
                      Pilih Baseline Reset
                    </Button>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Card size="small" title="Mulai dari Nol">
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    <Text type="secondary">Untuk data development yang sudah kacau: transaksi/log, stok, dan modal/HPP testing dibersihkan dalam satu flow.</Text>
                    <Button block type="primary" danger icon={<DeleteOutlined />} loading={loadingPreview} onClick={openFullTestingResetConfirmation}>
                      Reset Semua Testing
                    </Button>
                    <Button block onClick={() => { setMode("reset_and_zero_stock"); setSelectedModules([...DEFAULT_RESET_MODULES]); setResetIntent("standard"); message.info("Mode Reset + Nolkan Stok dipilih. Muat preview sebelum eksekusi."); }}>
                      Pilih Reset Nol Saja
                    </Button>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Card size="small" title="HPP Trial">
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    <Text type="secondary">Khusus uji modal/HPP. Tidak menghapus transaksi, stok, payroll, atau work log.</Text>
                    <Button block icon={<EyeOutlined />} loading={loadingHppCostPreview} onClick={() => loadHppCostPreview(true, "all_hpp_cost_sources")}>
                      Preview Semua Modal/HPP
                    </Button>
                    <Button block danger icon={<WarningOutlined />} loading={loadingRunHppCostReset || loadingHppCostPreview} onClick={openHppCostResetAllConfirmation}>
                      Reset Semua Modal/HPP
                    </Button>
                  </Space>
                </Card>
              </Col>
            </Row>
          </Card>

          <ResetAutoDetectPanel
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
            renderCompactText={renderCompactText}
          />

          <ResetSafeRepairPanel
            loadingStockRepair={loadingStockRepair}
            onRepairStockAudit={handleRepairStockAudit}
            loadingLogSchemaRepair={loadingLogSchemaRepair}
            onRepairLogSchema={handleRepairLogSchema}
            loadingMaintenanceRepair={loadingMaintenanceRepair}
            onRepairProductionMaintenance={handleRepairProductionMaintenance}
            loadingPayrollRepair={loadingPayrollRepair}
            onRepairPayrollAudit={handleRepairPayrollAudit}
            loadingTransactionVariantRepair={loadingTransactionVariantRepair}
            onRepairTransactionVariantAudit={handleRepairTransactionVariantAudit}
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
          />

          <ResetPreviewPanel
            mode={mode}
            onModeChange={(value) => { setMode(value); setResetIntent("standard"); }}
            resetModeLabels={RESET_MODE_LABELS}
            resetModeOptions={RESET_MODE_OPTIONS}
            selectedModules={selectedModules}
            onSelectedModulesChange={(values) => { setSelectedModules(values); setResetIntent("standard"); }}
            moduleOptions={moduleOptions}
            preview={preview}
            previewRows={previewRows}
            loadingPreview={loadingPreview}
            onLoadPreview={() => loadPreview(true)}
            loadingBaseline={loadingBaseline}
            onSaveBaseline={handleSaveBaseline}
            onOpenResetConfirmation={openResetConfirmation}
            resetBlockedReason={resetBlockedReason}
            renderCompactText={renderCompactText}
          />

          <Row gutter={[12, 12]}>
            <Col xs={24}>
              <Card title="Data Test Seed & Export" size="small" extra={<Tag color="gold">Utility</Tag>}>
                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                  <Space wrap>
                    <Button icon={<EyeOutlined />} loading={loadingTestDataPreview} onClick={() => loadDevTestDataPreview(true)}>Preview Data Test</Button>
                    <Popconfirm
                      title="Hapus data test bermarker?"
                      description="Hanya dokumen isTestData/dev_test_seed/dev_seed. Data normal dan supplier protected tidak ikut."
                      okText="Ya, hapus"
                      cancelText="Batal"
                      onConfirm={handleDeleteDevTestData}
                    >
                      <Button danger icon={<DeleteOutlined />} loading={loadingDeleteTestData} disabled={!testDataPreview?.totalRecords}>Hapus Data Test</Button>
                    </Popconfirm>
                    <Button icon={<EyeOutlined />} loading={loadingMasterExportPreview} onClick={handleLoadMasterExportPreview}>Preview Export</Button>
                    <Button icon={<DownloadOutlined />} loading={loadingMasterExport} onClick={() => handleDownloadMasterExport(true)}>Export Master</Button>
                    <Button icon={<DownloadOutlined />} loading={loadingMasterExport} onClick={handleDownloadMasterExportChecklist}>Export Checklist</Button>
                  </Space>
                  <Row gutter={[8, 8]}>
                    <Col xs={8}><Statistic title="Data Test" value={testDataPreview?.totalRecords || 0} /></Col>
                    <Col xs={8}><Statistic title="Master" value={masterExportPreview?.summary?.totalRecords || lastMasterExport?.totalRecords || 0} /></Col>
                    <Col xs={8}><Statistic title="Warning" value={masterExportPreview?.summary?.warnings || lastMasterExport?.warnings?.length || 0} /></Col>
                  </Row>
                  {Boolean(testDataRows.length) && (
                    <Table
                      className="app-data-table"
                      size="small"
                      pagination={false}
                      dataSource={testDataRows}
                      columns={[
                        { title: "Collection", dataIndex: "name", key: "name", render: (value) => renderCompactText(value, 180) },
                        { title: "Jumlah", dataIndex: "count", key: "count", width: 90 },
                        { title: "Aksi", dataIndex: "action", key: "action", render: (value) => renderCompactText(value, 220) },
                      ]}
                      scroll={{ x: 520 }}
                    />
                  )}
                </Space>
              </Card>
            </Col>
          </Row>

          <ResetUsageGuidePanel />

        </Space>
      </Card>

      <Modal
        open={confirmOpen}
        title={isFullTestingResetIntent ? "Konfirmasi Reset Semua Testing" : "Konfirmasi Reset Data"}
        onCancel={() => {
          if (loadingRun) return;
          setConfirmOpen(false);
          confirmForm.resetFields();
        }}
        onOk={handleRunReset}
        okText="Ya, Jalankan Reset"
        cancelText="Batal"
        okButtonProps={{ danger: true, loading: loadingRun, icon: <ReloadOutlined /> }}
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Alert
            type="error"
            showIcon
            icon={<WarningOutlined />}
            message={isFullTestingResetIntent ? "Reset semua testing akan membersihkan data non-protected" : "Reset akan menghapus scope terpilih"}
            description={isFullTestingResetIntent
              ? "Aksi ini menghapus transaksi/log/planning/pricing, menolkan stok, dan menolkan modal/HPP allowlist. Protected master tidak dihapus."
              : "Pastikan preview sesuai. Reset tidak bisa dibatalkan dari halaman ini."}
          />

          <div>
            <Text strong>Mode aktif:</Text>
            <div style={{ marginTop: 6 }}>
              <Tag color="blue">{RESET_MODE_LABELS[mode]}</Tag>
            </div>
          </div>

          <div>
            <Text strong>Modul dipilih:</Text>
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {selectedModuleLabels.map((label) => (
                <Tag key={label} color="geekblue">{label}</Tag>
              ))}
            </div>
          </div>

          <div>
            <Text strong>Total data terdeteksi:</Text>
            <div style={{ marginTop: 4 }}>
              <Text>{preview?.totalRecords || 0} record</Text>
            </div>
          </div>

          {isFullTestingResetIntent && (
            <Alert
              type="warning"
              showIcon
              message="Termasuk stok dan modal/HPP"
              description={`Stok master/variant dinolkan. Field modal/HPP allowlist diproses untuk ${preview?.executionPlan?.hppCostOperations || 0} item master, digabung dengan update stok menjadi ${preview?.executionPlan?.mergedMasterUpdateOperations || 0} update master.`}
            />
          )}

          <Alert
            type="warning"
            showIcon
            message="Audit log dibuat sebelum reset berjalan"
            description="Jika audit log gagal, reset batal."
          />

          <Form form={confirmForm} layout="vertical">
            <Form.Item
              name="actionNote"
              label="Catatan percobaan"
              extra="Opsional. Jika diisi, catatan ini digabung ke field note audit tanpa menghapus note sistem."
            >
              <Input.TextArea rows={2} placeholder="Contoh: reset data trial PO/HPP tanggal hari ini" allowClear />
            </Form.Item>
            <Form.Item
              name="confirmationText"
              label={`Ketik "${resetConfirmKeyword}" untuk konfirmasi terakhir`}
              rules={[{ required: true, message: `Ketik "${resetConfirmKeyword}" untuk melanjutkan.` }]}
              extra={`Reset hanya berjalan jika kata ${resetConfirmKeyword} benar.`}
            >
              <Input placeholder={`Ketik ${resetConfirmKeyword} di sini`} allowClear autoFocus />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      <Modal
        open={hppCostConfirmOpen}
        title={hppCostConfirmAction === "restore" ? "Konfirmasi Restore Baseline Modal/HPP" : "Konfirmasi Reset Modal/HPP"}
        onCancel={() => {
          if (loadingRunHppCostReset || loadingRestoreHppCostBaseline) return;
          setHppCostConfirmOpen(false);
          hppConfirmForm.resetFields();
        }}
        onOk={handleHppCostConfirmAction}
        okText={hppCostConfirmAction === "restore" ? "Ya, Restore Baseline" : "Ya, Reset Modal/HPP"}
        cancelText="Batal"
        okButtonProps={{
          danger: true,
          loading: loadingRunHppCostReset || loadingRestoreHppCostBaseline,
          icon: hppCostConfirmAction === "restore" ? <ReloadOutlined /> : <WarningOutlined />,
        }}
      >
        <Space direction="vertical" size={14} style={{ width: "100%" }}>
          <Alert
            type="error"
            showIcon
            icon={<WarningOutlined />}
            message={hppCostConfirmAction === "restore" ? "Restore akan menimpa field modal/HPP master" : "Reset akan menolkan field modal/HPP master"}
            description="Tidak menghapus transaksi, mengubah stok, membuat payroll/cash, atau memproses ulang Work Log."
          />

          <div>
            <Text strong>Mode:</Text>
            <div style={{ marginTop: 6 }}>
              <Tag color={hppCostConfirmAction === "restore" ? "blue" : "volcano"}>
                {hppCostConfirmAction === "restore" ? "Restore Baseline Modal/HPP" : hppCostPreview?.label || hppCostSelectedOption?.label}
              </Tag>
            </div>
          </div>

          <Row gutter={[12, 12]}>
            <Col xs={12}>
              <Card size="small">
                <Statistic
                  title={hppCostConfirmAction === "restore" ? "Item Baseline" : "Dokumen Terdampak"}
                  value={hppCostConfirmAction === "restore" ? hppCostBaselineSummary?.itemCount || 0 : hppCostPreview?.totalAffectedDocs || 0}
                />
              </Card>
            </Col>
            <Col xs={12}>
              <Card size="small">
                <Statistic
                  title={hppCostConfirmAction === "restore" ? "Collection" : "Field/Varian"}
                  value={hppCostConfirmAction === "restore" ? Object.keys(hppCostBaselineSummary?.collectionCounts || {}).length : hppCostPreview?.totalAffectedVariantRows || 0}
                />
              </Card>
            </Col>
          </Row>

          {hppCostConfirmAction === "reset" && (
            <div>
              <Text strong>Field terdampak:</Text>
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[...(hppCostPreview?.fieldsToReset || []), ...(hppCostPreview?.variantFieldsToReset || []).map((fieldName) => `variants.${fieldName}`)].map((fieldName) => (
                  <Tag key={fieldName} color="orange">{fieldName}</Tag>
                ))}
              </div>
            </div>
          )}

          <Alert
            type="warning"
            showIcon
            message="Gunakan hanya untuk testing HPP"
            description="Tidak memperbaiki Work Log lama bernilai cost 0; ulangi flow testing untuk HPP baru."
          />

          <Form form={hppConfirmForm} layout="vertical">
            <Form.Item
              name="actionNote"
              label="Catatan percobaan"
              extra="Opsional. Jika diisi, catatan ini digabung ke field note audit tanpa menghapus note sistem."
            >
              <Input.TextArea rows={2} placeholder="Contoh: reset simulasi cost HPP setelah tes pembelian" allowClear />
            </Form.Item>
            <Form.Item
              name="confirmationText"
              label={`Ketik "${hppCostConfirmKeyword}" untuk konfirmasi terakhir`}
              rules={[{ required: true, message: `Ketik "${hppCostConfirmKeyword}" untuk melanjutkan.` }]}
              extra={`Aksi hanya berjalan jika keyword ${hppCostConfirmKeyword} benar.`}
            >
              <Input placeholder={`Ketik ${hppCostConfirmKeyword} di sini`} allowClear autoFocus />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </div>
  );
};

export default ResetMaintenanceData;
