import {
  useCallback,
  useEffect,
  useMemo,
  useState } from "react";
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Pagination,
  Row,
  Select,
  Space,
  Tag,
  Timeline,
  Typography,
} from "antd";
import {
  DatabaseOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import StatusTag from "../../../components/Layout/Feedback/StatusTag";
import { formatDateTimeId, parseDateTimeId } from "../../../utils/formatters/dateId";
import { formatFileSizeId } from "../../../utils/formatters/fileSizeId";
import { getBackupTypeLabel } from "../utils/backupUiFormatters";
import {
  getSqliteAuditLogs,
  getSqliteBackendBackups,
  getSqliteRestoreLogs,
} from "../../../services/System/sqliteBackendStatusService";

const { Text } = Typography;

const formatBytes = formatFileSizeId;
const parseDate = parseDateTimeId;
const formatDateTime = (value) => formatDateTimeId(value, { fallback: value || "-" });

const getStatusColor = (value) => {
  const status = String(value || "").toLowerCase();
  if (["verified", "success", "ok", "completed", "executed_guarded"].includes(status)) return "green";
  if (["failed", "error", "invalid"].includes(status)) return "red";
  if (["planned", "preview", "started"].includes(status)) return "blue";
  return "orange";
};

const getAuditActionLabel = (action = "") => {
  const labels = {
    backup_create: "Backup dibuat",
    backup_daily_auto_create: "Backup harian otomatis",
    backup_import: "Backup diimport",
    backup_monthly_promote: "Promosi backup bulanan",
    backup_retention_delete: "Retensi backup",
    pre_restore_backup_create: "Backup sebelum restore",
    pre_restore_backup_re_register: "Registrasi ulang backup pre-restore",
    restore_plan_preview: "Preview restore",
    restore_execute: "Restore dijalankan",
    restore_rollback: "Rollback restore",
    restore_source_backup_re_register: "Registrasi ulang sumber restore",
    pre_stock_read_model_repair_backup: "Backup sebelum rebuild stok",
    stock_read_model_rebuild: "Rebuild data turunan stok",
    pre_stock_read_model_cleanup_backup: "Backup sebelum cleanup stok",
    stock_read_model_orphan_cleanup: "Cleanup orphan stok",
    pre_inactive_record_purge_backup: "Backup sebelum purge data nonaktif",
    inactive_record_purge: "Hapus permanen data nonaktif",
  };
  return labels[action] || action || "Maintenance";
};

const getAuditCategory = (action = "") => {
  const normalized = String(action || "");
  if (normalized.includes("backup")) return "backup";
  if (normalized.includes("restore")) return "restore";
  if (normalized.includes("purge")) return "purge";
  if (normalized.includes("repair") || normalized.includes("rebuild") || normalized.includes("cleanup")) return "repair";
  return "other";
};

const isWithinPeriod = (value, period) => {
  if (period === "all") return true;
  const date = parseDate(value);
  if (!date) return false;
  const ageMs = Date.now() - date.getTime();
  if (period === "today") {
    const now = new Date();
    return date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth()
      && date.getDate() === now.getDate();
  }
  if (period === "7d") return ageMs <= 7 * 24 * 60 * 60 * 1000;
  if (period === "30d") return ageMs <= 30 * 24 * 60 * 60 * 1000;
  return true;
};

const MaintenanceHistoryPanel = () => {
  const { message: appMessage } = AntdApp.useApp();
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState([]);
  const [restoreLogs, setRestoreLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activityFilter, setActivityFilter] = useState("all");
  const [activityPeriod, setActivityPeriod] = useState("all");
  const [restorePage, setRestorePage] = useState(1);

  const loadHistory = useCallback(async ({ showSuccess = false } = {}) => {
    setLoading(true);
    try {
      const [backupResult, restoreLogResult, auditLogResult] = await Promise.all([
        getSqliteBackendBackups(),
        getSqliteRestoreLogs(),
        getSqliteAuditLogs({ module: "maintenance", limit: 100 }),
      ]);
      setBackups(backupResult?.data || []);
      setRestoreLogs(restoreLogResult?.data || []);
      setAuditLogs(auditLogResult?.data || []);
      if (showSuccess) appMessage.success("Riwayat maintenance berhasil diperbarui.");
    } catch (error) {
      console.error("Gagal memuat riwayat maintenance:", error);
      appMessage.error(error?.message || "Riwayat maintenance belum bisa dimuat dari layanan lokal.");
      setBackups([]);
      setRestoreLogs([]);
      setAuditLogs([]);
    } finally {
      setLoading(false);
    }
  }, [appMessage]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const latestBackup = backups[0] || null;
  const latestRestore = restoreLogs[0] || null;
  const latestAudit = auditLogs[0] || null;
  const successfulBackups = useMemo(
    () => backups.filter((backup) => ["verified", "success"].includes(String(backup.status || "").toLowerCase())).length,
    [backups],
  );
  const repairAuditCount = useMemo(
    () => auditLogs.filter((log) => [
      "stock_read_model_rebuild",
      "stock_read_model_orphan_cleanup",
      "inactive_record_purge",
    ].includes(log.action)).length,
    [auditLogs],
  );

  const historySummaryItems = [
    { key: "backup", label: "Backup", value: backups.length, note: "Total backup resmi", icon: <DatabaseOutlined />, color: "green" },
    { key: "verified", label: "Terverifikasi", value: successfulBackups, note: "Backup terverifikasi", icon: <SafetyOutlined />, color: "blue" },
    { key: "restore", label: "Restore", value: restoreLogs.length, note: "Preview/restore tercatat", icon: <SwapOutlined />, color: "blue" },
    { key: "repair", label: "Perbaikan", value: repairAuditCount, note: "Aksi repair resmi", icon: <HistoryOutlined />, color: "orange" },
  ];

  const filteredAuditLogs = useMemo(() => auditLogs.filter((log) => {
    const matchesType = activityFilter === "all" || getAuditCategory(log.action) === activityFilter;
    return matchesType && isWithinPeriod(log.created_at, activityPeriod);
  }), [activityFilter, activityPeriod, auditLogs]);

  const restorePageSize = 6;
  const restorePageCount = Math.max(1, Math.ceil(restoreLogs.length / restorePageSize));
  const visibleRestoreLogs = restoreLogs.slice(
    (restorePage - 1) * restorePageSize,
    restorePage * restorePageSize,
  );
  const restoreTimelineItems = useMemo(() => visibleRestoreLogs.map((log) => ({
    color: getStatusColor(log.plan_status),
    children: (
      <Space direction="vertical" size={2}>
        <Text strong>{formatDateTime(log.created_at)}</Text>
        <Text type="secondary" ellipsis={{ tooltip: log.filename }}>{log.filename || "Restore preview"}</Text>
        <Space size={6} wrap>
          <StatusTag color={getStatusColor(log.plan_status)}>{log.plan_status || "planned"}</StatusTag>
          <Tag color={log.destructive_allowed ? "red" : "blue"}>{log.destructive_allowed ? "Eksekusi" : "Preview"}</Tag>
          {log.actor ? <Tag>{log.actor}</Tag> : null}
        </Space>
      </Space>
    ),
  })), [visibleRestoreLogs]);

  useEffect(() => {
    if (restorePage > restorePageCount) setRestorePage(restorePageCount);
  }, [restorePage, restorePageCount]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <ImsNotice
        variant="guidance"
        compact
        title="Riwayat resmi dari database"
        description="Backup, restore, import, repair data turunan, cleanup orphan, purge data nonaktif, dan lifecycle backup ditampilkan dari log layanan lokal. Snapshot purge disimpan pada audit log; session browser bukan sumber audit."
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
          <Descriptions.Item label="Backup terakhir"><Text ellipsis={{ tooltip: latestBackup?.filename }}>{latestBackup ? getBackupTypeLabel(latestBackup.backupType) : "-"}</Text></Descriptions.Item>
          <Descriptions.Item label="Tanggal backup">{formatDateTime(latestBackup?.created_at)}</Descriptions.Item>
          <Descriptions.Item label="Restore terakhir"><Text ellipsis={{ tooltip: latestRestore?.filename }}>{latestRestore ? "Aktivitas restore tercatat" : "-"}</Text></Descriptions.Item>
          <Descriptions.Item label="Tanggal restore">{formatDateTime(latestRestore?.created_at)}</Descriptions.Item>
          <Descriptions.Item label="Aktivitas terakhir">{getAuditActionLabel(latestAudit?.action)}</Descriptions.Item>
          <Descriptions.Item label="Actor terakhir">{latestAudit?.actor || "-"}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="Aktivitas Maintenance"
        size="small"
        extra={(
          <Space wrap size={8}>
            <Tag>{filteredAuditLogs.length} dari {auditLogs.length} aktivitas</Tag>
            <Select
              size="small"
              value={activityFilter}
              onChange={setActivityFilter}
              style={{ minWidth: 145 }}
              options={[
                { value: "all", label: "Semua aktivitas" },
                { value: "backup", label: "Backup" },
                { value: "restore", label: "Restore" },
                { value: "repair", label: "Perbaikan" },
                { value: "purge", label: "Hapus permanen" },
              ]}
            />
            <Select
              size="small"
              value={activityPeriod}
              onChange={setActivityPeriod}
              style={{ minWidth: 125 }}
              options={[
                { value: "all", label: "Semua waktu" },
                { value: "today", label: "Hari ini" },
                { value: "7d", label: "7 hari" },
                { value: "30d", label: "30 hari" },
              ]}
            />
          </Space>
        )}
      >
        <DataTableView
          className="app-data-table"
          size="small"
          loading={loading}
          dataSource={filteredAuditLogs.map((log) => ({ ...log, key: log.id }))}
          pagination={{ pageSize: 15, showSizeChanger: true, hideOnSinglePage: true }}
          locale={{ emptyText: <EmptyStateBlock compact description="Tidak ada aktivitas sesuai filter" /> }}
          columns={[
            {
              title: "Waktu",
              dataIndex: "created_at",
              key: "created_at",
              width: 155,
              render: formatDateTime,
            },
            {
              title: "Aksi",
              dataIndex: "action",
              key: "action",
              width: 220,
              render: (value) => <Tag color="blue">{getAuditActionLabel(value)}</Tag>,
            },
            {
              title: "Actor",
              dataIndex: "actor",
              key: "actor",
              width: 140,
            },
            {
              title: "Keterangan",
              dataIndex: "description",
              key: "description",
              render: (value) => <Text ellipsis={{ tooltip: value }}>{value || "-"}</Text>,
            },
          ]}
          mobileCardConfig={{
            title: (record) => getAuditActionLabel(record.action),
            subtitle: (record) => formatDateTime(record.created_at),
            tags: (record) => <Tag>{record.actor || "system"}</Tag>,
            meta: [{ label: "Keterangan", value: (record) => record.description || "-" }],
          }}
          scroll={{ x: 860 }}
        />
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} xl={15}>
          <Card title="Riwayat Backup" size="small">
            <DataTableView
              className="app-data-table"
              size="small"
              loading={loading}
              dataSource={backups.map((backup) => ({ ...backup, key: backup.id || backup.filename }))}
              pagination={{ pageSize: 10, showSizeChanger: true, hideOnSinglePage: true }}
              locale={{ emptyText: <EmptyStateBlock compact description="Belum ada riwayat backup" /> }}
              columns={[
                { title: "Tanggal", dataIndex: "created_at", key: "created_at", width: 150, render: formatDateTime },
                { title: "Jenis", dataIndex: "backupType", key: "backupType", width: 130, render: (value) => <Tag>{getBackupTypeLabel(value)}</Tag> },
                { title: "Status", dataIndex: "status", key: "status", width: 120, render: (value) => <StatusTag color={getStatusColor(value)}>{value || "unknown"}</StatusTag> },
                { title: "Ukuran", dataIndex: "size_bytes", key: "size_bytes", width: 110, render: formatBytes },
                { title: "File", dataIndex: "filename", key: "filename", render: (value) => <Text copyable ellipsis style={{ maxWidth: 360 }}>{value}</Text> },
              ]}
              mobileCardConfig={{
                title: (record) => record.filename || "Backup Database",
                subtitle: (record) => [formatDateTime(record.created_at), getBackupTypeLabel(record.backupType)],
                tags: (record) => <StatusTag color={getStatusColor(record.status)}>{record.status || "unknown"}</StatusTag>,
                meta: [
                  { label: "Ukuran", value: (record) => formatBytes(record.size_bytes) },
                  { label: "Jenis", value: (record) => getBackupTypeLabel(record.backupType) },
                ],
              }}
              scroll={{ x: 760 }}
            />
          </Card>
        </Col>
        <Col xs={24} xl={9}>
          <Card title="Riwayat Restore" size="small">
            {restoreTimelineItems.length ? (
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                <Timeline items={restoreTimelineItems} />
                <Pagination
                  current={restorePage}
                  pageSize={restorePageSize}
                  total={restoreLogs.length}
                  showSizeChanger={false}
                  hideOnSinglePage
                  size="small"
                  onChange={setRestorePage}
                />
              </Space>
            ) : <EmptyStateBlock compact description="Belum ada riwayat restore" />}
          </Card>
        </Col>
      </Row>
    </Space>
  );
};

export default MaintenanceHistoryPanel;
