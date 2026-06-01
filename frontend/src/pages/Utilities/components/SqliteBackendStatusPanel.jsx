import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
  message,
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

const { Text } = Typography;

const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");

const SqliteBackendStatusPanel = () => {
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [status, setStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const baseUrl = useMemo(() => getSqliteBackendBaseUrl(), []);
  const isOnline = Boolean(health?.ok && status?.ok && !errorMessage);
  const statusData = status?.data || {};
  const healthData = health?.data || {};

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
      if (showSuccess) message.success("Status SQLite backend diperbarui.");
    } catch (error) {
      setHealth(null);
      setStatus(null);
      setErrorMessage(error?.message || "SQLite backend belum bisa diakses.");
      if (showSuccess) message.error(error?.message || "SQLite backend belum bisa diakses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const result = await createSqliteBackendBackup();
      message.success(result?.message || "Backup SQLite berhasil dibuat.");
      await refreshStatus();
    } catch (error) {
      message.error(error?.message || "Backup SQLite gagal.");
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
          <span>SQLite Local Backend</span>
          <Tag color={isOnline ? "green" : "orange"}>{isOnline ? "online" : "belum aktif"}</Tag>
        </Space>
      )}
      extra={(
        <Space wrap>
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => refreshStatus({ showSuccess: true })}>
            Refresh
          </Button>
          <Button size="small" icon={<SaveOutlined />} loading={backupLoading} disabled={!isOnline} onClick={handleBackup}>
            Backup SQLite
          </Button>
        </Space>
      )}
    >
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Alert
          type={isOnline ? "success" : "warning"}
          showIcon
          message={isOnline ? "Backend SQLite LAN aktif" : "Backend SQLite belum tersambung"}
          description={isOnline
            ? "Panel ini memantau backend SQLite lokal yang sekarang menjadi target runtime pilot Categories dan Customers."
            : "Jalankan backend dari folder backend dengan npm install lalu npm run dev. Untuk HP, pastikan port 3001 dibuka di firewall, IP laptop statis, dan frontend dibuka lewat IP laptop."
          }
        />

        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}>
            <Card size="small" className="offline-db-status-card">
              <Statistic title="Schema" value={statusData.schemaVersion || "-"} prefix={<DatabaseOutlined />} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="offline-db-status-card">
              <Statistic title="Customers" value={formatNumber(statusData.customerCount)} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="offline-db-status-card">
              <Statistic title="Categories" value={formatNumber(statusData.categoryCount)} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small" className="offline-db-status-card">
              <Statistic title="Backup" value={formatNumber(statusData.backupCount)} prefix={<HddOutlined />} />
            </Card>
          </Col>
        </Row>

        <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="API Base URL">{baseUrl}</Descriptions.Item>
          <Descriptions.Item label="Mode">{healthData.phase || "sidecar-poc"}</Descriptions.Item>
          <Descriptions.Item label="DB Path" span={2}>
            <Text copyable ellipsis style={{ maxWidth: "100%" }}>{statusData.dbPath || healthData.dbPath || "-"}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Backup Dir" span={2}>
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
