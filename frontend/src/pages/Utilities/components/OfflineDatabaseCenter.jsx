import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  Timeline,
  Upload,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  HddOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SwapOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import { REPOSITORY_MODES } from "../../../data/repositories/repositoryMode";
import { getRepositoryModeStatus } from "../../../data/repositories/repositoryModeService";
import {
  createSqliteBackendBackup,
  createSqliteRestorePlan,
  downloadSqliteBackendBackup,
  executeSqliteRestore,
  getSqliteBackendBackups,
  getSqliteBackendStatus,
  getSqliteModuleRuntimeStatus,
  importSqliteBackendBackup,
} from "../../../services/System/sqliteBackendStatusService";
import SqliteBackendStatusPanel from "./SqliteBackendStatusPanel";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import "./OfflineDatabaseCenter.css";

const { Text } = Typography;
const EXTERNAL_COPY_STORAGE_KEY = "ims.sqlite.externalBackupCopyConfirmedAt";
const IMS_BACKUP_ACCEPT = ".imsbackup,.imsbak.zip";

const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");
const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const parseBackupDate = (value) => {
  if (!value) return null;
  const normalized = String(value).includes("T") ? String(value) : `${String(value).replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value) => {
  const date = parseBackupDate(value);
  if (!date) return value || "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getAgeDays = (value) => {
  const date = parseBackupDate(value);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
};

const getBackupTypeLabel = (backupType) => {
  const map = {
    manual: "Manual",
    daily: "Harian",
    monthly: "Bulanan",
    "manual-import": "Import Manual",
    "pre-update": "Sebelum Update",
    "pre-restore": "Sebelum Restore",
    "pre-reset": "Sebelum Reset",
    "pre-import": "Sebelum Import",
    archived: "Arsip",
  };
  return map[backupType] || backupType || "Backup";
};

const getBackupStorageClass = (backup = {}) => {
  if (["daily", "monthly", "manual"].includes(backup.storageClass)) return backup.storageClass;
  if (backup.backupType === "daily") return "daily";
  if (backup.backupType === "monthly") return "monthly";
  return "manual";
};

const isBackupInPeriod = (backup, period) => {
  if (period === "all") return true;
  const date = parseBackupDate(backup.created_at || backup.manifest?.createdAt);
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

const getRuntimeStatusLabel = (status) => RUNTIME_STATUS_LABELS[status] || "Perlu dicek";
const getRuntimeScopeLabel = (scope) => RUNTIME_SCOPE_LABELS[scope] || "Area modul";

const getBackupStatusTone = (backup) => {
  if (!backup) return { color: "red", text: "Belum ada backup" };
  if (backup.fileExists === false) return { color: "red", text: "File backup tidak ditemukan" };
  const ageDays = getAgeDays(backup.created_at);
  if (ageDays === null) return { color: "orange", text: "Tanggal backup tidak jelas" };
  if (ageDays > 1) return { color: "orange", text: `Backup terakhir ${ageDays} hari lalu` };
  return { color: "green", text: "Backup hari ini aman" };
};

const renderSelectedBackupSummary = (backup) => {
  if (!backup) return null;
  const manifest = backup.manifest || {};
  return (
    <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
      <Descriptions.Item label="Jenis">{getBackupTypeLabel(backup.backupType)}</Descriptions.Item>
      <Descriptions.Item label="Status"><Tag color={backup.status === "verified" || backup.status === "success" ? "green" : "orange"}>{backup.status || "unknown"}</Tag></Descriptions.Item>
      <Descriptions.Item label="Tanggal">{formatDateTime(backup.created_at || manifest.createdAt)}</Descriptions.Item>
      <Descriptions.Item label="Ukuran Paket">{formatBytes(backup.size_bytes || backup.sizeBytes)}</Descriptions.Item>
      <Descriptions.Item label="Schema">{manifest.schemaVersion || "-"}</Descriptions.Item>
      <Descriptions.Item label="Integrity">{manifest.integrityCheck || "-"}</Descriptions.Item>
      <Descriptions.Item label="File" span={{ xs: 1, md: 2 }}>
        <Text copyable ellipsis style={{ maxWidth: "100%" }}>{backup.filename}</Text>
      </Descriptions.Item>
    </Descriptions>
  );
};

// =====================================================
// SECTION: OfflineDatabaseCenter — AKTIF / DATABASE CENTER
// Fungsi:
// - Menggantikan UI penyimpanan browser lama dengan pusat kontrol database lokal.
// - Tidak menjalankan sinkronisasi lama, conflict resolver, atau backup penyimpanan browser.
// - Modul guarded stock/purchase/sales/finance/production tetap tidak dimutasi offline.
// =====================================================
const OfflineDatabaseCenter = () => {
  const { message: appMessage, modal } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupImportLoading, setBackupImportLoading] = useState(false);
  const [downloadingBackupFilename, setDownloadingBackupFilename] = useState("");
  const [restorePlanLoading, setRestorePlanLoading] = useState(false);
  const [restoreExecuteLoading, setRestoreExecuteLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [moduleRuntimeStatus, setModuleRuntimeStatus] = useState(null);
  const [restorePlan, setRestorePlan] = useState(null);
  const [backups, setBackups] = useState([]);
  const [selectedBackupFilename, setSelectedBackupFilename] = useState("");
  const [backupTypeFilter, setBackupTypeFilter] = useState("all");
  const [backupPeriodFilter, setBackupPeriodFilter] = useState("all");
  const [restoreKeyword, setRestoreKeyword] = useState("");
  const [selectedImportBackupFile, setSelectedImportBackupFile] = useState(null);
  const [externalCopyConfirmedAt, setExternalCopyConfirmedAt] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(EXTERNAL_COPY_STORAGE_KEY) || "";
  });

  const statusData = status?.data || {};
  const moduleRuntimeData = moduleRuntimeStatus?.data || {};
  const moduleRuntimeModules = moduleRuntimeData.modules || [];
  const moduleRuntimeSummary = moduleRuntimeData.summary || {};
  const modeTag = useMemo(() => <Tag color="green">Aktif</Tag>, []);
  const latestBackup = backups[0] || statusData.latestBackup || null;
  const filteredBackups = useMemo(() => backups.filter((backup) => {
    const matchesType = backupTypeFilter === "all" || getBackupStorageClass(backup) === backupTypeFilter;
    return matchesType && isBackupInPeriod(backup, backupPeriodFilter);
  }), [backupPeriodFilter, backupTypeFilter, backups]);
  const backupTone = getBackupStatusTone(latestBackup);
  const selectedBackup = backups.find((backup) => backup.filename === selectedBackupFilename) || latestBackup;
  const restoreKeywordRequired = statusData.restoreConfirmKeyword || restorePlan?.requiredConfirmKeyword || "RESTORE DATABASE";
  const restoreReady = Boolean(restorePlan?.validForRestore && selectedBackupFilename && restoreKeyword.trim() === restoreKeywordRequired);
  const externalCopyAgeDays = externalCopyConfirmedAt ? getAgeDays(externalCopyConfirmedAt) : null;

  const loadCenterData = useCallback(async ({ showSuccess = false } = {}) => {
    setLoading(true);
    try {
      const [modeStatus, nextStatus, nextBackups, nextModuleRuntimeStatus] = await Promise.all([
        getRepositoryModeStatus(),
        getSqliteBackendStatus(),
        getSqliteBackendBackups(),
        getSqliteModuleRuntimeStatus(),
      ]);
      const backupRows = nextBackups?.data || [];
      void modeStatus;
      setStatus(nextStatus);
      setBackups(backupRows);
      setSelectedBackupFilename((previous) => previous || backupRows[0]?.filename || "");
      setModuleRuntimeStatus(nextModuleRuntimeStatus);
      if (showSuccess) appMessage.success("Status Database Center diperbarui.");
    } catch (error) {
      console.error("Gagal memuat Database Center:", error);
      appMessage.error(error?.message || "Layanan database belum bisa diakses.");
      const modeStatus = await getRepositoryModeStatus().catch(() => ({ mode: REPOSITORY_MODES.SQLITE_SIDECAR }));
      void modeStatus;
    } finally {
      setLoading(false);
    }
  }, [appMessage]);

  useEffect(() => {
    loadCenterData();
  }, [loadCenterData]);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const result = await createSqliteBackendBackup({ backupType: "manual" });
      appMessage.success(result?.message || "Backup database berhasil dibuat dan diverifikasi.");
      await loadCenterData();
    } catch (error) {
      appMessage.error(error?.message || "Backup database gagal.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleMarkExternalCopy = () => {
    const now = new Date().toISOString();
    if (typeof window !== "undefined") window.localStorage.setItem(EXTERNAL_COPY_STORAGE_KEY, now);
    setExternalCopyConfirmedAt(now);
    appMessage.success("Checklist copy backup eksternal ditandai selesai untuk minggu ini.");
  };

  const handleDownloadBackup = async (backup) => {
    if (!backup?.filename) return;
    setDownloadingBackupFilename(backup.filename);
    try {
      const { blob, filename } = await downloadSqliteBackendBackup(backup.filename);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename || backup.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      appMessage.success("File Backup IMS siap disimpan.");
    } catch (error) {
      appMessage.error(error?.message || "Download backup gagal.");
    } finally {
      setDownloadingBackupFilename("");
    }
  };

  const handleImportBackup = async () => {
    if (!selectedImportBackupFile) {
      appMessage.warning("Pilih file backup .imsbackup terlebih dahulu.");
      return;
    }

    setBackupImportLoading(true);
    try {
      const result = await importSqliteBackendBackup(selectedImportBackupFile);
      const importedFilename = result?.data?.filename || "";
      appMessage.success(result?.message || "File Backup IMS berhasil diimport dan diverifikasi.");
      setSelectedImportBackupFile(null);
      setRestorePlan(null);
      setRestoreKeyword("");
      await loadCenterData();
      if (importedFilename) setSelectedBackupFilename(importedFilename);
    } catch (error) {
      appMessage.error(error?.message || "Import File Backup IMS gagal.");
    } finally {
      setBackupImportLoading(false);
    }
  };

  const handleCreateRestorePlan = async () => {
    setRestorePlanLoading(true);
    try {
      const filename = selectedBackupFilename || selectedBackup?.filename || "";
      const result = await createSqliteRestorePlan(filename ? { filename } : {});
      setRestorePlan(result?.data || null);
      appMessage.success(result?.message || "Restore preview berhasil dibuat.");
      await loadCenterData();
    } catch (error) {
      appMessage.error(error?.message || "Restore preview gagal dibuat.");
    } finally {
      setRestorePlanLoading(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreReady) {
      appMessage.warning("Pilih backup, buat preview valid, lalu ketik keyword konfirmasi dengan benar.");
      return;
    }

    modal.confirm({
      title: "Jalankan restore database?",
      icon: <ExclamationCircleOutlined />,
      content: (
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Text>Database aktif akan diganti oleh backup yang dipilih.</Text>
          <Text strong>{selectedBackupFilename}</Text>
          <Text type="secondary">Sistem akan membuat backup pre-restore otomatis sebelum overwrite.</Text>
        </Space>
      ),
      okText: "Restore Sekarang",
      okButtonProps: { danger: true },
      cancelText: "Batal",
      onOk: async () => {
        setRestoreExecuteLoading(true);
        try {
          const result = await executeSqliteRestore({
            filename: selectedBackupFilename,
            confirmKeyword: restoreKeyword,
          });
          appMessage.success(result?.message || "Restore database berhasil dijalankan. Refresh aplikasi bila diperlukan.");
          setRestoreKeyword("");
          setRestorePlan(null);
          await loadCenterData();
        } catch (error) {
          appMessage.error(error?.message || "Restore database gagal dijalankan.");
        } finally {
          setRestoreExecuteLoading(false);
        }
      },
    });
  };

  const statusTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <SqliteBackendStatusPanel />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Customers" value={formatNumber(statusData.customerCount)} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Categories" value={formatNumber(statusData.categoryCount)} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Audit Logs" value={formatNumber(statusData.auditCount)} prefix={<SafetyOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Backup" value={formatNumber(statusData.backupCount)} prefix={<HddOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Restore Plan" value={formatNumber(statusData.restorePlanCount)} prefix={<SafetyOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Modul Aplikasi" value={formatNumber(statusData.moduleRuntimeStatusCount ?? statusData.migrationStatusCount)} prefix={<SwapOutlined />} />
          </Card>
        </Col>
      </Row>

      <Descriptions size="small" bordered column={{ xs: 1, lg: 2 }}>
        <Descriptions.Item label="Status Layanan">{modeTag}</Descriptions.Item>
        <Descriptions.Item label="Schema DB">{statusData.schemaVersion || "-"}</Descriptions.Item>
        <Descriptions.Item label="Restore Mode"><Tag color="orange">{statusData.restoreMode || "preview_only"}</Tag></Descriptions.Item>
        <Descriptions.Item label="Format Backup"><Tag color="blue">{statusData.backupFormat || "imsbackup"}</Tag></Descriptions.Item>
        <Descriptions.Item label="Database" span={{ xs: 1, lg: 2 }}>
          <Text copyable ellipsis style={{ maxWidth: "100%" }}>{statusData.dbPath || "-"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Backup Folder" span={{ xs: 1, lg: 2 }}>
          <Text copyable ellipsis style={{ maxWidth: "100%" }}>{statusData.backupDir || "-"}</Text>
        </Descriptions.Item>
      </Descriptions>
    </Space>
  );

  const modeTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <ImsNotice
        variant="status"
        compact
        title="Database aplikasi aktif"
        description="Semua modul berjalan melalui layanan lokal dan database utama aplikasi."
      />

      <Card size="small" title="Status layanan" className="offline-db-action-card">
        <Space direction="vertical" size={8}>
          <Tag color="green">Aktif</Tag>
          <Text type="secondary">Mode database lokal aktif.</Text>
        </Space>
      </Card>

      <Timeline
        items={[
          {
            color: "green",
            dot: <CheckCircleOutlined />,
            children: "Semua modul utama membaca dan menulis melalui layanan database aplikasi.",
          },
          {
            color: "blue",
            dot: <DatabaseOutlined />,
            children: "HP/PC lain dapat mengakses aplikasi dari jaringan lokal yang sama.",
          },
          {
            color: "green",
            dot: <SafetyOutlined />,
            children: "Backup resmi dibuat sistem dalam paket .imsbackup dengan manifest, checksum, dan integrity check.",
          },
        ]}
      />
    </Space>
  );

  const backupTab = (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <div className="offline-db-status-strip offline-db-status-strip-backup">
        <div className="offline-db-status-strip-main">
          <Space size={8} wrap>
            <Tag color={backupTone.color}>{backupTone.text}</Tag>
            <Tag color="blue">.imsbackup</Tag>
          </Space>
          <Text type="secondary">
            Setiap backup resmi adalah satu file .imsbackup. Sistem menyimpan daily 60 hari, monthly 12 bulan, dan manual tanpa hapus otomatis.
          </Text>
        </div>
        <Space wrap className="offline-db-status-strip-actions">
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadCenterData({ showSuccess: true })}>
            Refresh
          </Button>
          <Button type="primary" icon={<HddOutlined />} loading={backupLoading} onClick={handleBackup}>
            Buat Backup
          </Button>
        </Space>
      </div>

      <div className="offline-db-compact-section">
        <div className="offline-db-section-heading">
          <Text strong>Backup terakhir</Text>
          <Tag color={externalCopyAgeDays !== null && externalCopyAgeDays <= 7 ? "green" : "orange"}>
            {externalCopyConfirmedAt
              ? `Copy eksternal: ${formatDateTime(externalCopyConfirmedAt)}`
              : "Copy eksternal belum ditandai"}
          </Tag>
        </div>
        {latestBackup ? renderSelectedBackupSummary(latestBackup) : (
          <ImsNotice variant="guard" compact title="Belum ada backup database." />
        )}
        <div className="offline-db-inline-note">
          <Text type="secondary">
            Backup lokal masih berada di laptop server. Minimal seminggu sekali, copy backup terbaru ke flashdisk/harddisk eksternal.
          </Text>
          <Button size="small" onClick={handleMarkExternalCopy}>Saya sudah copy ke flashdisk</Button>
        </div>
      </div>

      <div className="offline-db-compact-section">
        <div className="offline-db-section-heading">
          <div>
            <Text strong>Daftar backup</Text>
            <br />
            <Text type="secondary">Filter mingguan atau bulanan tanpa membuat folder tambahan.</Text>
          </div>
          <Space wrap size={8}>
            <Select
              value={backupTypeFilter}
              onChange={setBackupTypeFilter}
              style={{ minWidth: 140 }}
              options={[
                { value: "all", label: "Semua jenis" },
                { value: "daily", label: "Harian" },
                { value: "monthly", label: "Bulanan" },
                { value: "manual", label: "Manual" },
              ]}
            />
            <Select
              value={backupPeriodFilter}
              onChange={setBackupPeriodFilter}
              style={{ minWidth: 150 }}
              options={[
                { value: "all", label: "Semua periode" },
                { value: "today", label: "Hari ini" },
                { value: "this-week", label: "Minggu ini" },
                { value: "this-month", label: "Bulan ini" },
                { value: "last-month", label: "Bulan lalu" },
              ]}
            />
          </Space>
        </div>
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          {filteredBackups.slice(0, 50).map((backup) => (
            <div className="offline-db-backup-list-item" key={backup.id || backup.filename}>
              <div className="offline-db-backup-list-main">
                <Space wrap size={6}>
                  <Tag color={backup.status === "verified" || backup.status === "success" ? "green" : "orange"}>{backup.status || "unknown"}</Tag>
                  <Tag color="blue">{getBackupTypeLabel(backup.backupType)}</Tag>
                  <Text type="secondary">{formatBytes(backup.size_bytes || backup.sizeBytes)}</Text>
                </Space>
                <Text strong ellipsis>{backup.filename}</Text>
                <Text type="secondary">{formatDateTime(backup.created_at)} · Schema {backup.manifest?.schemaVersion || "-"}</Text>
              </div>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                loading={downloadingBackupFilename === backup.filename}
                onClick={() => handleDownloadBackup(backup)}
              >
                Download
              </Button>
            </div>
          ))}
        </Space>
        {!filteredBackups.length ? (
          <ImsNotice
            variant="guard"
            compact
            title={backups.length ? "Tidak ada backup yang cocok dengan filter." : "Belum ada backup database."}
          />
        ) : null}
      </div>
    </Space>
  );

  const runtimeTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <ImsNotice
        variant="status"
        compact
        title="Status layanan modul"
        description="Semua modul utama berjalan melalui layanan database lokal. Restore tetap memakai guard konfirmasi."
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Database Aktif" value={formatNumber(moduleRuntimeSummary.sqlite_active)} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Siap Dipakai" value={formatNumber(moduleRuntimeSummary.runtime_ready || 0)} prefix={<DatabaseOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Guarded" value={formatNumber(moduleRuntimeSummary.guarded)} prefix={<SafetyOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Total Modul" value={formatNumber(moduleRuntimeSummary.total)} prefix={<SwapOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        {moduleRuntimeModules.map((item) => {
          const statusColor = item.status === "sqlite_active"
            ? "green"
            : item.status === "guarded"
              ? "red"
              : item.status === "archived_inactive"
                ? "orange"
                : "blue";

          return (
            <Col xs={24} md={12} xl={8} key={item.module_key}>
              <Card size="small" className="offline-db-status-card offline-db-module-card">
                <Space direction="vertical" size={6} style={{ width: "100%" }}>
                  <Space wrap size={6}>
                    <Text strong>{item.label}</Text>
                    <Tag color={statusColor}>{getRuntimeStatusLabel(item.status)}</Tag>
                  </Space>
                  <Text type="secondary">Area: {getRuntimeScopeLabel(item.scope)}</Text>
                  <Text type="secondary">{item.notes || "-"}</Text>
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>
    </Space>
  );

  const restoreTab = (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <div className="offline-db-status-strip offline-db-status-strip-restore">
        <div className="offline-db-status-strip-main">
          <Space size={8} wrap>
            <Tag color="orange">Guarded restore</Tag>
            <Tag color="red">Full replace</Tag>
          </Space>
          <Text type="secondary">
            Restore mengganti database aktif. Alur tetap wajib import/pilih backup, preview valid, keyword konfirmasi, dan backup pre-restore otomatis.
          </Text>
        </div>
      </div>

      <div className="offline-db-restore-step">
        <div className="offline-db-step-marker">1</div>
        <div className="offline-db-step-content">
          <div className="offline-db-section-heading">
            <Text strong>Import File Backup IMS</Text>
            <Text type="secondary">Opsional jika backup berasal dari flashdisk/komputer lama.</Text>
          </div>
          <Text type="secondary">
            Import hanya mendaftarkan dan memvalidasi file. Data belum berubah sampai tombol Restore Database dijalankan.
          </Text>
          <Space wrap className="offline-db-step-actions">
            <Upload
              accept={IMS_BACKUP_ACCEPT}
              maxCount={1}
              beforeUpload={(file) => {
                setSelectedImportBackupFile(file);
                return false;
              }}
              onRemove={() => setSelectedImportBackupFile(null)}
              fileList={selectedImportBackupFile ? [selectedImportBackupFile] : []}
            >
              <Button icon={<UploadOutlined />}>Pilih File Backup IMS</Button>
            </Upload>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={backupImportLoading}
              disabled={!selectedImportBackupFile}
              onClick={handleImportBackup}
            >
              Import & Validasi
            </Button>
          </Space>
        </div>
      </div>

      <div className="offline-db-restore-step">
        <div className="offline-db-step-marker">2</div>
        <div className="offline-db-step-content">
          <div className="offline-db-section-heading">
            <Text strong>Pilih backup & preview</Text>
            <Button type="primary" icon={<SafetyOutlined />} loading={restorePlanLoading} onClick={handleCreateRestorePlan} disabled={!backups.length}>
              Preview Restore
            </Button>
          </div>
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Select
              showSearch
              style={{ width: "100%" }}
              placeholder="Pilih backup resmi"
              value={selectedBackupFilename || undefined}
              onChange={(value) => {
                setSelectedBackupFilename(value);
                setRestorePlan(null);
                setRestoreKeyword("");
              }}
              options={backups.map((backup) => ({
                value: backup.filename,
                label: `${getBackupTypeLabel(backup.backupType)} - ${formatDateTime(backup.created_at)} - ${backup.status || "unknown"}`,
              }))}
            />
            {renderSelectedBackupSummary(selectedBackup)}

            {restorePlan ? (
              <div className="offline-db-restore-preview">
                <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
                  <Descriptions.Item label="Mode"><Tag color="orange">{restorePlan.mode}</Tag></Descriptions.Item>
                  <Descriptions.Item label="Destructive"><Tag color="green">Tidak aktif saat preview</Tag></Descriptions.Item>
                  <Descriptions.Item label="Backup ditemukan">{restorePlan.backupFound ? "Ya" : "Tidak"}</Descriptions.Item>
                  <Descriptions.Item label="File backup ada">{restorePlan.backupFileExists ? "Ya" : "Tidak"}</Descriptions.Item>
                  <Descriptions.Item label="Valid untuk restore">
                    <Tag color={restorePlan.validForRestore ? "green" : "red"}>{restorePlan.validForRestore ? "Valid" : "Tidak valid"}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Integrity">{restorePlan.validation?.integrityCheck || restorePlan.manifest?.integrityCheck || "-"}</Descriptions.Item>
                </Descriptions>

                {restorePlan.manifest?.tables ? (
                  <div className="offline-db-table-counts">
                    {Object.entries(restorePlan.manifest.tables).slice(0, 12).map(([tableName, count]) => (
                      <div className="offline-db-table-count" key={tableName}>
                        <Text type="secondary">{tableName}</Text>
                        <Text strong>{formatNumber(count)}</Text>
                      </div>
                    ))}
                  </div>
                ) : null}

                {restorePlan.validationError ? (
                  <Alert type="error" showIcon message="Backup tidak lolos validasi" description={restorePlan.validationError} />
                ) : (
                  <ImsNotice
                    variant="info"
                    compact
                    title="Preview tidak mengubah data."
                    description={(restorePlan.blockedActions || []).join(" ")}
                  />
                )}
              </div>
            ) : (
              <Text type="secondary">Pilih backup lalu klik Preview Restore untuk validasi checksum, integrity check, dan ringkasan data.</Text>
            )}
          </Space>
        </div>
      </div>

      <div className="offline-db-restore-step offline-db-restore-step-danger">
        <div className="offline-db-step-marker">3</div>
        <div className="offline-db-step-content">
          <ImsNotice
            variant="critical"
            compact
            title="Restore akan mengganti database aktif."
            description="Gunakan hanya jika yakin. Sistem akan membuat backup pre-restore otomatis sebelum overwrite. Setelah berhasil, refresh aplikasi dan login ulang bila perlu."
          />
          <Text>Ketik keyword konfirmasi:</Text>
          <Input
            value={restoreKeyword}
            onChange={(event) => setRestoreKeyword(event.target.value)}
            placeholder={restoreKeywordRequired}
            disabled={!restorePlan?.validForRestore}
          />
          <Button danger type="primary" loading={restoreExecuteLoading} disabled={!restoreReady} onClick={handleExecuteRestore}>
            Restore Database
          </Button>
        </div>
      </div>
    </Space>
  );

  const qaTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <ImsNotice
        variant="guidance"
        compact
        title="Checklist wajib setelah update database"
        description="Jalankan checklist ini sebelum dipakai produksi. Pastikan layanan lokal, build frontend, backup manual, restore preview, dan copy eksternal sudah diuji."
      />
      <Card size="small" title="Manual QA" className="offline-db-action-card">
        <Timeline
          items={[
            { color: "green", children: "Layanan lokal: jalankan aplikasi dari komputer utama, lalu cek status aplikasi." },
            { color: "green", children: "Laptop/PC utama: buka halaman Kategori dan Customer." },
            { color: "green", children: "HP: buka aplikasi dari alamat lokal komputer utama dan tambah/edit customer test." },
            { color: "green", children: "Pastikan auto backup daily tidak dobel dan tetap dibuat meskipun layanan menyala melewati pergantian hari." },
            { color: "blue", children: "Pastikan daily lebih dari 60 hari hanya dibersihkan setelah monthly bulan terkait tersedia dan verified." },
            { color: "blue", children: "Pastikan satu monthly per bulan dipertahankan maksimal 12 bulan dan backup manual tidak dihapus otomatis." },
            { color: "blue", children: "Buat backup manual; pastikan hanya satu file .imsbackup tanpa manifest sidecar terpisah." },
            { color: "orange", children: "Jalankan Preview Restore pada backup terbaru; pastikan status valid sebelum tombol restore aktif." },
            { color: "orange", children: "Copy backup verified ke flashdisk/harddisk eksternal dan tandai checklist eksternal." },
          ]}
        />
      </Card>
    </Space>
  );

  const tabs = [
    { key: "status", label: "Status", children: statusTab },
    { key: "mode", label: "Mode", children: modeTab },
    { key: "backup", label: "Backup", children: backupTab },
    { key: "restore", label: "Restore", children: restoreTab },
    { key: "runtime", label: "Modul Aplikasi", children: runtimeTab },
    { key: "qa", label: "Checklist", children: qaTab },
  ];

  return (
    <div className="offline-db-center">
      <div className="offline-db-toolbar">
        <div className="offline-db-toolbar-main">
          <Space size={10} wrap>
            <SwapOutlined />
            <Text strong>Database Center</Text>
            {modeTag}
          </Space>
          <Text type="secondary">
            Database lokal, backup .imsbackup, import, preview restore, dan status modul dalam satu panel compact.
          </Text>
        </div>
        <Space size={8} wrap className="offline-db-toolbar-actions">
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => loadCenterData({ showSuccess: true })}>
            Refresh
          </Button>
          <Tag color={backupTone.color}>{backupTone.text}</Tag>
          <Tag color="green">Layanan aktif</Tag>
        </Space>
      </div>

      <Tabs className="offline-db-tabs" items={tabs} />
    </div>
  );
};

export default OfflineDatabaseCenter;
