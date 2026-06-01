import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Row,
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
  ApiOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  HddOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SwapOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import { REPOSITORY_MODES } from "../../../data/repositories/repositoryMode";
import {
  FIREBASE_REPOSITORY_CONFIRMATION,
  getRepositoryModeStatus,
  setRepositoryModeForDevelopment,
  SQLITE_REPOSITORY_CONFIRMATION,
} from "../../../data/repositories/repositoryModeService";
import {
  createSqliteBackendBackup,
  createSqliteRestorePlan,
  getSqliteBackendBackups,
  getSqliteBackendStatus,
  getSqliteMigrationStatus,
} from "../../../services/System/sqliteBackendStatusService";
import SqliteBackendStatusPanel from "./SqliteBackendStatusPanel";
import "./OfflineDatabaseCenter.css";

const { Text, Title } = Typography;

const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");
const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const isSqliteMode = (mode) => mode === REPOSITORY_MODES.SQLITE_SIDECAR;

// =====================================================
// SECTION: OfflineDatabaseCenter — AKTIF / SQLITE LOCAL CENTER
// Fungsi:
// - Menggantikan UI Dexie/IndexedDB lama dengan pusat kontrol SQLite local LAN.
// - Tidak menjalankan sync_queue, conflict resolver, atau backup IndexedDB.
// - Modul guarded stock/purchase/sales/finance/production tetap tidak dimutasi offline.
// =====================================================
const OfflineDatabaseCenter = () => {
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restorePlanLoading, setRestorePlanLoading] = useState(false);
  const [repositoryMode, setRepositoryMode] = useState(REPOSITORY_MODES.SQLITE_SIDECAR);
  const [status, setStatus] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [restorePlan, setRestorePlan] = useState(null);
  const [backups, setBackups] = useState([]);
  const [modeForm] = Form.useForm();

  const statusData = status?.data || {};
  const migrationData = migrationStatus?.data || {};
  const migrationModules = migrationData.modules || [];
  const migrationSummary = migrationData.summary || {};
  const sqliteActive = isSqliteMode(repositoryMode);

  const modeTag = useMemo(() => {
    if (sqliteActive) return <Tag color="green">SQLite local aktif</Tag>;
    return <Tag color="blue">Firebase fallback</Tag>;
  }, [sqliteActive]);

  const loadCenterData = useCallback(async ({ showSuccess = false } = {}) => {
    setLoading(true);
    try {
      const [modeStatus, nextStatus, nextBackups, nextMigrationStatus] = await Promise.all([
        getRepositoryModeStatus(),
        getSqliteBackendStatus(),
        getSqliteBackendBackups(),
        getSqliteMigrationStatus(),
      ]);
      setRepositoryMode(modeStatus.mode);
      setStatus(nextStatus);
      setBackups(nextBackups?.data || []);
      setMigrationStatus(nextMigrationStatus);
      if (showSuccess) message.success("Status SQLite Center diperbarui.");
    } catch (error) {
      console.error("Gagal memuat SQLite Center:", error);
      message.error(error?.message || "SQLite backend belum bisa diakses.");
      const modeStatus = await getRepositoryModeStatus().catch(() => ({ mode: REPOSITORY_MODES.SQLITE_SIDECAR }));
      setRepositoryMode(modeStatus.mode);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCenterData();
  }, [loadCenterData]);

  const handleSetMode = async (mode) => {
    const values = await modeForm.validateFields();
    setLoading(true);
    try {
      const result = await setRepositoryModeForDevelopment(mode, {
        confirmation: values.confirmation,
        reason: mode === REPOSITORY_MODES.SQLITE_SIDECAR
          ? "Mengaktifkan SQLite lokal untuk kerja full offline LAN."
          : "Fallback manual ke Firebase saat SQLite backend belum siap.",
      });
      setRepositoryMode(result.mode);
      modeForm.resetFields(["confirmation"]);
      message.success(result.mode === REPOSITORY_MODES.SQLITE_SIDECAR
        ? "SQLite local mode aktif."
        : "Firebase fallback mode aktif.");
      await loadCenterData();
    } catch (error) {
      message.error(error?.message || "Gagal mengganti mode repository.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const result = await createSqliteBackendBackup();
      message.success(result?.message || "Backup SQLite berhasil dibuat.");
      await loadCenterData();
    } catch (error) {
      message.error(error?.message || "Backup SQLite gagal.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleCreateRestorePlan = async () => {
    setRestorePlanLoading(true);
    try {
      const result = await createSqliteRestorePlan();
      setRestorePlan(result?.data || null);
      message.success(result?.message || "Restore plan preview berhasil dibuat.");
      await loadCenterData();
    } catch (error) {
      message.error(error?.message || "Restore plan gagal dibuat.");
    } finally {
      setRestorePlanLoading(false);
    }
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
            <Statistic title="Modul Terdaftar" value={formatNumber(statusData.migrationStatusCount)} prefix={<SwapOutlined />} />
          </Card>
        </Col>
      </Row>

      <Descriptions size="small" bordered column={{ xs: 1, lg: 2 }}>
        <Descriptions.Item label="Repository Mode">{modeTag}</Descriptions.Item>
        <Descriptions.Item label="Schema SQLite">{statusData.schemaVersion || "-"}</Descriptions.Item>
        <Descriptions.Item label="Restore Mode"><Tag color="orange">{statusData.restoreMode || "preview_only"}</Tag></Descriptions.Item>
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
        message="Target baru: SQLite lokal lewat backend LAN"
        description="Dexie/IndexedDB tidak lagi menjadi runtime offline utama. SQLite dipakai lewat backend Node.js agar laptop dan HP di jaringan yang sama membaca database yang sama. Firebase tetap dipertahankan sebagai fallback sampai migrasi semua modul selesai dan aman."
      />

      <Card size="small" title="Ganti repository mode" className="offline-db-action-card">
        <Form form={modeForm} layout="vertical">
          <Form.Item
            label="Confirmation"
            name="confirmation"
            extra={`SQLite: ${SQLITE_REPOSITORY_CONFIRMATION} · Firebase fallback: ${FIREBASE_REPOSITORY_CONFIRMATION}`}
            rules={[{ required: true, message: "Isi confirmation sesuai mode yang dipilih." }]}
          >
            <Input placeholder={sqliteActive ? FIREBASE_REPOSITORY_CONFIRMATION : SQLITE_REPOSITORY_CONFIRMATION} />
          </Form.Item>
          <Space wrap>
            <Button
              type="primary"
              icon={<DatabaseOutlined />}
              loading={loading}
              disabled={sqliteActive}
              onClick={() => handleSetMode(REPOSITORY_MODES.SQLITE_SIDECAR)}
            >
              Aktifkan SQLite Local
            </Button>
            <Button
              icon={<CloudServerOutlined />}
              loading={loading}
              disabled={!sqliteActive}
              onClick={() => handleSetMode(REPOSITORY_MODES.FIREBASE_PRIMARY)}
            >
              Fallback Firebase
            </Button>
          </Space>
        </Form>
      </Card>

      <Timeline
        items={[
          {
            color: "green",
            dot: <CheckCircleOutlined />,
            children: "Categories dan Customers pilot membaca/menulis ke SQLite local saat mode SQLite aktif.",
          },
          {
            color: "blue",
            dot: <ApiOutlined />,
            children: "HP mengakses frontend lewat IP laptop dan API SQLite otomatis mengikuti host/IP frontend.",
          },
          {
            color: "orange",
            dot: <WarningOutlined />,
            children: "Supplier, stock, purchase, sales final, finance, production, payroll, HPP, reset destructive belum boleh dimigrasi tanpa audit khusus.",
          },
        ]}
      />
    </Space>
  );

  const backupTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="Backup sekarang memakai file SQLite, bukan export IndexedDB JSON."
        description="Backup dibuat dari backend agar file database konsisten. Simpan folder backups/sqlite ke flashdisk atau drive lain secara berkala. Restore database produksi tetap harus dibuat sebagai patch/task terpisah dengan guard karena berisiko data overwrite."
      />
      <Card
        size="small"
        className="offline-db-action-card"
        title="Backup SQLite"
        extra={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadCenterData({ showSuccess: true })}>
              Refresh
            </Button>
            <Button type="primary" icon={<HddOutlined />} loading={backupLoading} onClick={handleBackup}>
              Buat Backup
            </Button>
          </Space>
        )}
      >
        <Row gutter={[12, 12]}>
          {backups.slice(0, 6).map((backup) => (
            <Col xs={24} md={12} xl={8} key={backup.id || backup.filename}>
              <Card size="small" className="offline-db-status-card">
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <Text strong ellipsis>{backup.filename}</Text>
                  <Text type="secondary">{formatBytes(backup.size_bytes || backup.sizeBytes)}</Text>
                  <Text type="secondary">{backup.created_at || "-"}</Text>
                  <Tag color={backup.status === "success" ? "green" : "orange"}>{backup.status || "unknown"}</Tag>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
        {!backups.length ? (
          <Alert style={{ marginTop: 12 }} type="warning" showIcon message="Belum ada backup SQLite." />
        ) : null}
      </Card>
    </Space>
  );

  const migrationTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type="warning"
        showIcon
        message="Status migrasi modul wajib dipantau sebelum full SQLite"
        description="Hanya modul sqlite_active yang boleh membaca/menulis SQLite. Modul guarded belum boleh dimigrasi atau dimutasi offline sebelum audit transaction design selesai."
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="SQLite Aktif" value={formatNumber(migrationSummary.sqlite_active)} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Firebase/Legacy" value={formatNumber((migrationSummary.firebase_only || 0) + (migrationSummary.firebase_auth || 0))} prefix={<CloudServerOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Guarded" value={formatNumber(migrationSummary.guarded)} prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small" className="offline-db-status-card">
            <Statistic title="Total Modul" value={formatNumber(migrationSummary.total)} prefix={<SwapOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        {migrationModules.map((item) => {
          const statusColor = item.status === "sqlite_active"
            ? "green"
            : item.status === "guarded"
              ? "red"
              : "blue";

          return (
            <Col xs={24} md={12} xl={8} key={item.module_key}>
              <Card size="small" className="offline-db-status-card offline-db-module-card">
                <Space direction="vertical" size={6} style={{ width: "100%" }}>
                  <Space wrap size={6}>
                    <Text strong>{item.label}</Text>
                    <Tag color={statusColor}>{item.status}</Tag>
                  </Space>
                  <Text type="secondary">Scope: {item.scope || "-"}</Text>
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
        message="Restore SQLite masih preview-only"
        description="C1 hanya membuat restore plan yang aman. Tombol ini tidak overwrite database aktif, tidak menghapus data, dan tidak menjalankan restore destructive."
      />
      <Card
        size="small"
        title="Restore Plan Preview"
        className="offline-db-action-card"
        extra={(
          <Button type="primary" icon={<SafetyOutlined />} loading={restorePlanLoading} onClick={handleCreateRestorePlan}>
            Buat Restore Plan
          </Button>
        )}
      >
        {restorePlan ? (
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
              <Descriptions.Item label="Mode"><Tag color="orange">{restorePlan.mode}</Tag></Descriptions.Item>
              <Descriptions.Item label="Destructive"><Tag color="green">Tidak aktif</Tag></Descriptions.Item>
              <Descriptions.Item label="Backup ditemukan">{restorePlan.backupFound ? "Ya" : "Tidak"}</Descriptions.Item>
              <Descriptions.Item label="File backup ada">{restorePlan.backupFileExists ? "Ya" : "Tidak"}</Descriptions.Item>
            </Descriptions>
            <Alert
              type="info"
              showIcon
              message="Tidak ada data yang diubah oleh restore plan."
              description={(restorePlan.blockedActions || []).join(" ")}
            />
          </Space>
        ) : (
          <Text type="secondary">Belum ada restore plan di sesi ini. Klik Buat Restore Plan untuk preview aman berdasarkan backup terbaru.</Text>
        )}
      </Card>
    </Space>
  );

  const qaTab = (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Alert
        type="warning"
        showIcon
        message="Checklist wajib setelah patch SQLite runtime"
        description="Jalankan checklist ini sebelum melanjutkan migrasi modul lain. Jangan hapus Firebase dan jangan migrasi modul guarded sebelum hasil checklist bersih."
      />
      <Card size="small" title="Manual QA" className="offline-db-action-card">
        <Timeline
          items={[
            { color: "green", children: "Backend: cd backend && npm install && npm run dev; buka /health dan /api/maintenance/status." },
            { color: "green", children: "Frontend laptop: npm run dev -- --host 0.0.0.0; buka halaman Kategori dan Customer." },
            { color: "green", children: "Frontend HP: buka http://IP-LAPTOP:5173/Inventory-App/ dan tambah/edit customer test." },
            { color: "green", children: "Restart backend; pastikan data SQLite masih ada." },
            { color: "blue", children: "Buat backup SQLite; pastikan file muncul di backups/sqlite dan audit log maintenance tercatat." },
            { color: "orange", children: "Pastikan tidak ada UI lama yang menyebut IndexedDB/Dexie pada flow aktif SQLite Center." },
          ]}
        />
      </Card>
    </Space>
  );

  const tabs = [
    { key: "status", label: "Status", children: statusTab },
    { key: "mode", label: "Mode", children: modeTab },
    { key: "backup", label: "Backup SQLite", children: backupTab },
    { key: "migration", label: "Migrasi Modul", children: migrationTab },
    { key: "restore", label: "Restore Plan", children: restoreTab },
    { key: "qa", label: "Checklist", children: qaTab },
  ];

  return (
    <Card
      size="small"
      className="offline-db-center"
      title={(
        <Space size={10}>
          <SwapOutlined />
          <span>SQLite Local DB Center</span>
          {modeTag}
        </Space>
      )}
      extra={(
        <Space size={8} wrap>
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => loadCenterData({ showSuccess: true })}>
            Refresh
          </Button>
          <Tag color="green">Backend LAN</Tag>
          <Tag color="blue">No Dexie runtime</Tag>
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
            <Text type="secondary">SQLite offline LAN</Text>
            <Title level={4} style={{ margin: "2px 0 4px" }}>Satu database lokal untuk laptop dan HP</Title>
            <Text type="secondary">
              Frontend tetap web React. Data pilot disimpan di SQLite lewat backend Node.js lokal, bukan IndexedDB per browser. Ini cocok untuk toko kecil/full offline dengan 1 laptop server.
            </Text>
          </div>
          <Space direction="vertical" size={4} align="end">
            {modeTag}
            <Text type="secondary">Pilot write: Categories & Customers</Text>
          </Space>
        </div>
        <Tabs className="offline-db-tabs" items={tabs} />
      </Space>
    </Card>
  );
};

export default OfflineDatabaseCenter;
