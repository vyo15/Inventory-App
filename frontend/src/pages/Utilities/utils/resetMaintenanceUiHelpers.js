import React from "react";
import { Alert, Space, Tag, Typography } from "antd";

const { Text } = Typography;

export const RESET_MODE_LABELS = {
  transaction_only: "Reset Transaksi",
  reset_and_zero_stock: "Reset + Nolkan Semua Stok",
  reset_and_restore_baseline: "Reset + Baseline Testing",
};

export const HPP_CONFIRM_KEYWORDS = {
  reset: "RESET MODAL HPP",
  restore: "RESTORE MODAL HPP",
};

export const RESET_CONFIRM_KEYWORDS = {
  standard: "RESET",
  full_testing_reset: "RESET SEMUA",
};

export const formatMaintenanceDate = (value) => {
  if (!value) return "-";
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID");
};

export const MAINTENANCE_CATEGORY_META = {
  ok: { label: "Sesuai", color: "green" },
  safe_repair: { label: "Aman Diperbaiki", color: "blue" },
  display_repair: { label: "Display/Snapshot", color: "purple" },
  manual: { label: "Butuh Reset/Manual", color: "red" },
  historical: { label: "Data Lama/Transisi", color: "orange" },
  scoped_reset: { label: "Aman Reset Terarah", color: "volcano" },
};

// -----------------------------------------------------------------------------
// IMS NOTE [AKTIF/CLEANUP CANDIDATE] — helper lokal untuk label collection.
// Fungsi blok: menjaga audit log reset/dev-test memakai bentuk label yang sama.
// Alasan cleanup: mengurangi map duplikatif tanpa membuat abstraction global.
// Hubungan flow: hanya metadata UI/audit, tidak mengubah target reset atau data.
// Behavior-preserving cleanup.
// -----------------------------------------------------------------------------
export const getCollectionLabels = (collections = []) => (
  Array.isArray(collections) ? collections.map((item) => item.label || item.key).filter(Boolean) : []
);

/*
=====================================================
SECTION: Compact audit table render helpers — AKTIF
Fungsi:
- Memadatkan teks panjang di tabel audit/maintenance dengan ellipsis dan tooltip agar field penting tetap bisa dibaca.

Dipakai oleh:
- ResetMaintenanceData.jsx pada tabel audit produksi, stok, schema log, data lama, payroll, variant, preview reset, data test, dan audit trail.

Alasan perubahan:
- Mengurangi kebutuhan scroll.x besar tanpa menghilangkan informasi audit seperti issue, recommendation, resetScope, action, note, dan error.

Catatan cleanup:
- Bisa dipindah ke helper table global jika pola compact audit dipakai di halaman utility lain.

Risiko:
- Jika helper ini diubah sembarangan, teks audit panjang bisa terpotong tanpa tooltip atau kolom penting menjadi sulit dibaca.
=====================================================
*/
export const renderCompactText = (value, maxWidth = 220, fallback = "-") => {
  const text = Array.isArray(value) ? value.filter(Boolean).join(", ") : value;

  if (text === undefined || text === null || text === "") {
    return fallback;
  }

  return React.createElement(
    Text,
    {
      style: { display: "inline-block", maxWidth: "100%", width: maxWidth },
      ellipsis: { tooltip: String(text) },
    },
    String(text),
  );
};

export const renderCompactTag = (value, maxWidth = 160, fallback = "-") => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return React.createElement(
    Tag,
    {
      title: String(value),
      style: { maxWidth, overflow: "hidden", textOverflow: "ellipsis", verticalAlign: "middle" },
    },
    String(value),
  );
};

export const ACTION_RISK_META = {
  safe: { label: "Aman / Non-destructive", color: "green" },
  maintenance: { label: "Maintenance", color: "blue" },
  destructive: { label: "Destructive", color: "red" },
  guarded: { label: "Guarded", color: "orange" },
};

export const AUDIT_SUMMARY_AREAS = [
  { key: "data_quality", label: "Data Quality", collection: "mixed", source: "dataQualityAudit" },
  { key: "hpp_reconcile", label: "HPP Reconcile", collection: "production_work_logs", source: "hppReconcileAudit" },
  { key: "master_code", label: "Kode Master", collection: "master", source: "masterCodeAudit" },
  { key: "stock", label: "Stok Umum", collection: "master stok", source: "stockAudit" },
  { key: "inventory_log", label: "Inventory Log", collection: "inventory_logs", source: "logSchemaAudit" },
  { key: "historical-data", label: "Data Lama", collection: "historical_data", source: "historicalDataAudit" },
  { key: "production", label: "Produksi", collection: "production_*", source: "maintenanceAudit" },
  { key: "payroll", label: "Payroll Snapshot", collection: "production_payrolls", source: "payrollAudit" },
  { key: "transaction_variant", label: "Variant Transaksi", collection: "sales/purchases/returns", source: "transactionVariantAudit" },
  { key: "transaction_side_effect", label: "Side-effect Transaksi", collection: "incomes/expenses/inventory_logs", source: "transactionSideEffectAudit" },
];

