import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  Timeline,
  Typography,
  message,
  theme,
} from "antd";
import {
  CheckCircleOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  HddOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SwapOutlined,
} from "@ant-design/icons";

import { REPOSITORY_MODES } from "../../../data/repositories/repositoryMode";
import { getRepositoryModeStatus } from "../../../data/repositories/repositoryModeService";
import {
  createSqliteBackendBackup,
  createSqliteRestorePlan,
  executeSqliteRestore,
  getSqliteBackendBackups,
  getSqliteBackendStatus,
  getSqliteModuleRuntimeStatus,
} from "../../../services/System/sqliteBackendStatusService";
import SqliteBackendStatusPanel from "./SqliteBackendStatusPanel";
import "./OfflineDatabaseCenter.css";

const { Text, Title } = Typography;
const EXTERNAL_COPY_STORAGE_KEY = "ims.sqlite.externalBackupCopyConfirmedAt";

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
    "pre-update": "Sebelum Update",
    "pre-restore": "Sebelum Restore",
    "pre-reset": "Sebelum Reset",
    "pre-import": "Sebelum Import",
    archived: "Arsip",
  };
  return map[backupType] || backupType || "Backup";
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
      <Descriptions.Item label="File" span={2}>
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
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restorePlanLoading, setRestorePlanLoading] = useState(false);
  const [restoreExecuteLoading, setRestoreExecuteLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [moduleRuntimeStatus, setModuleRuntimeStatus] = useState(null);
  const [restorePlan, setRestorePlan] = useState(null);
  const [backups, setBackups] = useState([]);
  const [selectedBackupFilename, setSelectedBackupFilename] = useState("");
  const [restoreKeyword, setRestoreKeyword] = useState("");
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
      if (showSuccess) message.success("Status Database Center diperbarui.");
    } catch (error) {
      console.error("Gagal memuat Database Center:", error);
      message.error(error?.message || "Layanan database belum bisa diakses.");
      const modeStatus = await getRepositoryModeStatus().catch(() => ({ mode: REPOSITORY_MODES.SQLITE_SIDECAR }));
      void modeStatus;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCenterData();
  }, [loadCenterData]);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const result = await createSqliteBackendBackup({ backupType: "manual" });
      message.success(result?.message || "Backup database berhasil dibuat dan diverifikasi.");
      await loadCenterData();
    } catch (error) {
      message.error(error?.message || "Backup database gagal.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleMarkExternalCopy = () => {
    const now = new Date().toISOString();
    if (typeof window !== "undefined") window.localStorage.setItem(EXTERNAL_COPY_STORAGE_KEY, now);
    setExternalCopyConfirmedAt(now);
    message.success("Checklist copy backup eksternal ditandai selesai untuk minggu ini.");
  };

  const handleCreateRestorePlan = async () => {
    setRestorePlanLoading(true);
    try {
      const filename = selectedBackupFilename || selectedBackup?.filename || "";
      const result = await createSqliteRestorePlan(filename ? { filename } : {});
      setRestorePlan(result?.data || null);
      message.success(result?.message || "Restore preview berhasil dibuat.");
      await loadCenterData();
    } catch (error) {
      message.error(error?.message || "Restore preview gagal dibuat.");
    } finally {
      setRestorePlanLoading(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreReady) {
      message.warning("Pilih backup, buat preview valid, lalu ketik keyword konfirmasi dengan benar.");
      return;
    }

    Modal.confirm({
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
          message.success(result?.message || "Restore database berhasil dijalankan. Refresh aplikasi bila diperlukan.");
          setRestoreKeyword("");
          setRestorePlan(null);
          await loadCenterData();
        } catch (error) {
          message.error(error?.message || "Restore database gagal dijalankan.");
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
        <Descriptions.Item label="Format Backup"><Tag color="blue">{statusData.backupFormat || "imsbak"}</Tag></Descriptions.Item>
        <Descriptions.Item label="Database" span={2}>
          <Text copyable ellipsis style={{ maxWidth: "100%" }}>{statusData.dbPath || "-"}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="Backup Folder" span={2}>
          <Text copyable ellipsis style={{ maxWidth: "100%" }}>{statusData.backupDir || "-"}</Text>
        </Descriptions.Item>
      </Descriptions>
    </Space>
  );

  const modeTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type="success"
        showIcon
        message="Database aplikasi aktif"
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
            children: "Backup resmi dibuat sistem dalam paket .imsbak.zip dengan manifest, checksum, dan integrity check.",
          },
        ]}
      />
    </Space>
  );

  const backupTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type={backupTone.color === "green" ? "success" : backupTone.color === "orange" ? "warning" : "error"}
        showIcon
        message={backupTone.text}
        description="Backup resmi dibuat dalam format .imsbak.zip. Copy backup yang sudah verified ke flashdisk atau harddisk eksternal secara rutin."
      />

      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Card size="small" className="offline-db-action-card" title="Status Backup Terakhir">
            {latestBackup ? renderSelectedBackupSummary(latestBackup) : (
              <Alert type="warning" showIcon message="Belum ada backup database." />
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" className="offline-db-action-card" title="Checklist Backup Eksternal">
            <Space direction="vertical" size={10} style={{ width: "100%" }}>
              <Text type="secondary">
                Backup lokal masih berada di laptop server. Minimal seminggu sekali, copy backup terbaru ke flashdisk/harddisk eksternal.
              </Text>
              <Tag color={externalCopyAgeDays !== null && externalCopyAgeDays <= 7 ? "green" : "orange"}>
                {externalCopyConfirmedAt
                  ? `Terakhir ditandai: ${formatDateTime(externalCopyConfirmedAt)}`
                  : "Belum pernah ditandai"}
              </Tag>
              <Button onClick={handleMarkExternalCopy}>Saya sudah copy ke flashdisk</Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        className="offline-db-action-card"
        title="Backup Database"
        extra={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadCenterData({ showSuccess: true })}>
              Refresh
            </Button>
            <Button type="primary" icon={<HddOutlined />} loading={backupLoading} onClick={handleBackup}>
              Buat Backup Sekarang
            </Button>
          </Space>
        )}
      >
        <Row gutter={[12, 12]}>
          {backups.slice(0, 6).map((backup) => (
            <Col xs={24} md={12} xl={8} key={backup.id || backup.filename}>
              <Card size="small" className="offline-db-status-card">
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <Space wrap size={6}>
                    <Tag color={backup.status === "verified" || backup.status === "success" ? "green" : "orange"}>{backup.status || "unknown"}</Tag>
                    <Tag color="blue">{getBackupTypeLabel(backup.backupType)}</Tag>
                  </Space>
                  <Text strong ellipsis>{backup.filename}</Text>
                  <Text type="secondary">{formatBytes(backup.size_bytes || backup.sizeBytes)}</Text>
                  <Text type="secondary">{formatDateTime(backup.created_at)}</Text>
                  <Text type="secondary">Schema: {backup.manifest?.schemaVersion || "-"}</Text>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
        {!backups.length ? (
          <Alert style={{ marginTop: 12 }} type="warning" showIcon message="Belum ada backup database." />
        ) : null}
      </Card>
    </Space>
  );

  const runtimeTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type="success"
        showIcon
        message="Status layanan modul"
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
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type="warning"
        showIcon
        message="Restore database memakai alur aman"
        description="Restore wajib pilih backup resmi, preview valid, keyword konfirmasi, dan sistem otomatis membuat backup pre-restore sebelum mengganti database aktif."
      />
      <Card
        size="small"
        title="Pilih Backup"
        className="offline-db-action-card"
        extra={(
          <Button type="primary" icon={<SafetyOutlined />} loading={restorePlanLoading} onClick={handleCreateRestorePlan} disabled={!backups.length}>
            Preview Restore
          </Button>
        )}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
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
        </Space>
      </Card>

      <Card size="small" title="Restore Preview" className="offline-db-action-card">
        {restorePlan ? (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
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
              <Card size="small" className="offline-db-status-card" title="Ringkasan Isi Backup">
                <Row gutter={[8, 8]}>
                  {Object.entries(restorePlan.manifest.tables).slice(0, 12).map(([tableName, count]) => (
                    <Col xs={12} md={8} xl={6} key={tableName}>
                      <Text type="secondary">{tableName}</Text>
                      <br />
                      <Text strong>{formatNumber(count)}</Text>
                    </Col>
                  ))}
                </Row>
              </Card>
            ) : null}

            {restorePlan.validationError ? (
              <Alert type="error" showIcon message="Backup tidak lolos validasi" description={restorePlan.validationError} />
            ) : (
              <Alert
                type="info"
                showIcon
                message="Preview tidak mengubah data."
                description={(restorePlan.blockedActions || []).join(" ")}
              />
            )}
          </Space>
        ) : (
          <Text type="secondary">Pilih backup lalu klik Preview Restore untuk validasi checksum, integrity check, dan ringkasan data.</Text>
        )}
      </Card>

      <Card size="small" title="Eksekusi Restore" className="offline-db-action-card offline-db-danger-card">
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <Alert
            type="error"
            showIcon
            message="Restore akan mengganti database aktif."
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
        </Space>
      </Card>
    </Space>
  );

  const qaTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type="warning"
        showIcon
        message="Checklist wajib setelah update database"
        description="Jalankan checklist ini sebelum dipakai produksi. Pastikan layanan lokal, build frontend, backup manual, restore preview, dan copy eksternal sudah diuji."
      />
      <Card size="small" title="Manual QA" className="offline-db-action-card">
        <Timeline
          items={[
            { color: "green", children: "Layanan lokal: jalankan aplikasi dari komputer utama, lalu cek status aplikasi." },
            { color: "green", children: "Laptop/PC utama: buka halaman Kategori dan Customer." },
            { color: "green", children: "HP: buka aplikasi dari alamat lokal komputer utama dan tambah/edit customer test." },
            { color: "green", children: "Restart layanan lokal; pastikan auto backup harian tidak dobel di hari yang sama." },
            { color: "blue", children: "Buat backup manual; pastikan paket .imsbak.zip, manifest, checksum, dan audit log maintenance tercatat." },
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
    <Card
      size="small"
      className="offline-db-center"
      title={(
        <Space size={10}>
          <SwapOutlined />
          <span>Database Center</span>
          {modeTag}
        </Space>
      )}
      extra={(
        <Space size={8} wrap>
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => loadCenterData({ showSuccess: true })}>
            Refresh
          </Button>
          <Tag color={backupTone.color}>{backupTone.text}</Tag>
          <Tag color="green">Layanan lokal aktif</Tag>
          <Tag color="blue">Database lokal aktif</Tag>
        </Space>
      )}
      styles={{
        header: {
          background: token.colorBgContainer,
          borderBottomColor: token.colorBorderSecondary,
        },
      }}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div className="offline-db-hero" style={{ background: token.colorBgElevated, borderColor: token.colorBorderSecondary }}>
          <div>
            <Text type="secondary">Database lokal</Text>
            <Title level={4} style={{ margin: "2px 0 4px" }}>Satu database untuk laptop dan HP</Title>
            <Text type="secondary">
              Aplikasi tetap berbasis web. Data disimpan di database lokal melalui layanan aplikasi. Backup resmi tersedia dalam format .imsbak.zip agar bisa dipreview, dicek checksum, dan direstore dengan aman.
            </Text>
          </div>
          <Space direction="vertical" size={4} align="end">
            {modeTag}
            <Text type="secondary">Modul aplikasi: semua aktif</Text>
            <Text type="secondary">Backup: {backupTone.text}</Text>
          </Space>
        </div>
        <Divider style={{ margin: 0 }} />
        <Tabs className="offline-db-tabs" items={tabs} />
      </Space>
    </Card>
  );
};

export default OfflineDatabaseCenter;
