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
export const getCollectionLabels = (collections = []) => (
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
export const renderCompactText = (value, maxWidth = 220, fallback = "-") => {
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

export const renderCompactTag = (value, maxWidth = 160, fallback = "-") => {
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
  { key: "legacy", label: "Data Lama", collection: "legacy", source: "legacyDataAudit" },
  { key: "production", label: "Produksi", collection: "production_*", source: "maintenanceAudit" },
  { key: "payroll", label: "Payroll Snapshot", collection: "production_payrolls", source: "payrollAudit" },
  { key: "transaction_variant", label: "Variant Transaksi", collection: "sales/purchases/returns", source: "transactionVariantAudit" },
  { key: "transaction_side_effect", label: "Side-effect Transaksi", collection: "incomes/expenses/inventory_logs", source: "transactionSideEffectAudit" },
];

export const buildActorLabel = ({ profile, firebaseUser } = {}) => (
  profile?.displayName
  || profile?.username
  || profile?.email
  || firebaseUser?.email
  || firebaseUser?.uid
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

export const resetStatisticValueStyle = {
  fontSize: "var(--ims-font-size-stat)",
  fontWeight: "var(--ims-font-weight-display)",
};