export const buildActorLabel = ({ profile, authSessionUser } = {}) => (
  profile?.displayName
  || profile?.username
  || profile?.email
  || authSessionUser?.email
  || authSessionUser?.uid
  || "client-ui"
);

export const mergeAuditNote = (systemNote = "", userNote = "") => {
  const cleanedSystemNote = String(systemNote || "").trim();
  const cleanedUserNote = String(userNote || "").trim();

  return [
    cleanedSystemNote,
    cleanedUserNote ? `Catatan percobaan: ${cleanedUserNote}` : "",
  ].filter(Boolean).join(" | ");
};

export const ResetActionGuide = ({
  risk = "maintenance",
  description,
  preview = "Preview / informasi dampak tersedia sesuai tombol aksi.",
  scope = "Target dijelaskan di section ini.",
  impact = "Dampak ditampilkan melalui summary, tabel preview, atau message hasil.",
  confirmation = "Ikuti konfirmasi pada tombol/modal sebelum eksekusi.",
  audit = "Dicatat ke Riwayat Maintenance bila action membuat audit log.",
}) => {
  const meta = ACTION_RISK_META[risk] || ACTION_RISK_META.maintenance;

  return React.createElement(Alert, {
    type: risk === "destructive" ? "warning" : "info",
    showIcon: true,
    message: React.createElement(
      Space,
      { wrap: true },
      React.createElement("span", null, description),
      React.createElement(Tag, { color: meta.color }, meta.label),
    ),
    description: React.createElement(
      Space,
      { direction: "vertical", size: 2 },
      React.createElement(Text, null, React.createElement(Text, { strong: true }, "Preview:"), ` ${preview}`),
      React.createElement(Text, null, React.createElement(Text, { strong: true }, "Target:"), ` ${scope}`),
      React.createElement(Text, null, React.createElement(Text, { strong: true }, "Dampak:"), ` ${impact}`),
      React.createElement(Text, null, React.createElement(Text, { strong: true }, "Konfirmasi:"), ` ${confirmation}`),
      React.createElement(Text, null, React.createElement(Text, { strong: true }, "Audit/Error Trail:"), ` ${audit}`),
    ),
  });
};

export const resetStatisticValueStyle = {
  fontSize: "var(--ims-font-size-stat)",
  fontWeight: "var(--ims-font-weight-display)",
};

// IMS NOTE [AKTIF/GUARDED] - Reset Maintenance page option helpers.
// Fungsi: memusatkan opsi/guard UI reset agar halaman utama tidak menumpuk logic presentasi.
// Batasan: helper ini tidak menjalankan reset, delete, baseline restore, atau database write.
export const TRANSACTION_SIDE_EFFECT_CONFIRM_KEYWORD = "REPAIR TRANSAKSI";

export const RESET_MODULE_OPTIONS = [
  { label: "Penjualan + Income Sales", value: "sales" },
  { label: "Pembelian + Expense Purchases", value: "purchases" },
  { label: "Retur", value: "returns" },
  { label: "Production Planning / Planning Produksi", value: "production_planning_only" },
  { label: "Produksi (Lengkap)", value: "production" },
  { label: "Produksi + Inventory Log Produksi", value: "production_core_and_logs" },
  { label: "Payroll Produksi Saja", value: "production_payroll_only" },
  { label: "Produksi Data Lama Saja", value: "productions_archived_only" },
  { label: "Kas & Biaya", value: "cash_and_expenses" },
  { label: "Penyesuaian + Log Adjustment", value: "stock_adjustment_and_logs" },
  { label: "Semua Inventory Log", value: "all_inventory_logs" },
  { label: "Pricing Log", value: "pricing_logs" },
];

export const getSelectedResetModuleLabels = (selectedModules = [], moduleOptions = RESET_MODULE_OPTIONS) => {
  const labelMap = new Map(moduleOptions.map((item) => [item.value, item.label]));
  return selectedModules.map((value) => labelMap.get(value) || value);
};

export const isFullTestingResetPreviewIntent = ({ resetIntent, mode, preview } = {}) => (
  resetIntent === "full_testing_reset"
  && mode === "reset_and_zero_stock"
  && preview?.isFullTestingReset === true
);

export const getResetConfirmKeyword = (isFullTestingResetIntent = false) => (
  isFullTestingResetIntent
    ? RESET_CONFIRM_KEYWORDS.full_testing_reset
    : RESET_CONFIRM_KEYWORDS.standard
);

export const getResetBlockedReason = ({ selectedModules = [], preview = null, mode = "transaction_only" } = {}) => {
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
};

// -----------------------------------------------------------------------------
// IMS NOTE [AKTIF/UI ONLY] — helper presentasi Data Quality Audit.
// Fungsi: menyamakan warna issue dan wording summary tanpa mengubah logic audit,
// repair, reset destructive, atau kategori business rule.
// -----------------------------------------------------------------------------
export const getAuditIssueCountColor = (value) => (Number(value || 0) > 0 ? "red" : "green");

export const buildAutoDetectIssueSummaryMessage = ({ issueCount = 0, safeRepairCount = 0 } = {}) => {
  return `${Number(issueCount || 0)} issue dan ${Number(safeRepairCount || 0)} kandidat repair aman terdeteksi.`;
};
