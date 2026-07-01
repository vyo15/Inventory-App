import { Space, Tag, Typography } from "antd";
import InfoPopoverButton from "../../../components/Layout/Feedback/InfoPopoverButton";
import StatusTag from "../../../components/Layout/Feedback/StatusTag";
import { formatDateTimeId, getDateAgeDays, parseDateTimeId } from "../../../utils/formatters/dateId";
import { formatFileSizeId } from "../../../utils/formatters/fileSizeId";
import { formatNumberId } from "../../../utils/formatters/numberId";
import { getBackupTypeLabel } from "../utils/backupUiFormatters";
import {
  getBackupCreatedAt,
  getBackupRegisteredAt,
  getImportedSourceFilename,
} from "./restorePreviewHelpers";

const { Text } = Typography;

export const IMS_BACKUP_ACCEPT = ".imsbackup,.imsbak.zip";
export const LIVE_STATUS_REFRESH_INTERVAL_MS = 15_000;
export const BACKUP_PAGE_SIZE = 10;

export const formatNumber = formatNumberId;
export const formatCount = (value) => (
  value === null || value === undefined ? "Belum tersedia" : formatNumber(value)
);
export const formatBytes = formatFileSizeId;
const parseBackupDate = parseDateTimeId;
export const formatDateTime = (value) => formatDateTimeId(value, { fallback: value || "-" });
export const getAgeDays = getDateAgeDays;

export const getBackupStorageClass = (backup = {}) => {
  if (["daily", "monthly", "manual"].includes(backup.storageClass)) return backup.storageClass;
  if (backup.backupType === "daily") return "daily";
  if (backup.backupType === "monthly") return "monthly";
  return "manual";
};

export const isBackupInPeriod = (backup, period) => {
  if (period === "all") return true;
  const date = parseBackupDate(getBackupCreatedAt(backup));
  if (!date) return false;

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  if (period === "today") return date >= startToday && date < startTomorrow;

  if (period === "this-week") {
    const startWeek = new Date(startToday);
    const day = startWeek.getDay() || 7;
    startWeek.setDate(startWeek.getDate() - day + 1);
    return date >= startWeek && date < startTomorrow;
  }

  if (period === "this-month") {
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return date >= startMonth && date < nextMonth;
  }

  if (period === "last-month") {
    const startMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return date >= startMonth && date < endMonth;
  }

  return true;
};

const RUNTIME_STATUS_LABELS = {
  sqlite_active: "Database aktif",
  guarded: "Butuh konfirmasi",
  archived_inactive: "Nonaktif",
  unknown: "Perlu dicek",
};

const RUNTIME_SCOPE_LABELS = {
  read_write: "Baca/tulis data",
  read_write_master: "Master data",
  read_write_master_payload: "Master data dan katalog",
  read_write_master_stock: "Master data dan stok",
  atomic_product_raw_semi: "Stok produk, bahan, dan semi finished",
  atomic_stock_finance: "Stok dan keuangan",
  product_raw_stock_restore_guarded_refund: "Retur barang dan pemulihan stok",
  cash_in_cash_out_ledger: "Kas masuk, kas keluar, dan ledger",
  production_runtime: "Alur produksi",
  payroll_paid_hpp: "Payroll final dan HPP",
  transactions_finance_stock: "Laporan transaksi, keuangan, dan stok",
  local_auth_only: "Login dan role user",
  confirm_keyword_required: "Aksi wajib konfirmasi",
};

export const getRuntimeStatusLabel = (status) => RUNTIME_STATUS_LABELS[status] || "Perlu dicek";
export const getRuntimeScopeLabel = (scope) => RUNTIME_SCOPE_LABELS[scope] || "Area modul";

export const getBackupStatusTone = (backup) => {
  if (!backup) return { color: "red", text: "Belum ada backup" };
  if (backup.fileExists === false) return { color: "red", text: "File backup tidak ditemukan" };
  const ageDays = getAgeDays(getBackupCreatedAt(backup));
  if (ageDays === null) return { color: "orange", text: "Tanggal backup tidak jelas" };
  if (ageDays > 1) return { color: "orange", text: `Backup terakhir ${ageDays} hari lalu` };
  return { color: "green", text: "Backup hari ini aman" };
};

