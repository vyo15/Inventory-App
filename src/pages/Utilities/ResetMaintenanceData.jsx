import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
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
  SaveOutlined,
  SyncOutlined,
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
  getLatestMaintenanceLogs,
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
  HPP_COST_RESET_OPTIONS,
  buildMasterDataExportPayload,
  getMasterDataExportPreview,
  RESET_MODE_OPTIONS,
  deleteDevTestData,
  getDevTestDataPreview,
  getHppCostBaselineSummary,
  getHppCostResetPreview,
  getResetPreview,
  restoreHppCostBaseline,
  runHppCostReset,
  runResetDataTest,
  saveCurrentHppCostBaseline,
  saveCurrentStockAsTestingBaseline,
  syncAllStocks,
} from "../../services/Maintenance/resetMaintenanceDataService";
import PageHeader from "../../components/Layout/Page/PageHeader";
import useAuth from "../../hooks/useAuth";

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
  const [dataQualityPreviewVisible, setDataQualityPreviewVisible] = useState(false);
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
  const [maintenanceLogs, setMaintenanceLogs] = useState([]);
  const [loadingMaintenanceLogs, setLoadingMaintenanceLogs] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [auditSearchText, setAuditSearchText] = useState("");
  const [auditStatusFilter, setAuditStatusFilter] = useState("all");

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
  - Section HPP Cost Testing / Reset Modal di halaman Reset Maintenance.

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
  const [loadingSaveHppCostBaseline, setLoadingSaveHppCostBaseline] = useState(false);
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
      { label: "Pricing Log", value: "pricing_logs" },
    ],
    [],
  );

  const selectedModuleLabels = useMemo(() => {
    const labelMap = new Map(moduleOptions.map((item) => [item.value, item.label]));
    return selectedModules.map((value) => labelMap.get(value) || value);
  }, [moduleOptions, selectedModules]);

  const isProductionPlanningOnlySelected = selectedModules.includes("production_planning_only");

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

  const loadMaintenanceLogs = useCallback(async () => {
    try {
      setLoadingMaintenanceLogs(true);
      const result = await getLatestMaintenanceLogs(20);
      setMaintenanceLogs(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMaintenanceLogs(false);
    }
  }, []);

  useEffect(() => {
    loadMaintenanceLogs();
  }, [loadMaintenanceLogs]);

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

  const handleSaveHppCostBaseline = async () => {
    try {
      setLoadingSaveHppCostBaseline(true);
      const result = await saveCurrentHppCostBaseline();
      await createPageMaintenanceLog({
        actionType: "save_hpp_cost_baseline",
        mode: "hpp_cost_baseline",
        modules: ["hpp_cost_testing"],
        summary: { itemCount: result?.itemCount || 0 },
        affectedCollections: ["testing_baselines"],
        affectedCount: result?.itemCount || 0,
        dryRun: false,
        status: "success",
        note: "Baseline modal/HPP menyimpan field cost master saja, tanpa stok dan tanpa transaksi.",
      });
      message.success(result?.message || "Baseline modal/HPP berhasil disimpan.");
      await loadHppCostBaselineSummary();
      await loadMaintenanceLogs();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyimpan baseline modal/HPP.");
    } finally {
      setLoadingSaveHppCostBaseline(false);
    }
  };

  const openHppCostConfirmation = (actionType) => {
    if (actionType === "reset") {
      if (!hppCostPreview || hppCostPreview.resetMode !== hppCostResetMode) {
        message.error("Preview reset modal/HPP wajib dimuat untuk mode aktif sebelum reset dijalankan.");
        return;
      }

      if (hppCostPreview.isClientBatchSafe === false) {
        message.error(`Reset diblokir karena estimasi ${hppCostPreview.estimatedWriteOperations} operasi melebihi batas aman ${hppCostPreview.safeClientLimit}.`);
        return;
      }
    }

    if (actionType === "restore" && !hppCostBaselineSummary?.exists) {
      message.error("Baseline modal/HPP belum ada. Simpan baseline dulu sebelum restore.");
      return;
    }

    setHppCostConfirmAction(actionType);
    hppConfirmForm.setFieldsValue({ confirmationText: "", actionNote });
    setHppCostConfirmOpen(true);
  };

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
        await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
          await loadMaintenanceLogs();
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
      const result = await getResetPreview({
        resetMode: mode,
        modules: selectedModules,
      });
      setPreview(result);
      if (showSuccessMessage) {
        message.success("Preview reset berhasil dimuat.");
      }
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal memuat preview reset.");
    } finally {
      setLoadingPreview(false);
    }
  }, [mode, selectedModules]);

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
    setPreview(null);
  }, [mode, selectedModules]);

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
      await loadMaintenanceLogs();
    } catch (error) {
      console.error(error);

      if (testCleanupLogId && !cleanupCompleted) {
        try {
          await updateMaintenanceLogStatus(testCleanupLogId, {
            status: "failed",
            errorMessage: error?.message || "Hapus Data Test gagal sebelum batch delete selesai.",
            note: buildPageAuditNote("Hapus Data Test gagal. Service memakai single batch agar tidak partial delete."),
          });
          await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      - Memanggil audit data lama secara read-only, menampilkan summary/samples, dan mencatat audit log metadata.

      Dipakai oleh:
      - Tombol Cek Data Lama dan Preview Data Bermasalah di section Data Quality Audit.

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
      setDataQualityPreviewVisible(Boolean(showProblemPreview));
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
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
      await loadMaintenanceLogs();
      await loadPreview(false);
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menjalankan repair variant lintas modul.");
    } finally {
      setLoadingTransactionVariantRepair(false);
    }
  };

  const prepareVariantTransactionReset = () => {
    // -------------------------------------------------------------------------
    // Batch 3 helper: hanya menyiapkan reset scoped transaksi varian lama.
    // Eksekusi tetap wajib lewat preview + konfirmasi RESET agar data final tidak
    // terhapus diam-diam.
    // -------------------------------------------------------------------------
    setMode("transaction_only");
    setSelectedModules(["sales", "purchases", "returns", "stock_adjustment_and_logs"]);
    message.info("Reset terarah transaksi varian disiapkan. Review preview lalu ketik RESET jika sudah yakin.");
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

  const prepareProductionReset = async () => {
    // -------------------------------------------------------------------------
    // Reset terarah tidak langsung menghapus data.
    // Tombol ini hanya menyiapkan modul Produksi di area Reset Data, sehingga
    // user tetap wajib review preview dan mengetik RESET di dialog destructive.
    // -------------------------------------------------------------------------
    setMode("transaction_only");
    setSelectedModules(["production"]);
    message.info("Reset terarah Produksi disiapkan. Cek preview lalu jalankan konfirmasi RESET jika sudah yakin.");
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
      if ((values.confirmationText || "").trim().toUpperCase() !== "RESET") {
        message.error('Ketik "RESET" untuk konfirmasi.');
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
        actionType: "reset_data",
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
        note: "Reset destructive dimulai setelah preview dan konfirmasi RESET. Log ini dibuat sebelum delete agar reset tidak berjalan tanpa audit.",
      }, { note: values.actionNote });

      const result = await runResetDataTest({
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
          },
          resultBuckets: {
            deleted: result?.totalDeletedRecords || 0,
            stockUpdated: result?.stockResult?.affectedItems || 0,
          },
          affectedCollections: getCollectionLabels(result?.deletedCollections),
          affectedCount: result?.totalWriteOperations || result?.totalDeletedRecords || 0,
          note: mergeAuditNote("Reset destructive berhasil. Delete transaksi dan update stok dijalankan dalam satu batch aman dari client.", values.actionNote),
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
      await loadPreview(false);
      await loadDevTestDataPreview(false);
      await handleLoadProductionMaintenanceAudit();
      await loadMaintenanceLogs();
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
          await loadMaintenanceLogs();
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

  const hppCostPreviewRows = useMemo(() => (hppCostPreview?.affectedCollections || []).map((item) => ({
    key: item.key,
    collection: item.label || item.key,
    affectedDocs: item.affectedDocs || 0,
    affectedVariantRows: item.affectedVariantRows || 0,
    fields: [...(item.fieldsToReset || []), ...(item.variantFieldsToReset || []).map((fieldName) => `variants.${fieldName}`)],
    samples: (item.samples || []).map((sample) => sample.name || sample.id).join(", "),
  })), [hppCostPreview]);

  const hppCostSelectedOption = useMemo(
    () => HPP_COST_RESET_OPTIONS.find((item) => item.value === hppCostResetMode),
    [hppCostResetMode],
  );

  const hppCostConfirmKeyword = HPP_CONFIRM_KEYWORDS[hppCostConfirmAction] || HPP_CONFIRM_KEYWORDS.reset;

  const maintenanceRows = useMemo(() => maintenanceAudit?.rows || [], [maintenanceAudit]);
  const stockMaintenanceRows = useMemo(() => stockAudit?.rows || [], [stockAudit]);
  const logSchemaRows = useMemo(() => logSchemaAudit?.rows || [], [logSchemaAudit]);
  const legacyDataRows = useMemo(() => legacyDataAudit?.rows || [], [legacyDataAudit]);
  const dataQualityRows = useMemo(() => dataQualityAudit?.categories || [], [dataQualityAudit]);
  const masterCodeRows = useMemo(() => masterCodeAudit?.rows || [], [masterCodeAudit]);
  const stockSummary = stockAudit?.summary || {};
  const logSchemaSummary = logSchemaAudit?.summary || {};
  const legacyDataSummary = legacyDataAudit?.summary || {};
  const dataQualitySummary = dataQualityAudit?.summary || {};
  const masterCodeSummary = masterCodeAudit?.summary || {};
  const payrollAuditRows = useMemo(() => payrollAudit?.rows || [], [payrollAudit]);
  const transactionVariantRows = useMemo(() => transactionVariantAudit?.rows || [], [transactionVariantAudit]);
  const payrollAuditSummary = payrollAudit?.summary || {};
  const transactionVariantSummary = transactionVariantAudit?.summary || {};

  const recommendationText = useMemo(() => {
    if (mode === "transaction_only") {
      return "Paling cepat untuk uji trial-error karena stok master aktif tetap dipertahankan.";
    }
    if (mode === "reset_and_zero_stock") {
      return "Cocok jika Anda ingin simulasi dari nol total, tapi lebih agresif karena stok ikut dibersihkan.";
    }
    return "Mode paling profesional untuk testing berulang: simpan baseline, lakukan tes, lalu restore ke baseline yang sama.";
  }, [mode]);

  const filteredMaintenanceLogs = useMemo(() => {
    const search = auditSearchText.trim().toLowerCase();

    return maintenanceLogs.filter((item) => {
      const statusMatch = auditStatusFilter === "all" || (item.status || "").toLowerCase() === auditStatusFilter;
      if (!statusMatch) return false;

      if (!search) return true;

      const searchableText = [
        item.actionType,
        item.mode,
        item.status,
        item.executedBy,
        item.note,
        item.errorMessage,
        ...(item.modules || []),
        ...(item.affectedCollections || []),
      ].filter(Boolean).join(" ").toLowerCase();

      return searchableText.includes(search);
    });
  }, [auditSearchText, auditStatusFilter, maintenanceLogs]);

  const maintenanceSummary = maintenanceAudit?.summary || {};

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
        ? "Lihat detail audit; repair aman atau reset terarah sesuai area."
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
                    <Button block onClick={() => { setMode("reset_and_restore_baseline"); setSelectedModules([...DEFAULT_RESET_MODULES]); message.info("Mode Reset + Baseline dipilih. Muat preview sebelum eksekusi."); }}>
                      Pilih Baseline Reset
                    </Button>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={12} xl={6}>
                <Card size="small" title="Mulai dari Nol">
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    <Text type="secondary">Untuk data development yang sudah kacau: transaksi/log dibersihkan dan stok dinolkan.</Text>
                    <Button block danger onClick={() => { setMode("reset_and_zero_stock"); setSelectedModules([...DEFAULT_RESET_MODULES]); message.info("Mode Reset + Nolkan Stok dipilih. Muat preview sebelum eksekusi."); }}>
                      Pilih Reset Nol
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

          <Card title="Auto Detect Bug Data" size="small" extra={<Tag color={autoBugSummary.color}>{autoBugSummary.status}</Tag>}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Row gutter={[8, 8]}>
                <Col xs={24} md={6}>
                  <Button block type="primary" icon={<FileSearchOutlined />} loading={loadingAutoDetect} onClick={handleRunAllAudits}>
                    Cek Semua Area
                  </Button>
                </Col>
                <Col xs={24} md={6}>
                  <Button block icon={<FileSearchOutlined />} loading={loadingDataQualityAudit} onClick={() => handleLoadDataQualityAudit({ showProblemPreview: true })}>
                    Cek Data Lama
                  </Button>
                </Col>
                <Col xs={24} md={6}>
                  <Button block icon={<FileSearchOutlined />} loading={loadingStockAudit} onClick={handleLoadStockAudit}>
                    Cek Stok
                  </Button>
                </Col>
                <Col xs={24} md={6}>
                  <Button block icon={<FileSearchOutlined />} loading={loadingTransactionVariantAudit} onClick={handleLoadTransactionVariantAudit}>
                    Cek Variant Transaksi
                  </Button>
                </Col>
              </Row>
              <Table
                className="app-data-table"
                size="small"
                pagination={false}
                dataSource={auditOverviewRows}
                columns={[
                  { title: "Area", dataIndex: "area", key: "area", width: 150, render: (value) => renderCompactText(value, 135) },
                  { title: "Dicek", dataIndex: "checkedRecords", key: "checkedRecords", width: 90 },
                  { title: "Issue", dataIndex: "issueCount", key: "issueCount", width: 90, render: (value) => <Tag color={value ? "red" : "green"}>{value || 0}</Tag> },
                  { title: "Repair", dataIndex: "safeRepairCount", key: "safeRepairCount", width: 90, render: (value) => <Tag color={value ? "blue" : "default"}>{value || 0}</Tag> },
                  { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", render: (value) => renderCompactText(value, 360) },
                ]}
                scroll={{ x: 780 }}
              />
              {auditIssueRows.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message={`${autoBugSummary.issueCount} issue dan ${autoBugSummary.safeRepairCount} kandidat repair aman terdeteksi.`}
                  description="Buka Detail Audit jika perlu melihat sample record. Untuk data lama setelah patch, coba Repair Turunan dulu sebelum reset destructive."
                />
              )}
            </Space>
          </Card>

          <Card title="Repair Turunan Aman" size="small" extra={<Tag color="green">Tidak hapus data</Tag>}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Text type="secondary">
                Repair hanya menyamakan field turunan/display/snapshot. Tidak membuat transaksi baru, tidak posting stok ulang, dan tidak menghapus data utama.
              </Text>
              <Row gutter={[8, 8]}>
                <Col xs={24} md={8}><Button block icon={<SyncOutlined />} loading={loadingStockRepair} onClick={handleRepairStockAudit}>Repair Stok</Button></Col>
                <Col xs={24} md={8}><Button block icon={<SyncOutlined />} loading={loadingLogSchemaRepair} onClick={handleRepairLogSchema}>Repair Inventory Log</Button></Col>
                <Col xs={24} md={8}><Button block icon={<SyncOutlined />} loading={loadingMaintenanceRepair} onClick={handleRepairProductionMaintenance}>Repair Produksi</Button></Col>
                <Col xs={24} md={8}><Button block icon={<SyncOutlined />} loading={loadingPayrollRepair} onClick={handleRepairPayrollAudit}>Repair Payroll Snapshot</Button></Col>
                <Col xs={24} md={8}><Button block icon={<SyncOutlined />} loading={loadingTransactionVariantRepair} onClick={handleRepairTransactionVariantAudit}>Repair Variant Transaksi</Button></Col>
                <Col xs={24} md={8}>
                  <Popconfirm
                    title="Sinkronkan semua stok turunan?"
                    description="Aksi ini update field stok turunan master, bukan reset transaksi. Jalankan setelah audit jika benar-benar diperlukan."
                    okText="Ya, sinkronkan"
                    cancelText="Batal"
                    onConfirm={handleSyncStocks}
                  >
                    <Button block icon={<SyncOutlined />} loading={loadingSync}>Sync All Stocks</Button>
                  </Popconfirm>
                </Col>
              </Row>

              <Divider orientation="left" plain>Normalisasi Kode Master</Divider>
              <Text type="secondary">
                Dipakai untuk menyamakan kode internal Product, Raw Material, Semi Finished, BOM, Step, dan Supplier ke standar aktif tanpa rename document ID dan tanpa mengubah transaksi/history.
              </Text>
              <Row gutter={[8, 8]}>
                <Col xs={24} md={8}>
                  <Button block icon={<FileSearchOutlined />} loading={loadingMasterCodeAudit} onClick={handleLoadMasterCodeAudit}>Cek Kode Master</Button>
                </Col>
                <Col xs={24} md={8}>
                  <Popconfirm
                    title="Normalisasi kode master?"
                    description="Aksi ini hanya update field code/alias master. Document ID dan data transaksi/history tidak diubah."
                    okText="Ya, normalisasi"
                    cancelText="Batal"
                    onConfirm={handleRepairMasterCodeAudit}
                  >
                    <Button block icon={<SyncOutlined />} loading={loadingMasterCodeRepair} disabled={!masterCodeSummary.executablePlanCount}>Normalisasi Kode</Button>
                  </Popconfirm>
                </Col>
                <Col xs={24} md={8}>
                  <Statistic title="Perlu Normalisasi" value={masterCodeSummary.executablePlanCount || 0} />
                </Col>
              </Row>
              {masterCodeAudit && (
                <Alert
                  type={masterCodeSummary.executablePlanCount ? "warning" : "success"}
                  showIcon
                  message={masterCodeSummary.executablePlanCount ? `${masterCodeSummary.executablePlanCount} kode master perlu dinormalisasi.` : "Kode master sudah sesuai standar aktif."}
                  description="Field yang disentuh hanya kode internal/alias. Data history seperti purchase, stock log, work log, payroll, dan transaksi tidak ikut diubah."
                />
              )}
              {Boolean(masterCodeRows.length) && (
                <Table
                  className="app-data-table"
                  size="small"
                  pagination={{ pageSize: 5 }}
                  dataSource={masterCodeRows}
                  columns={[
                    { title: "Area", dataIndex: "area", key: "area", width: 150, render: (value) => renderCompactText(value, 135) },
                    { title: "Item", dataIndex: "itemName", key: "itemName", width: 220, render: (value) => renderCompactText(value, 200) },
                    { title: "Kode Saat Ini", dataIndex: "currentCode", key: "currentCode", width: 140, render: (value) => renderCompactTag(value, 125) },
                    { title: "Kode Baru", dataIndex: "proposedCode", key: "proposedCode", width: 140, render: (value) => renderCompactTag(value, 125) },
                    { title: "Catatan", dataIndex: "issue", key: "issue", render: (value) => renderCompactText(value, 320) },
                  ]}
                  scroll={{ x: 880 }}
                />
              )}
            </Space>
          </Card>

          <Card title="Reset & Baseline" size="small" extra={<Tag color="red">Destructive guarded</Tag>}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Row gutter={[12, 12]}>
                <Col xs={24} md={8}>
                  <Text strong>Mode Reset</Text>
                  <Select
                    value={mode}
                    onChange={setMode}
                    options={RESET_MODE_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
                    style={{ width: "100%", marginTop: 8 }}
                  />
                </Col>
                <Col xs={24} md={16}>
                  <Text strong>Modul</Text>
                  <Checkbox.Group
                    value={selectedModules}
                    onChange={setSelectedModules}
                    options={moduleOptions}
                    style={{ display: "grid", gap: 8, marginTop: 8 }}
                  />
                </Col>
              </Row>
              <Row gutter={[12, 12]}>
                <Col xs={12} md={6}><Statistic title="Mode" value={RESET_MODE_LABELS[mode] || mode} /></Col>
                <Col xs={12} md={6}><Statistic title="Target Hapus" value={preview?.totalRecords || 0} /></Col>
                <Col xs={12} md={6}><Statistic title="Operasi" value={preview?.executionPlan?.totalWriteOperations || 0} /></Col>
                <Col xs={12} md={6}><Statistic title="Modul" value={selectedModules.length} /></Col>
              </Row>
              <Space wrap>
                <Button icon={<EyeOutlined />} loading={loadingPreview} onClick={() => loadPreview(true)}>Preview Reset</Button>
                <Popconfirm
                  title="Simpan baseline stok saat ini?"
                  description="Baseline dipakai untuk reset testing berulang. Data baseline lama akan diganti oleh snapshot saat ini."
                  okText="Ya, simpan"
                  cancelText="Batal"
                  onConfirm={handleSaveBaseline}
                >
                  <Button icon={<SaveOutlined />} loading={loadingBaseline}>Simpan Baseline Stok</Button>
                </Popconfirm>
                <Button danger type="primary" icon={<ReloadOutlined />} onClick={openResetConfirmation} disabled={Boolean(resetBlockedReason) || loadingPreview}>
                  Konfirmasi RESET
                </Button>
                {resetBlockedReason && <Tag color="red">{resetBlockedReason}</Tag>}
              </Space>
              {preview && (
                <Table
                  className="app-data-table"
                  size="small"
                  pagination={false}
                  dataSource={previewRows}
                  columns={[
                    { title: "Modul", dataIndex: "moduleLabel", key: "moduleLabel", width: 170, render: (value) => renderCompactText(value, 150) },
                    { title: "Target", dataIndex: "name", key: "name", width: 220, render: (value) => renderCompactText(value, 200) },
                    { title: "Jumlah", dataIndex: "count", key: "count", width: 90 },
                    { title: "Status", dataIndex: "status", key: "status", width: 120, render: (value) => <Tag color={value === "delete" ? "red" : "green"}>{value === "delete" ? "Dihapus" : "Dilindungi"}</Tag> },
                    { title: "Aksi", dataIndex: "action", key: "action", render: (value) => renderCompactText(value, 300) },
                  ]}
                  scroll={{ x: 900 }}
                />
              )}
            </Space>
          </Card>

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

          <Card title="Cara Pakai Setelah Patch" size="small" extra={<Tag color="purple">Checklist ringkas</Tag>}>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}>
                <Card size="small" title="Pakai data lama">
                  <ol style={{ paddingLeft: 18, marginBottom: 0 }}>
                    <li>Auto Detect Bug.</li>
                    <li>Repair Turunan Aman.</li>
                    <li>Cek ulang area yang warning.</li>
                    <li>Test Purchase, Sales, Return, Produksi, Payroll.</li>
                  </ol>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small" title="Testing berulang">
                  <ol style={{ paddingLeft: 18, marginBottom: 0 }}>
                    <li>Simpan baseline stok.</li>
                    <li>Jalankan transaksi test.</li>
                    <li>Preview Reset + Baseline.</li>
                    <li>Ketik RESET untuk ulang dari baseline.</li>
                  </ol>
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small" title="Mulai dari nol">
                  <ol style={{ paddingLeft: 18, marginBottom: 0 }}>
                    <li>Export master.</li>
                    <li>Pilih Reset + Nolkan Stok.</li>
                    <li>Preview dan cek protected data.</li>
                    <li>Input opening stock/purchase baru.</li>
                  </ol>
                </Card>
              </Col>
            </Row>
          </Card>

          {/*
          =====================================================
          SECTION: Detail Audit Tools wrapper — CLEANUP CANDIDATE
          Fungsi:
          - Membungkus panel teknis lama agar owner melihat decision center dulu, tetapi developer tetap bisa akses audit/repair/reset detail.

          Dipakai oleh:
          - ResetMaintenanceData.jsx untuk menjaga backward compatibility panel maintenance existing.

          Alasan perubahan:
          - Panel lama terlalu teknis untuk halaman utama dan membuat action destructive terasa seperti kumpulan tombol tanpa alur keputusan.

          Catatan cleanup:
          - Panel lama bisa dipisah ke subcomponent per area setelah regression checklist lengkap.

          Risiko:
          - Jangan hapus panel lama karena masih menjadi akses developer ke detail audit/repair dan HPP testing.
          =====================================================
          */}
          <Collapse defaultActiveKey={[]}>
            <Collapse.Panel header="Detail Audit / Tools" key="advanced-tools">
              <Space direction="vertical" size={20} style={{ width: "100%" }}>

          <Card
            title="Maintenance Produksi"
            size="small"
            extra={<Tag color="purple">Tahap awal: Produksi</Tag>}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <ResetActionGuide
                risk="maintenance"
                description="Audit dan repair varian produksi"
                preview="Cek Data Produksi menjalankan dry run dan menampilkan summary/tabel sebelum repair."
                scope="Target: production_orders, production_work_logs, dan inventory_logs produksi."
                impact="Repair hanya field turunan/display; stok, kas, payroll, dan HPP tidak diposting ulang."
                confirmation="Repair memakai Popconfirm; reset terarah hanya menyiapkan scope lalu tetap lewat konfirmasi RESET."
              />
              <Alert
                type="info"
                showIcon
                message="Cek dulu sebelum repair"
                description="Audit produksi tanpa write data."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={8}>
                  <Button
                    block
                    icon={<EyeOutlined />}
                    onClick={handleLoadProductionMaintenanceAudit}
                    loading={loadingMaintenanceAudit}
                  >
                    Cek Data Produksi
                  </Button>
                </Col>
                <Col xs={24} md={8}>
                  <Popconfirm
                    title="Jalankan repair aman?"
                    description="Repair field turunan; stok, kas, payroll, HPP tetap."
                    okText="Ya, Repair Aman"
                    cancelText="Batal"
                    onConfirm={handleRepairProductionMaintenance}
                  >
                    <Button
                      block
                      type="primary"
                      icon={<SyncOutlined />}
                      loading={loadingMaintenanceRepair}
                    >
                      Repair Aman
                    </Button>
                  </Popconfirm>
                </Col>
                <Col xs={24} md={8}>
                  <Button block danger icon={<DeleteOutlined />} onClick={prepareProductionReset}>
                    Siapkan Reset Terarah Produksi
                  </Button>
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={12} md={4}>
                  <Card size="small">
                    <Statistic title="Data Dicek" value={maintenanceSummary.checkedRecords || 0} />
                  </Card>
                </Col>
                <Col xs={12} md={5}>
                  <Card size="small">
                    <Statistic title="Aman Repair" value={maintenanceSummary.safeRepairCount || 0} />
                  </Card>
                </Col>
                <Col xs={12} md={5}>
                  <Card size="small">
                    <Statistic title="Display Repair" value={maintenanceSummary.displayRepairCount || 0} />
                  </Card>
                </Col>
                <Col xs={12} md={5}>
                  <Card size="small">
                    <Statistic title="Reset/Manual" value={maintenanceSummary.resetManualCount || 0} />
                  </Card>
                </Col>
                <Col xs={12} md={5}>
                  <Card size="small">
                    <Statistic title="Plan Eksekusi" value={maintenanceSummary.executablePlanCount || 0} />
                  </Card>
                </Col>
              </Row>

              <Table
                className="app-data-table"
                size="small"
                loading={loadingMaintenanceAudit || loadingMaintenanceRepair}
                dataSource={maintenanceRows}
                pagination={{ pageSize: 8, showSizeChanger: false }}
                columns={[
                  { title: "Area", dataIndex: "scope", key: "scope", width: 115, render: (value) => renderCompactText(value, 100) },
                  { title: "Kode/Type", dataIndex: "code", key: "code", width: 125, render: (value) => renderCompactText(value, 110) },
                  { title: "Status", dataIndex: "status", key: "status", width: 95, render: (value) => renderCompactText(value, 80) },
                  {
                    title: "Kategori",
                    dataIndex: "category",
                    key: "category",
                    width: 135,
                    render: (value) => {
                      const meta = MAINTENANCE_CATEGORY_META[value] || MAINTENANCE_CATEGORY_META.ok;
                      return <Tag color={meta.color}>{meta.label}</Tag>;
                    },
                  },
                  { title: "Masalah", dataIndex: "issue", key: "issue", width: 205, render: (value) => renderCompactText(value, 190) },
                  { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", width: 250, render: (value) => renderCompactText(value, 235) },
                ]}
                scroll={{ x: 925 }}
                locale={{ emptyText: "Klik Cek Data Produksi untuk menjalankan dry run audit." }}
              />
            </Space>
          </Card>

          <Card
            title="Maintenance Stok"
            size="small"
            extra={<Tag color="cyan">Dry Run Stok</Tag>}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <ResetActionGuide
                risk="maintenance"
                description="Audit dan repair sinkronisasi stok"
                preview="Cek Stok Umum menjalankan dry run dan menampilkan mismatch yang aman direpair."
                scope="Target: raw_materials, semi_finished_materials, dan products."
                impact="Repair menyamakan field turunan stok tanpa membuat inventory log atau posting stok baru."
                confirmation="Repair memakai Popconfirm; Sinkronkan Stok tetap action terpisah di section Reset Data."
              />
              <Alert
                type="info"
                showIcon
                message="Cek stok sebelum repair"
                description="Repair field turunan stok tanpa mutasi baru."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Button block icon={<EyeOutlined />} onClick={handleLoadStockAudit} loading={loadingStockAudit}>
                    Cek Stok Umum
                  </Button>
                </Col>
                <Col xs={24} md={12}>
                  <Popconfirm
                    title="Repair sinkronisasi stok?"
                    description="Repair field turunan stok tanpa mutasi baru."
                    okText="Ya, Repair Stok"
                    cancelText="Batal"
                    onConfirm={handleRepairStockAudit}
                  >
                    <Button block type="primary" icon={<SyncOutlined />} loading={loadingStockRepair}>
                      Repair Sinkron Stok
                    </Button>
                  </Popconfirm>
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Dicek" value={stockSummary.checkedRecords || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="OK" value={stockSummary.okCount || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Aman Repair" value={stockSummary.safeRepairCount || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Plan" value={stockSummary.executablePlanCount || 0} /></Card></Col>
              </Row>

              <Table
                className="app-data-table"
                size="small"
                loading={loadingStockAudit || loadingStockRepair}
                dataSource={stockMaintenanceRows}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                columns={[
                  { title: "Collection", dataIndex: "collectionName", key: "collectionName", width: 130, render: (value) => renderCompactText(value, 115) },
                  { title: "Item", dataIndex: "itemName", key: "itemName", width: 175, render: (value) => renderCompactText(value, 160) },
                  { title: "Variant", dataIndex: "hasVariants", key: "hasVariants", width: 90, render: (value) => value ? <Tag color="blue">Variant</Tag> : <Tag>Master</Tag> },
                  { title: "Kategori", dataIndex: "category", key: "category", width: 125, render: (value) => value === "safe_repair" ? <Tag color="blue">Aman Repair</Tag> : <Tag color="green">OK</Tag> },
                  { title: "Masalah", dataIndex: "issue", key: "issue", width: 230, render: (value) => renderCompactText(value, 215) },
                  { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", width: 250, render: (value) => renderCompactText(value, 235) },
                ]}
                scroll={{ x: 1000 }}
                locale={{ emptyText: "Klik Cek Stok Umum untuk menjalankan dry run stok." }}
              />
            </Space>
          </Card>

          <Card
            title="Repair Inventory Log"
            size="small"
            extra={<Tag color="gold">Display Repair</Tag>}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <ResetActionGuide
                risk="maintenance"
                description="Audit dan repair schema inventory log"
                preview="Cek Schema Inventory Log menampilkan issue display/snapshot sebelum repair."
                scope="Target: inventory_logs."
                impact="Repair hanya melengkapi field tampilan; qty, stok, dan saldo tidak berubah."
                confirmation="Repair memakai Popconfirm karena bukan reset destructive transaksi."
              />
              <Alert
                type="info"
                showIcon
                message="Repair tampilan log"
                description="Melengkapi field tampilan; qty dan stok tetap."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Button block icon={<EyeOutlined />} onClick={handleLoadLogSchemaAudit} loading={loadingLogSchemaAudit}>
                    Cek Schema Inventory Log
                  </Button>
                </Col>
                <Col xs={24} md={12}>
                  <Popconfirm
                    title="Repair schema inventory log?"
                    description="Repair schema log tanpa mengubah qty atau stok."
                    okText="Ya, Repair Schema"
                    cancelText="Batal"
                    onConfirm={handleRepairLogSchema}
                  >
                    <Button block type="primary" icon={<SyncOutlined />} loading={loadingLogSchemaRepair}>
                      Repair Schema Log
                    </Button>
                  </Popconfirm>
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Dicek" value={logSchemaSummary.checkedRecords || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="OK" value={logSchemaSummary.okCount || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Display Repair" value={logSchemaSummary.displayRepairCount || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Plan" value={logSchemaSummary.executablePlanCount || 0} /></Card></Col>
              </Row>

              <Table
                className="app-data-table"
                size="small"
                loading={loadingLogSchemaAudit || loadingLogSchemaRepair}
                dataSource={logSchemaRows}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                columns={[
                  { title: "Type", dataIndex: "type", key: "type", width: 115, render: (value) => renderCompactText(value, 100) },
                  { title: "Item", dataIndex: "itemName", key: "itemName", width: 170, render: (value) => renderCompactText(value, 155) },
                  { title: "Kategori", dataIndex: "category", key: "category", width: 135, render: (value) => value === "display_repair" ? <Tag color="purple">Display Repair</Tag> : <Tag color="green">OK</Tag> },
                  { title: "Masalah", dataIndex: "issue", key: "issue", width: 225, render: (value) => renderCompactText(value, 210) },
                  { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", width: 245, render: (value) => renderCompactText(value, 230) },
                ]}
                scroll={{ x: 890 }}
                locale={{ emptyText: "Klik Cek Schema Inventory Log untuk menjalankan dry run schema." }}
              />
            </Space>
          </Card>


          {/*
          =====================================================
          SECTION: Data Quality Audit UI — LEGACY-COMPAT
          Fungsi:
          - Menampilkan audit read-only untuk data testing/legacy yang belum mengikuti standar kode/reference baru.

          Dipakai oleh:
          - Admin Reset Maintenance sebelum memutuskan reset/recreate data testing.

          Alasan perubahan:
          - Memberi daftar data bermasalah tanpa migration, backfill, delete, atau perubahan transaksi/stok/kas/HPP.

          Catatan cleanup:
          - Bisa dipisah menjadi subcomponent jika jumlah kategori audit bertambah.

          Risiko:
          - Jangan ubah tombol audit menjadi repair/delete otomatis; reset existing harus tetap lewat preview dan konfirmasi destructive.
          =====================================================
          */}
          <Card
            title="Data Quality Audit"
            size="small"
            extra={<Tag color="magenta">Read-only</Tag>}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <ResetActionGuide
                risk="safe"
                description="Audit kualitas data legacy/testing"
                preview="Cek Data Lama dan Preview Data Bermasalah menampilkan kategori/samples tanpa write data bisnis."
                scope="Target: kategori data lama lintas modul yang dibaca oleh dataQualityAuditService."
                impact="Tidak ada migration, backfill, delete, stok, kas, payroll, HPP, atau transaksi yang diubah."
                confirmation="Tidak butuh keyword karena read-only; action dicatat ke Riwayat Maintenance sebagai dry run."
              />
              <Alert
                type="info"
                showIcon
                message="Cek data lama tanpa mengubah data"
                description="Audit read-only data legacy/testing; tidak ada write data bisnis. Metadata dicatat ke Riwayat Maintenance bila audit log tersedia."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Button
                    block
                    icon={<EyeOutlined />}
                    onClick={() => handleLoadDataQualityAudit({ showProblemPreview: false })}
                    loading={loadingDataQualityAudit}
                  >
                    Cek Data Lama
                  </Button>
                </Col>
                <Col xs={24} md={12}>
                  <Button
                    block
                    icon={<EyeOutlined />}
                    onClick={() => handleLoadDataQualityAudit({ showProblemPreview: true })}
                    loading={loadingDataQualityAudit}
                  >
                    Preview Data Bermasalah
                  </Button>
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Data Dicek" value={dataQualitySummary.checkedRecords || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Total Temuan" value={dataQualitySummary.totalIssueRecords || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Kategori Bermasalah" value={dataQualitySummary.totalCategoriesWithIssues || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Collection Skipped" value={dataQualitySummary.skippedCollections || 0} /></Card></Col>
              </Row>

              {dataQualityAudit?.skippedCollections?.length ? (
                <Alert
                  type="warning"
                  showIcon
                  message="Sebagian collection tidak bisa dibaca"
                  description={dataQualityAudit.skippedCollections.map((item) => `${item.key}: ${item.error}`).join(" • ")}
                />
              ) : null}

              <Table
                className="app-data-table"
                size="small"
                loading={loadingDataQualityAudit}
                dataSource={dataQualityRows}
                pagination={false}
                rowKey="key"
                columns={[
                  { title: "Kategori", dataIndex: "label", key: "label", width: 245, render: (value) => renderCompactText(value, 230) },
                  { title: "Jumlah", dataIndex: "count", key: "count", width: 90 },
                  { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", width: 220, render: (value) => {
                    const color = value === "Jangan reset jika data asli" ? "red" : value === "Perlu cek manual" ? "orange" : "blue";
                    return <Tag color={color}>{value}</Tag>;
                  } },
                  {
                    title: "Sample Maks. 10",
                    dataIndex: "samples",
                    key: "samples",
                    width: 410,
                    render: (samples = [], record) => {
                      if (!record.count) return <Text type="secondary">Tidak ada temuan.</Text>;
                      if (!dataQualityPreviewVisible) return <Text type="secondary">Klik Preview Data Bermasalah untuk melihat sample.</Text>;
                      return renderCompactText(samples.map((sample) => `${sample.collectionName}: ${sample.reference || sample.id} — ${sample.issue}`).join(" | "), 390);
                    },
                  },
                ]}
                scroll={{ x: 965 }}
                locale={{ emptyText: "Klik Cek Data Lama atau Preview Data Bermasalah untuk menjalankan audit read-only." }}
              />

              <Alert
                type="warning"
                showIcon
                message="Audit bukan migration"
                description="Gunakan audit sebelum reset data test. Jangan reset data asli tanpa cek manual."
              />
            </Space>
          </Card>

          <Card
            title="Audit Data Lama"
            size="small"
            extra={<Tag color="volcano">Cleanup Data Lama</Tag>}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <ResetActionGuide
                risk="safe"
                description="Audit legacy data sebelum reset/repair terarah"
                preview="Cek Data Lama menampilkan kategori aman repair, display repair, reset terarah, dan manual review."
                scope="Target: productions legacy, transaksi, production work logs, inventory logs, sales, returns, purchases, incomes, dan expenses."
                impact="Audit read-only; tombol reset terarah hanya menyiapkan module dan tetap harus lewat preview + keyword RESET."
                confirmation="Audit tidak butuh keyword; reset terarah tetap memakai modal Reset Data."
              />
              <Alert
                type="warning"
                showIcon
                message="Cek data lama sebelum cleanup"
                description="Audit data lama tanpa write; reset tetap wajib preview."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={8}>
                  <Button block icon={<EyeOutlined />} onClick={handleLoadLegacyDataAudit} loading={loadingLegacyDataAudit}>
                    Cek Data Lama
                  </Button>
                </Col>
                <Col xs={24} md={8}>
                  <Button block danger icon={<DeleteOutlined />} onClick={prepareProductionReset}>
                    Siapkan Reset Produksi + Log
                  </Button>
                </Col>
                <Col xs={24} md={8}>
                  <Button block danger icon={<DeleteOutlined />} onClick={prepareVariantTransactionReset}>
                    Siapkan Reset Transaksi Varian
                  </Button>
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={12} md={4}><Card size="small"><Statistic title="Dicek" value={legacyDataSummary.checkedRecords || 0} /></Card></Col>
                <Col xs={12} md={4}><Card size="small"><Statistic title="OK" value={legacyDataSummary.okCount || 0} /></Card></Col>
                <Col xs={12} md={4}><Card size="small"><Statistic title="Repair" value={legacyDataSummary.safeRepairCount || 0} /></Card></Col>
                <Col xs={12} md={4}><Card size="small"><Statistic title="Display" value={legacyDataSummary.displayRepairCount || 0} /></Card></Col>
                <Col xs={12} md={4}><Card size="small"><Statistic title="Reset Terarah" value={legacyDataSummary.scopedResetCount || 0} /></Card></Col>
                <Col xs={12} md={4}><Card size="small"><Statistic title="Manual" value={legacyDataSummary.manualReviewCount || 0} /></Card></Col>
              </Row>

              <Table
                className="app-data-table"
                size="small"
                loading={loadingLegacyDataAudit}
                dataSource={legacyDataRows}
                pagination={{ pageSize: 8, showSizeChanger: false }}
                columns={[
                  { title: "Area", dataIndex: "scope", key: "scope", width: 125, render: (value) => renderCompactText(value, 110) },
                  { title: "Kode/Ref", dataIndex: "code", key: "code", width: 135, render: (value) => renderCompactText(value, 120) },
                  { title: "Status", dataIndex: "status", key: "status", width: 95, render: (value) => renderCompactText(value, 80) },
                  {
                    title: "Kategori",
                    dataIndex: "category",
                    key: "category",
                    width: 135,
                    render: (value) => {
                      const meta = MAINTENANCE_CATEGORY_META[value] || MAINTENANCE_CATEGORY_META.ok;
                      return <Tag color={meta.color}>{meta.label}</Tag>;
                    },
                  },
                  { title: "Masalah", dataIndex: "issue", key: "issue", width: 225, render: (value) => renderCompactText(value, 210) },
                  { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", width: 255, render: (value) => renderCompactText(value, 240) },
                  { title: "Reset", dataIndex: "resetScope", key: "resetScope", width: 130, render: (value) => renderCompactTag(value, 110) },
                ]}
                scroll={{ x: 1100 }}
                locale={{ emptyText: "Klik Cek Data Lama untuk memetakan data transisi sebelum cleanup berikutnya." }}
              />
            </Space>
          </Card>


          <Card
            title="Payroll & Work Log Snapshot"
            size="small"
            extra={<Tag color="geekblue">Payroll Snapshot</Tag>}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <ResetActionGuide
                risk="maintenance"
                description="Audit dan repair snapshot payroll/work log"
                preview="Audit menampilkan mismatch Step vs Work Log sebelum repair."
                scope="Target: production_steps, production_work_logs, dan production_payrolls untuk audit; repair hanya production_work_logs."
                impact="Tidak mengubah payroll final, paid status, stok, kas, atau HPP."
                confirmation="Repair memakai Popconfirm dan hanya berjalan untuk record yang aman."
              />
              <Alert
                type="info"
                showIcon
                message="Audit snapshot payroll sebelum cleanup."
                description="Audit mismatch step vs payroll snapshot."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Button block icon={<EyeOutlined />} onClick={handleLoadPayrollAudit} loading={loadingPayrollAudit}>
                    Cek Snapshot Payroll
                  </Button>
                </Col>
                <Col xs={24} md={12}>
                  <Popconfirm
                    title="Repair snapshot payroll?"
                    description="Repair snapshot Work Log; payroll final, stok, dan kas tidak berubah."
                    okText="Ya, Repair Snapshot"
                    cancelText="Batal"
                    onConfirm={handleRepairPayrollAudit}
                  >
                    <Button block type="primary" icon={<SyncOutlined />} loading={loadingPayrollRepair}>
                      Repair Snapshot Payroll
                    </Button>
                  </Popconfirm>
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Dicek" value={payrollAuditSummary.checkedRecords || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Aman Repair" value={payrollAuditSummary.safeRepairCount || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Manual" value={payrollAuditSummary.manualReviewCount || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Plan" value={payrollAuditSummary.executablePlanCount || 0} /></Card></Col>
              </Row>

              <Table
                className="app-data-table"
                size="small"
                loading={loadingPayrollAudit || loadingPayrollRepair}
                dataSource={payrollAuditRows}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                columns={[
                  { title: "Work Log", dataIndex: "code", key: "code", width: 125, render: (value) => renderCompactText(value, 110) },
                  { title: "Step Snapshot", dataIndex: "stepName", key: "stepName", width: 155, render: (value, record) => renderCompactText(value || record.masterStepName, 140) },
                  { title: "Kategori", dataIndex: "category", key: "category", width: 135, render: (value) => {
                    const meta = MAINTENANCE_CATEGORY_META[value] || MAINTENANCE_CATEGORY_META.ok;
                    return <Tag color={meta.color}>{meta.label}</Tag>;
                  }},
                  { title: "Masalah", dataIndex: "issue", key: "issue", width: 245, render: (value) => renderCompactText(value, 230) },
                  { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", width: 240, render: (value) => renderCompactText(value, 225) },
                  { title: "Reset", dataIndex: "resetScope", key: "resetScope", width: 130, render: (value) => renderCompactTag(value, 110) },
                ]}
                scroll={{ x: 1030 }}
                locale={{ emptyText: "Klik Cek Snapshot Payroll untuk menjalankan dry run stale snapshot payroll." }}
              />
            </Space>
          </Card>

          <Card
            title="Variant Lintas Modul"
            size="small"
            extra={<Tag color="magenta">Variant Transactions</Tag>}
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <ResetActionGuide
                risk="maintenance"
                description="Audit dan repair snapshot varian lintas modul"
                preview="Audit memetakan transaksi lama yang masih memakai field variant legacy."
                scope="Target: sales, returns, purchases, stock_adjustments, dan inventory_logs."
                impact="Repair hanya mengisi snapshot/field turunan yang asal datanya jelas; qty, stok, dan kas tidak berubah."
                confirmation="Repair memakai Popconfirm; reset transaksi varian tetap lewat Reset Data + keyword RESET."
              />
              <Alert
                type="info"
                showIcon
                message="Audit transaksi lama tanpa snapshot varian."
                description="Audit transaksi lama tanpa mutasi qty, stok, atau kas."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Button block icon={<EyeOutlined />} onClick={handleLoadTransactionVariantAudit} loading={loadingTransactionVariantAudit}>
                    Cek Variant Lintas Modul
                  </Button>
                </Col>
                <Col xs={24} md={12}>
                  <Popconfirm
                    title="Repair snapshot variant lintas modul?"
                    description="Repair variant hanya jika asal data lama jelas."
                    okText="Ya, Repair Variant"
                    cancelText="Batal"
                    onConfirm={handleRepairTransactionVariantAudit}
                  >
                    <Button block type="primary" icon={<SyncOutlined />} loading={loadingTransactionVariantRepair}>
                      Repair Variant Lintas Modul
                    </Button>
                  </Popconfirm>
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Dicek" value={transactionVariantSummary.checkedRecords || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Aman Repair" value={transactionVariantSummary.safeRepairCount || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Display Repair" value={transactionVariantSummary.displayRepairCount || 0} /></Card></Col>
                <Col xs={12} md={6}><Card size="small"><Statistic title="Manual/Reset" value={transactionVariantSummary.manualReviewCount || 0} /></Card></Col>
              </Row>

              <Table
                className="app-data-table"
                size="small"
                loading={loadingTransactionVariantAudit || loadingTransactionVariantRepair}
                dataSource={transactionVariantRows}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                columns={[
                  { title: "Area", dataIndex: "scope", key: "scope", width: 125, render: (value) => renderCompactText(value, 110) },
                  { title: "Kode/Ref", dataIndex: "code", key: "code", width: 140, render: (value) => renderCompactText(value, 125) },
                  { title: "Kategori", dataIndex: "category", key: "category", width: 135, render: (value) => {
                    const meta = MAINTENANCE_CATEGORY_META[value] || MAINTENANCE_CATEGORY_META.ok;
                    return <Tag color={meta.color}>{meta.label}</Tag>;
                  }},
                  { title: "Masalah", dataIndex: "issue", key: "issue", width: 245, render: (value) => renderCompactText(value, 230) },
                  { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", width: 245, render: (value) => renderCompactText(value, 230) },
                  { title: "Reset", dataIndex: "resetScope", key: "resetScope", width: 130, render: (value) => renderCompactTag(value, 110) },
                ]}
                scroll={{ x: 1020 }}
                locale={{ emptyText: "Klik Cek Variant Lintas Modul untuk menjalankan dry run transaksi lama bervarian." }}
              />
            </Space>
          </Card>

          <Card title="Saran Reset Terarah" size="small" extra={<Tag color="purple">Reset Terarah</Tag>}>
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Text>• Gunakan <Text strong>Produksi + Inventory Log Produksi</Text> jika ingin membersihkan domain produksi tanpa menghapus payroll produksi.</Text>
              <Text>• Gunakan <Text strong>Payroll Produksi Saja</Text> bila perlu men-trim payroll testing tanpa menyentuh Work Log/PO.</Text>
              <Text>• Gunakan <Text strong>Produksi Data Lama Saja</Text> jika target cleanup hanya jejak flow lama.</Text>
              <Text>• Modul <Text strong>Penjualan + Income Sales</Text> dan <Text strong>Pembelian + Expense Purchases</Text> tetap menjadi pasangan reset terarah resmi agar kas tidak terhapus membabi buta.</Text>
            </Space>
          </Card>

          {/*
          =====================================================
          SECTION: HPP Cost Testing / Reset Modal UI — GUARDED
          Fungsi:
          - Menyediakan preview, baseline, restore, dan reset field modal/HPP master untuk trial & error HPP.

          Dipakai oleh:
          - Admin di menu Reset Maintenance saat menganalisis sumber cost HPP produksi.

          Alasan perubahan:
          - Trial HPP perlu reset modal/HPP yang terpisah dari reset transaksi agar tidak menghapus PO, Work Log, Payroll, stok, atau cash.

          Catatan cleanup:
          - Bisa dijadikan subcomponent jika utility Reset Maintenance sudah dipecah per domain.

          Risiko:
          - Aksi reset/restore destructive untuk field cost master; preview dan keyword khusus wajib dipertahankan.
          =====================================================
          */}
          <Divider orientation="left">HPP Cost Testing / Reset Modal</Divider>

          <Card title="HPP Cost Testing / Reset Modal" size="small" extra={<Tag color="volcano">Testing HPP</Tag>}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <ResetActionGuide
                risk="destructive"
                description="Preview, baseline, reset, dan restore modal/HPP testing"
                preview="Preview Reset Modal/HPP wajib dimuat sebelum reset; baseline summary tampil untuk restore."
                scope="Target mengikuti mode HPP_COST_RESET_OPTIONS dan field cost/HPP allowlist."
                impact="Reset/restore hanya field modal/HPP master; tidak menghapus transaksi, mengubah stok, payroll, cash, atau Work Log."
                confirmation="Reset memakai keyword RESET MODAL HPP; restore memakai keyword RESTORE MODAL HPP."
              />
              <Alert
                type="warning"
                showIcon
                message="Khusus trial & error analisis HPP"
                description="Reset hanya menyentuh modal/HPP master. Tidak menyentuh transaksi, stok, PO, Work Log, Payroll, atau Cash."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={10}>
                  <Text strong>Mode reset modal/HPP</Text>
                  <Select
                    value={hppCostResetMode}
                    onChange={setHppCostResetMode}
                    options={HPP_COST_RESET_OPTIONS.map((item) => ({
                      value: item.value,
                      label: item.label,
                    }))}
                    style={{ width: "100%", marginTop: 8 }}
                  />
                  <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                    {hppCostSelectedOption?.description || "Pilih mode reset modal/HPP untuk preview."}
                  </Paragraph>
                </Col>

                <Col xs={24} md={14}>
                  <Row gutter={[12, 12]}>
                    <Col xs={12} md={6}>
                      <Card size="small"><Statistic title="Baseline" value={hppCostBaselineSummary?.exists ? "Ada" : "Belum"} /></Card>
                    </Col>
                    <Col xs={12} md={6}>
                      <Card size="small"><Statistic title="Item Baseline" value={hppCostBaselineSummary?.itemCount || 0} /></Card>
                    </Col>
                    <Col xs={12} md={6}>
                      <Card size="small"><Statistic title="Dokumen" value={hppCostPreview?.totalAffectedDocs || 0} /></Card>
                    </Col>
                    <Col xs={12} md={6}>
                      <Card size="small"><Statistic title="Write" value={hppCostPreview?.estimatedWriteOperations || 0} /></Card>
                    </Col>
                  </Row>
                  <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                    Baseline tersimpan: {formatMaintenanceDate(hppCostBaselineSummary?.savedAt)}
                  </Text>
                </Col>
              </Row>

              <Row gutter={[12, 12]}>
                <Col xs={24} md={6}>
                  <Button
                    block
                    icon={<EyeOutlined />}
                    onClick={() => loadHppCostPreview(true)}
                    loading={loadingHppCostPreview}
                  >
                    Preview Mode Dipilih
                  </Button>
                </Col>
                <Col xs={24} md={6}>
                  <Button
                    block
                    icon={<SaveOutlined />}
                    onClick={handleSaveHppCostBaseline}
                    loading={loadingSaveHppCostBaseline}
                  >
                    Simpan Baseline Modal/HPP
                  </Button>
                </Col>
                <Col xs={24} md={6}>
                  <Button
                    block
                    icon={<ReloadOutlined />}
                    onClick={() => openHppCostConfirmation("restore")}
                    loading={loadingRestoreHppCostBaseline}
                  >
                    Restore Baseline Modal/HPP
                  </Button>
                </Col>
                <Col xs={24} md={6}>
                  <Button
                    block
                    danger
                    icon={<WarningOutlined />}
                    onClick={() => openHppCostConfirmation("reset")}
                    loading={loadingRunHppCostReset}
                  >
                    Reset Mode Dipilih
                  </Button>
                </Col>
                <Col xs={24} md={6}>
                  <Button
                    block
                    danger
                    type="primary"
                    icon={<WarningOutlined />}
                    onClick={openHppCostResetAllConfirmation}
                    loading={loadingRunHppCostReset || loadingHppCostPreview}
                  >
                    Reset Semua Modal/HPP
                  </Button>
                </Col>
              </Row>

              {hppCostPreview && (
                <Alert
                  type={hppCostPreview.isClientBatchSafe ? "info" : "error"}
                  showIcon
                  message={hppCostPreview.isClientBatchSafe ? "Preview aman dari batas batch client" : "Preview melebihi batas batch client"}
                  description={`${hppCostPreview.label}: ${hppCostPreview.totalAffectedDocs || 0} dokumen, ${hppCostPreview.totalAffectedVariantRows || 0} baris varian, ${hppCostPreview.estimatedWriteOperations || 0}/${hppCostPreview.safeClientLimit || 0} operasi tulis. ${hppCostPreview.warning || ""}`}
                />
              )}

              <Table
                className="app-data-table"
                size="small"
                loading={loadingHppCostPreview}
                pagination={false}
                dataSource={hppCostPreviewRows}
                columns={[
                  { title: "Collection", dataIndex: "collection", key: "collection", width: 190, render: (value) => renderCompactText(value, 175) },
                  { title: "Dokumen", dataIndex: "affectedDocs", key: "affectedDocs", width: 95 },
                  { title: "Varian", dataIndex: "affectedVariantRows", key: "affectedVariantRows", width: 90 },
                  { title: "Field Direset", dataIndex: "fields", key: "fields", width: 260, render: (values) => renderCompactText(values, 245) },
                  { title: "Sample Item", dataIndex: "samples", key: "samples", width: 320, render: (value) => renderCompactText(value, 305) },
                ]}
                scroll={{ x: 955 }}
                locale={{ emptyText: "Klik Preview Reset Modal/HPP untuk melihat field cost yang akan direset." }}
              />

              <Alert
                type="info"
                showIcon
                message="Batas aman fitur ini"
                description="Tidak membuat mutasi stok, inventory log, payroll, cash out, atau proses ulang Work Log."
              />
            </Space>
          </Card>

          <Divider orientation="left">Reset Data</Divider>

          <ResetActionGuide
            risk="destructive"
            description="Reset Data Testing utama, baseline stok, dan sync stock"
            preview="Preview reset real-time dan Refresh Preview menampilkan mode, module, protected master data, estimasi delete, dan operasi stok."
            scope="Target mengikuti mode reset dan module yang dipilih; Simpan Baseline memakai testing_baselines, Sync Stock memakai master inventory existing."
            impact="Reset destructive menghapus/menolkan/restore sesuai mode existing; baseline dan sync stock tetap memakai behavior service existing."
            confirmation="Reset Sekarang wajib modal keyword RESET; Simpan Baseline dan Sinkronkan Stok tidak dipaksa menjadi destructive confirmation."
          />

          <Row gutter={[16, 16]}>
            <Col xs={24} md={14}>
              <Card title="Mode Reset" size="small">
                <Radio.Group
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  style={{ width: "100%" }}
                >
                  <Space direction="vertical" size={16} style={{ width: "100%" }}>
                    {RESET_MODE_OPTIONS.map((item) => (
                      <div key={item.value}>
                        <Radio value={item.value}>{item.label}</Radio>
                        <div style={{ marginLeft: 24, marginTop: 4 }}>
                          <Text type="secondary">{item.description}</Text>
                        </div>
                      </div>
                    ))}
                  </Space>
                </Radio.Group>

                <Divider />
                <Alert
                  type="info"
                  showIcon
                  message={RESET_MODE_LABELS[mode]}
                  description={recommendationText}
                />
              </Card>
            </Col>

            <Col xs={24} md={10}>
              <Card title="Modul yang Akan Diproses" size="small">
                <Checkbox.Group
                  value={selectedModules}
                  onChange={setSelectedModules}
                  style={{ width: "100%" }}
                >
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    {moduleOptions.map((item) => (
                      <Checkbox key={item.value} value={item.value}>
                        {item.label}
                      </Checkbox>
                    ))}
                  </Space>
                </Checkbox.Group>
                {isProductionPlanningOnlySelected && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 12 }}
                    message="Reset Production Planning hanya menghapus production_plans"
                    description="Tidak menghapus PO, Work Log, Payroll, HPP, stok, atau report."
                  />
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[12, 12]}>
            <Col xs={24} md={6}>
              <Button
                block
                icon={<EyeOutlined />}
                onClick={() => loadPreview(true)}
                loading={loadingPreview}
              >
                Refresh Preview
              </Button>
            </Col>
            <Col xs={24} md={6}>
              <Button
                block
                icon={<SaveOutlined />}
                onClick={handleSaveBaseline}
                loading={loadingBaseline}
              >
                Simpan Baseline
              </Button>
            </Col>
            <Col xs={24} md={6}>
              <Button
                block
                icon={<SyncOutlined />}
                onClick={handleSyncStocks}
                loading={loadingSync}
              >
                Sinkronkan Stok
              </Button>
            </Col>
            <Col xs={24} md={6}>
              <Button
                block
                type="primary"
                danger
                icon={<DeleteOutlined />}
                onClick={openResetConfirmation}
                loading={loadingRun}
                disabled={Boolean(resetBlockedReason) || loadingPreview}
              >
                Reset Sekarang
              </Button>
            </Col>
          </Row>

          {resetBlockedReason ? (
            <Alert
              type="warning"
              showIcon
              message="Reset belum bisa dijalankan aman"
              description={resetBlockedReason}
            />
          ) : null}

          {preview?.executionPlan ? (
            <Alert
              type="info"
              showIcon
              message="Rencana eksekusi reset"
              description={`Estimasi ${preview.executionPlan.totalWriteOperations} operasi tulis (${preview.executionPlan.deleteOperations} delete + ${preview.executionPlan.stockOperations} update stok). Batas aman client: ${preview.executionPlan.safeClientLimit} operasi dalam satu batch.`}
            />
          ) : null}

          <Row gutter={[16, 16]}>
            <Col xs={24} md={6}>
              <Card size="small">
                <Statistic title="Mode Aktif" value={RESET_MODE_LABELS[mode]} valueStyle={resetStatisticValueStyle} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card size="small">
                <Statistic title="Modul Dipilih" value={selectedModules.length} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card size="small">
                <Statistic title="Data Akan Dihapus" value={preview?.totalRecords || 0} />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card size="small">
                <Statistic
                  title="Master Dilindungi"
                  value={preview?.protectedRecords || 0}
                  valueStyle={resetStatisticValueStyle}
                />
              </Card>
            </Col>
            <Col xs={24} md={6}>
              <Card size="small">
                <Statistic
                  title="Baseline"
                  value={preview?.baselineSummary?.label || "Belum dicek"}
                  valueStyle={resetStatisticValueStyle}
                />
              </Card>
            </Col>
          </Row>

          <Card
            title="Saran Pemakaian untuk Trial-Error"
            size="small"
            extra={<Tag color="blue">Alur Testing</Tag>}
          >
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              <Text>• Gunakan <Text strong>Maintenance / Sinkronisasi Data</Text> dulu jika masalahnya hanya field varian lama/stale.</Text>
              <Text>• Gunakan <Text strong>Reset Terarah Produksi</Text> jika data produksi lama terlalu rusak untuk direpair aman. Reset produksi sekarang ikut membersihkan inventory log produksi secara terarah.</Text>
              <Text>• Gunakan <Text strong>Reset + Baseline Testing</Text> untuk uji berulang yang konsisten.</Text>
              <Text>• Jalankan <Text strong>Cek Stok Umum</Text> sebelum Sinkronkan Stok agar mismatch stok bisa direview dulu.</Text>
              <Text>• Reset Sales/Purchases memakai scope income/expense terkait agar tidak membersihkan kas lintas modul secara diam-diam.</Text>
              <Text>• Supplier/vendor restock dilindungi dari reset default. Jika perlu reset Supplier, buat task developer destructive terpisah dengan konfirmasi khusus.</Text>
              <Text>• Gunakan <Text strong>Cek Data Lama</Text> sebelum cleanup file/logic berikutnya agar orphan log dan transaksi lama punya status jelas.</Text>
            </Space>
          </Card>

          <Card title="Preview Reset Real-Time" size="small">
            {/* -----------------------------------------------------------------
                Tabel preview utility ikut memakai class baseline global.
                Catatan:
                - kolom "Aksi Reset" di sini bersifat informasional, bukan action column utama per row
                - utility page ini masih transisi di level page shell, tetapi tabel preview sudah dimigrasikan
                Status: transisi sementara / aman dibersihkan lagi saat utility page ikut dinormalisasi penuh
            ----------------------------------------------------------------- */}
            <Table
              className="app-data-table"
              size="small"
              loading={loadingPreview}
              pagination={false}
              dataSource={previewRows}
              columns={[
                { title: "Modul", dataIndex: "moduleLabel", key: "moduleLabel", width: 145, render: (value) => renderCompactText(value, 130) },
                { title: "Koleksi / Scope", dataIndex: "name", key: "name", width: 210, render: (value) => renderCompactText(value, 195) },
                { title: "Jumlah Data", dataIndex: "count", key: "count", width: 115 },
                {
                  title: "Status",
                  dataIndex: "status",
                  key: "status",
                  width: 130,
                  render: (value) => value === "protected" ? <Tag color="green">Dilindungi</Tag> : <Tag color="red">Akan Dihapus</Tag>,
                },
                {
                  title: "Aksi Reset",
                  dataIndex: "action",
                  key: "action",
                  width: 210,
                  render: (value) => renderCompactTag(value, 190),
                },
              ]}
              scroll={{ x: 810 }}
              locale={{ emptyText: "Tidak ada modul aktif atau belum ada data yang cocok untuk reset." }}
            />
          </Card>

          <Card title="Data Test Aman" size="small" extra={<Tag color="cyan">dev_test_seed</Tag>}>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <ResetActionGuide
                risk="destructive"
                description="Hapus Data Test Saja"
                preview="Refresh Preview Data Test menampilkan collection bermarker dev_test_seed yang akan dihapus."
                scope="Target hanya dokumen bermarker isTestData/dev_test_seed/dev_seed sesuai service existing."
                impact="Data normal dan protected master tidak ikut terhapus; hasil delete dicatat di Riwayat Maintenance."
                confirmation="Saat ini memakai Popconfirm existing; keyword khusus dicatat sebagai temuan phase lanjutan."
              />
              <Alert
                type="info"
                showIcon
                message="Hapus hanya data test bermarker"
                description="Hanya data test bermarker yang dihapus."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Button block icon={<EyeOutlined />} onClick={() => loadDevTestDataPreview(true)} loading={loadingTestDataPreview}>
                    Refresh Preview Data Test
                  </Button>
                </Col>
                <Col xs={24} md={12}>
                  <Popconfirm
                    title="Hapus data test bermarker?"
                    description="Hanya data test bermarker yang dihapus."
                    okText="Ya, Hapus Data Test"
                    cancelText="Batal"
                    onConfirm={handleDeleteDevTestData}
                  >
                    <Button block danger icon={<DeleteOutlined />} loading={loadingDeleteTestData}>
                      Hapus Data Test Saja
                    </Button>
                  </Popconfirm>
                </Col>
              </Row>

              <Table
                className="app-data-table"
                size="small"
                loading={loadingTestDataPreview || loadingDeleteTestData}
                pagination={false}
                dataSource={testDataRows}
                columns={[
                  { title: "Collection", dataIndex: "name", key: "name", width: 220, render: (value) => renderCompactText(value, 205) },
                  { title: "Data Test", dataIndex: "count", key: "count", width: 115 },
                  { title: "Marker", dataIndex: "status", key: "status", width: 135, render: () => <Tag color="cyan">dev_test_seed</Tag> },
                  { title: "Aksi", dataIndex: "action", key: "action", width: 215, render: (value) => renderCompactTag(value, 195) },
                ]}
                scroll={{ x: 685 }}
                locale={{ emptyText: "Belum ada data test bermarker dev_test_seed." }}
              />
            </Space>
          </Card>

          <Card title="Riwayat Maintenance & Reset" size="small" extra={<Tag color="green">Audit Trail</Tag>}>
            {/* -----------------------------------------------------------------
                ACTIVE / FINAL FOUNDATION: maintenance log menampilkan metadata aksi
                dry run/repair/reset agar admin tidak perlu membuka Firestore manual.
                Log ini bukan sumber mutasi stok/kas, hanya catatan audit.
            ----------------------------------------------------------------- */}
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <ResetActionGuide
                risk="safe"
                description="Riwayat Maintenance dan Error Trail"
                preview="Tabel menampilkan log terakhir dari service existing tanpa mengubah query."
                scope="Filter lokal berdasarkan status dan pencarian teks pada action, actor, mode, target, note, atau error."
                impact="Membantu debug hasil eksekusi, status started/success/failed, waktu, actor, dan affected count."
                confirmation="Filter/search tidak mengubah data dan bisa direset kapan saja."
              />

              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  <Input
                    allowClear
                    placeholder="Search action, actor, mode, target, note, atau error"
                    value={auditSearchText}
                    onChange={(event) => setAuditSearchText(event.target.value)}
                  />
                </Col>
                <Col xs={16} md={8}>
                  <Select
                    value={auditStatusFilter}
                    onChange={setAuditStatusFilter}
                    style={{ width: "100%" }}
                    options={[
                      { value: "all", label: "Semua Status" },
                      { value: "started", label: "Started" },
                      { value: "success", label: "Success" },
                      { value: "failed", label: "Failed" },
                    ]}
                  />
                </Col>
                <Col xs={8} md={4}>
                  <Button
                    block
                    onClick={() => {
                      setAuditSearchText("");
                      setAuditStatusFilter("all");
                    }}
                  >
                    Reset Filter
                  </Button>
                </Col>
              </Row>

              <Table
                className="app-data-table"
                size="small"
                loading={loadingMaintenanceLogs}
                pagination={{ pageSize: 6, showSizeChanger: false }}
                dataSource={filteredMaintenanceLogs.map((item) => ({ ...item, key: item.id }))}
                columns={[
                  { title: "Waktu", dataIndex: "executedAt", key: "executedAt", width: 155, render: (value, record) => renderCompactText(formatMaintenanceDate(value || record.createdAt), 140) },
                  { title: "Actor", dataIndex: "executedBy", key: "executedBy", width: 130, render: (value) => renderCompactText(value || "client-ui", 115) },
                  { title: "Action Type", dataIndex: "actionType", key: "actionType", width: 155, render: (value) => renderCompactText(value, 140) },
                  { title: "Mode", dataIndex: "mode", key: "mode", width: 115, render: (value, record) => <Tag color={record.dryRun ? "blue" : "orange"}>{value || "-"}</Tag> },
                  { title: "Status", dataIndex: "status", key: "status", width: 100, render: (value) => {
                    const colorMap = { success: "green", started: "blue", failed: "red" };
                    return <Tag color={colorMap[value] || "default"}>{value || "-"}</Tag>;
                  } },
                  { title: "Target", dataIndex: "modules", key: "modules", width: 175, render: (values) => renderCompactText(values, 160) },
                  {
                    title: "Dampak",
                    dataIndex: "affectedCount",
                    key: "affectedCount",
                    width: 185,
                    render: (value, record) => renderCompactText(
                      `${value || 0} record${record.affectedCollections?.length ? ` • ${record.affectedCollections.join(", ")}` : ""}`,
                      170,
                    ),
                  },
                  { title: "Plan", dataIndex: "planSummary", key: "planSummary", width: 135, render: (value) => value?.totalWriteOperations ? `Batch ${value.totalWriteOperations}` : value?.checkedRecords ? `Dicek ${value.checkedRecords}` : value?.safeRepairCount ? `Plan ${value.safeRepairCount}` : "-" },
                  { title: "Note", dataIndex: "note", key: "note", width: 240, render: (value) => renderCompactText(value, 225) },
                  { title: "Error Trail", dataIndex: "errorMessage", key: "errorMessage", width: 230, render: (value) => renderCompactText(value, 215) },
                  { title: "Updated", dataIndex: "updatedAt", key: "updatedAt", width: 155, render: (value) => renderCompactText(formatMaintenanceDate(value), 140) },
                ]}
                scroll={{ x: 1730 }}
                locale={{ emptyText: "Belum ada riwayat maintenance/reset yang cocok dengan filter." }}
              />
            </Space>
          </Card>

              </Space>
            </Collapse.Panel>
          </Collapse>

        </Space>
      </Card>

      <Modal
        open={confirmOpen}
        title="Konfirmasi Reset Data"
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
            message="Reset akan menghapus scope terpilih"
            description="Pastikan preview sesuai. Reset tidak bisa dibatalkan dari halaman ini."
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
              label='Ketik "RESET" untuk konfirmasi terakhir'
              rules={[{ required: true, message: 'Ketik "RESET" untuk melanjutkan.' }]}
              extra="Reset hanya berjalan jika kata RESET benar."
            >
              <Input placeholder="Ketik RESET di sini" allowClear autoFocus />
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
