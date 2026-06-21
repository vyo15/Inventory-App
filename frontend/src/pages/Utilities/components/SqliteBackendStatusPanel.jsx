import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  ApiOutlined,
  DatabaseOutlined,
  HddOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";

import {
  createSqliteBackendBackup,
  getSqliteBackendBaseUrl,
  getSqliteBackendHealth,
  getSqliteBackendStatus,
} from "../../../services/System/sqliteBackendStatusService";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";

const { Text } = Typography;

const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");

const SqliteBackendStatusPanel = () => {
  const { message: appMessage } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [status, setStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const baseUrl = useMemo(() => getSqliteBackendBaseUrl(), []);
  const isOnline = Boolean(health?.ok && status?.ok && !errorMessage);
  const statusData = useMemo(() => status?.data || {}, [status]);
  const healthData = health?.data || {};
  const statusStats = useMemo(() => [
    { key: "schema", label: "Versi DB", value: statusData.schemaVersion || "-", icon: <DatabaseOutlined /> },
    { key: "users", label: "User", value: formatNumber(statusData.userCount) },
    { key: "customers", label: "Customer", value: formatNumber(statusData.customerCount) },
    { key: "categories", label: "Kategori", value: formatNumber(statusData.categoryCount) },
    { key: "suppliers", label: "Supplier", value: formatNumber(statusData.supplierCount) },
    { key: "backups", label: "Backup", value: formatNumber(statusData.backupCount), icon: <HddOutlined /> },
  ], [statusData]);

  const refreshStatus = useCallback(async ({ showSuccess = false } = {}) => {
    setLoading(true);
    setErrorMessage("");
    try {
      const [nextHealth, nextStatus] = await Promise.all([
        getSqliteBackendHealth(),
        getSqliteBackendStatus(),
      ]);
      setHealth(nextHealth);
      setStatus(nextStatus);
      if (showSuccess) appMessage.success("Status layanan lokal diperbarui.");
    } catch (error) {
      setHealth(null);
      setStatus(null);
      setErrorMessage(error?.message || "Layanan lokal belum bisa diakses.");
      if (showSuccess) appMessage.error(error?.message || "Layanan lokal belum bisa diakses.");
    } finally {
      setLoading(false);
    }
  }, [appMessage]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const result = await createSqliteBackendBackup();
      appMessage.success(result?.message || "Backup database berhasil dibuat.");
      await refreshStatus();
    } catch (error) {
      appMessage.error(error?.message || "Backup database gagal.");
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <Card
      size="small"
      className="offline-db-action-card sqlite-backend-status-panel"
      title={(
        <Space size={8}>
          <ApiOutlined />
          <span>Layanan Lokal</span>
          <Tag color={isOnline ? "green" : "orange"}>{isOnline ? "aktif" : "belum tersambung"}</Tag>
        </Space>
      )}
      extra={(
        <Space wrap>
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => refreshStatus({ showSuccess: true })}>
            Refresh
          </Button>
          <Button size="small" icon={<SaveOutlined />} loading={backupLoading} disabled={!isOnline} onClick={handleBackup}>
            Backup Database
          </Button>
        </Space>
      )}
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <ImsNotice
          variant={isOnline ? "status" : "guard"}
          compact
          title={isOnline ? "Layanan lokal aktif" : "Layanan lokal belum tersambung"}
          description={isOnline
            ? "Koneksi backend lokal dan status database aplikasi terpantau normal."
            : "Jalankan aplikasi lokal dari komputer utama. Untuk akses HP, gunakan jaringan yang sama dan pastikan firewall mengizinkan aplikasi."
          }
        />

        <div className="offline-db-mini-stat-grid">
          {statusStats.map((item) => (
            <div key={item.key} className="offline-db-mini-stat">
              <Text type="secondary">{item.label}</Text>
              <Text strong>{item.icon ? <Space size={6}>{item.icon}<span>{item.value}</span></Space> : item.value}</Text>
            </div>
          ))}
        </div>

        <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Alamat Aplikasi">{baseUrl}</Descriptions.Item>
          <Descriptions.Item label="Status Layanan">{healthData.service || healthData.phase || "layanan lokal"}</Descriptions.Item>
          <Descriptions.Item label="Lokasi Data" span={{ xs: 1, md: 2 }}>
            <Text copyable ellipsis style={{ maxWidth: "100%" }}>{statusData.dbPath || healthData.dbPath || "-"}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Lokasi Backup" span={{ xs: 1, md: 2 }}>
            <Text copyable ellipsis style={{ maxWidth: "100%" }}>{statusData.backupDir || "-"}</Text>
          </Descriptions.Item>
        </Descriptions>

        {errorMessage ? (
          <Alert
            type="error"
            showIcon
            message="Detail koneksi"
            description={errorMessage}
          />
        ) : null}
      </Space>
    </Card>
  );
};

export default SqliteBackendStatusPanel;
