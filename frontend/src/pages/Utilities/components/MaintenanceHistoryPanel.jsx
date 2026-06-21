import React, { useCallback, useEffect, useMemo, useState } from "react";
import { App as AntdApp, Button, Card, Col, Descriptions, Empty, Row, Space, Tag, Timeline, Typography } from "antd";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import { DatabaseOutlined, ReloadOutlined, SafetyOutlined, SwapOutlined } from "@ant-design/icons";

import {
  getSqliteBackendBackups,
  getSqliteRestoreLogs,
} from "../../../services/System/sqliteBackendStatusService";

const { Text } = Typography;

const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const parseDate = (value) => {
  if (!value) return null;
  const normalized = String(value).includes("T") ? String(value) : `${String(value).replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value) => {
  const date = parseDate(value);
  if (!date) return value || "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const getBackupTypeLabel = (backupType) => {
  const labels = {
    manual: "Manual",
    daily: "Harian",
    monthly: "Bulanan",
    "manual-import": "Import Manual",
    "pre-update": "Sebelum Update",
    "pre-restore": "Sebelum Restore",
    "pre-reset": "Sebelum Reset",
    "pre-import": "Sebelum Import",
    compatibility: "Arsip",
  };
  return labels[backupType] || backupType || "Backup";
};

const getStatusColor = (value) => {
  const status = String(value || "").toLowerCase();
  if (["verified", "success", "ok", "completed"].includes(status)) return "green";
  if (["failed", "error", "invalid"].includes(status)) return "red";
  if (["planned", "preview", "started"].includes(status)) return "blue";
  return "orange";
};

const parseSummary = (value) => {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const MaintenanceHistoryPanel = () => {
  const { message: appMessage } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState([]);
  const [restoreLogs, setRestoreLogs] = useState([]);

  const loadHistory = useCallback(async ({ showSuccess = false } = {}) => {
    setLoading(true);
    try {
      const [backupResult, restoreLogResult] = await Promise.all([
        getSqliteBackendBackups(),
        getSqliteRestoreLogs(),
      ]);
      setBackups(backupResult?.data || []);
      setRestoreLogs(restoreLogResult?.data || []);
      if (showSuccess) appMessage.success("Riwayat maintenance berhasil diperbarui.");
    } catch (error) {
      console.error("Gagal memuat riwayat maintenance:", error);
      appMessage.error(error?.message || "Riwayat maintenance belum bisa dimuat dari layanan lokal.");
      setBackups([]);
      setRestoreLogs([]);
    } finally {
      setLoading(false);
    }
  }, [appMessage]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const latestBackup = backups[0] || null;
  const latestRestore = restoreLogs[0] || null;
  const successfulBackups = useMemo(
    () => backups.filter((backup) => ["verified", "success"].includes(String(backup.status || "").toLowerCase())).length,
    [backups],
  );
  const historySummaryItems = [
    { key: "backup", label: "Backup", value: backups.length, note: "Total backup resmi", icon: <DatabaseOutlined />, color: "green" },
    { key: "verified", label: "Verified", value: successfulBackups, note: "Status verified/success", icon: <SafetyOutlined />, color: "blue" },
    { key: "restore", label: "Restore", value: restoreLogs.length, note: "Preview/restore tercatat", icon: <SwapOutlined />, color: "purple" },
  ];

  const restoreTimelineItems = useMemo(() => restoreLogs.slice(0, 8).map((log) => {
    const summary = parseSummary(log.summary_json);
    return {
      color: getStatusColor(log.plan_status),
      children: (
        <Space direction="vertical" size={2}>
          <Text strong>{formatDateTime(log.created_at)}</Text>
          <Text type="secondary">{log.filename || summary?.selectedBackup?.filename || "Restore preview"}</Text>
          <Space size={6} wrap>
            <Tag color={getStatusColor(log.plan_status)}>{log.plan_status || "planned"}</Tag>
            <Tag color={log.destructive_allowed ? "red" : "blue"}>{log.destructive_allowed ? "execute" : "preview"}</Tag>
            {log.actor ? <Tag>{log.actor}</Tag> : null}
          </Space>
        </Space>
      ),
    };
  }), [restoreLogs]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <ImsNotice
        variant="guidance"
        compact
        title="Riwayat maintenance resmi"
        description="Tab ini menampilkan backup dan restore resmi dari layanan lokal. Riwayat reset lama tidak dijadikan sumber utama karena fitur reset lama sudah nonaktif."
      />

      <div className="maintenance-history-summary-grid">
        {historySummaryItems.map((item) => (
          <div key={item.key} className="maintenance-history-summary-item">
            <Tag icon={item.icon} color={item.color}>{item.label}</Tag>
            <Text strong>{item.value}</Text>
            <Text type="secondary">{item.note}</Text>
          </div>
        ))}
      </div>

      <Card
        title="Ringkasan Terakhir"
        size="small"
        extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadHistory({ showSuccess: true })}>Refresh</Button>}
      >
        <Descriptions size="small" bordered column={{ xs: 1, md: 2 }}>
          <Descriptions.Item label="Backup terakhir">{latestBackup?.filename || "-"}</Descriptions.Item>
          <Descriptions.Item label="Tanggal backup">{formatDateTime(latestBackup?.created_at)}</Descriptions.Item>
          <Descriptions.Item label="Jenis backup">{getBackupTypeLabel(latestBackup?.backupType)}</Descriptions.Item>
          <Descriptions.Item label="Status backup"><Tag color={getStatusColor(latestBackup?.status)}>{latestBackup?.status || "-"}</Tag></Descriptions.Item>
          <Descriptions.Item label="Restore terakhir">{latestRestore?.filename || "-"}</Descriptions.Item>
          <Descriptions.Item label="Tanggal restore">{formatDateTime(latestRestore?.created_at)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} xl={15}>
          <Card title="Riwayat Backup" size="small">
            <DataTableView
              className="app-data-table"
              size="small"
              loading={loading}
              dataSource={backups.slice(0, 20).map((backup) => ({ ...backup, key: backup.id || backup.filename }))}
              pagination={false}
              locale={{ emptyText: <Empty description="Belum ada riwayat backup" /> }}
              columns={[
                {
                  title: "Tanggal",
                  dataIndex: "created_at",
                  key: "created_at",
                  width: 150,
                  render: formatDateTime,
                },
                {
                  title: "Jenis",
                  dataIndex: "backupType",
                  key: "backupType",
                  width: 120,
                  render: (value) => <Tag>{getBackupTypeLabel(value)}</Tag>,
                },
                {
                  title: "Status",
                  dataIndex: "status",
                  key: "status",
                  width: 120,
                  render: (value) => <Tag color={getStatusColor(value)}>{value || "unknown"}</Tag>,
                },
                {
                  title: "Ukuran",
                  dataIndex: "size_bytes",
                  key: "size_bytes",
                  width: 110,
                  render: formatBytes,
                },
                {
                  title: "File",
                  dataIndex: "filename",
                  key: "filename",
                  render: (value) => <Text copyable ellipsis style={{ maxWidth: 360 }}>{value}</Text>,
                },
              ]}
              mobileCardConfig={{
                title: (record) => record.filename || "Backup Database",
                subtitle: (record) => [formatDateTime(record.created_at), getBackupTypeLabel(record.backupType)],
                tags: (record) => <Tag color={getStatusColor(record.status)}>{record.status || "unknown"}</Tag>,
                meta: [
                  { label: "Ukuran", value: (record) => formatBytes(record.size_bytes) },
                  { label: "Jenis", value: (record) => getBackupTypeLabel(record.backupType) },
                ],
                content: (record) => (
                  <Text copyable ellipsis>
                    {record.filename}
                  </Text>
                ),
              }}
              scroll={{ x: 760 }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card title="Riwayat Restore" size="small">
            {restoreTimelineItems.length ? (
              <Timeline items={restoreTimelineItems} />
            ) : (
              <Empty description="Belum ada riwayat restore" />
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default MaintenanceHistoryPanel;