export const renderSelectedBackupSummary = (backup) => {
  if (!backup) return null;
  const manifest = backup.manifest || {};
  const createdAt = getBackupCreatedAt(backup);
  const registeredAt = getBackupRegisteredAt(backup);
  const sourceFilename = getImportedSourceFilename(backup.filename);
  const showRegisteredAt = Boolean(sourceFilename && registeredAt);
  const verified = backup.status === "verified" || backup.status === "success";

  return (
    <div className="offline-db-selected-backup-summary">
      <div className="offline-db-selected-backup-main">
        <Space size={6} wrap>
          <Text strong>{getBackupTypeLabel(backup.backupType)}</Text>
          <Tag color={verified ? "green" : "orange"}>{verified ? "Terverifikasi" : "Perlu diperiksa"}</Tag>
        </Space>
        <Text type="secondary">
          {formatDateTime(createdAt)} · {formatBytes(backup.size_bytes || backup.sizeBytes)}
        </Text>
      </div>
      <InfoPopoverButton
        label="Detail"
        title="Detail file backup"
        description="Informasi teknis disembunyikan dari tampilan utama agar daftar backup tetap ringkas."
        items={[
          { label: "Nama file", value: backup.filename || "-" },
          { label: "Schema", value: manifest.schemaVersion || "-" },
          { label: "Integrity", value: manifest.integrityCheck || "-" },
          showRegisteredAt ? { label: "Terdaftar", value: formatDateTime(registeredAt) } : null,
          sourceFilename ? { label: "Sumber import", value: sourceFilename } : null,
        ]}
      />
    </div>
  );
};

const getDeltaLabel = (delta) => {
  if (delta === null || delta === undefined) return "Belum tersedia";
  const normalizedDelta = Number(delta || 0);
  if (normalizedDelta === 0) return "Tetap";
  return normalizedDelta > 0 ? `+${formatNumber(normalizedDelta)}` : formatNumber(normalizedDelta);
};

const getDeltaColor = (delta) => {
  if (delta === null || delta === undefined) return "default";
  const normalizedDelta = Number(delta || 0);
  if (normalizedDelta === 0) return "default";
  return normalizedDelta > 0 ? "green" : "orange";
};

export const renderCoverageSummary = (groups = [], { comparison = false } = {}) => (
  <div className="offline-db-coverage-grid">
    {groups.filter((group) => !group.technical).map((group) => (
      <div className="offline-db-coverage-card" key={group.key}>
        <div className="offline-db-coverage-card-heading">
          <Text strong>{group.label}</Text>
          {comparison ? (
            <Tag color={getDeltaColor(group.delta)}>{getDeltaLabel(group.delta)}</Tag>
          ) : (
            <Tag color={group.complete ? "blue" : "default"}>{formatCount(group.total)}</Tag>
          )}
        </div>
        <Text type="secondary">{group.description}</Text>
        {comparison ? (
          <div className="offline-db-comparison-values">
            <span><Text type="secondary">Saat ini</Text><Text strong>{formatCount(group.currentTotal)}</Text></span>
            <span><Text type="secondary">Isi backup</Text><Text strong>{formatCount(group.backupTotal)}</Text></span>
          </div>
        ) : null}
      </div>
    ))}
  </div>
);

export const buildCoverageCollapseItems = (groups = [], { comparison = false } = {}) => groups.map((group) => ({
  key: group.key,
  label: (
    <Space size={8} wrap>
      <Text strong>{group.label}</Text>
      {group.technical ? <Tag>Teknis</Tag> : null}
      {comparison ? (
        <>
          <Tag color={group.backupTotal === null ? "default" : "blue"}>Backup {formatCount(group.backupTotal)}</Tag>
          <Tag color={getDeltaColor(group.delta)}>{getDeltaLabel(group.delta)}</Tag>
        </>
      ) : (
        <Tag color={group.complete ? "blue" : "default"}>{formatCount(group.total)}</Tag>
      )}
    </Space>
  ),
  children: (
    <div className={`offline-db-detail-counts${comparison ? " offline-db-detail-counts-comparison" : ""}`}>
      {group.rows.map((row) => (
        <div className="offline-db-detail-count" key={row.table}>
          <div className="offline-db-detail-count-main">
            <Text>{row.label}</Text>
            <Text type="secondary" code>{row.table}</Text>
          </div>
          {comparison ? (
            <div className="offline-db-detail-count-values">
              <span><Text type="secondary">Saat ini</Text><Text strong>{formatCount(row.currentCount)}</Text></span>
              <span><Text type="secondary">Backup</Text><Text strong>{formatCount(row.backupCount)}</Text></span>
              <Tag color={getDeltaColor(row.delta)}>{getDeltaLabel(row.delta)}</Tag>
            </div>
          ) : row.statusAware ? (
            <div className="offline-db-detail-status-values">
              <StatusTag tone="success">Aktif {formatCount(row.activeCount)}</StatusTag>
              {Number(row.inactiveCount || 0) > 0 ? (
                <Tag color="orange">Nonaktif {formatCount(row.inactiveCount)}</Tag>
              ) : null}
              {Number(row.deletedCount || 0) > 0 ? (
                <Tag color="default">Arsip histori {formatCount(row.deletedCount)}</Tag>
              ) : null}
              <Text strong>{formatCount(row.storedTotal)} tersimpan</Text>
            </div>
          ) : (
            <Text strong>{formatCount(row.count)}</Text>
          )}
        </div>
      ))}
    </div>
  ),
}));
