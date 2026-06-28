import { Button, Card, Space, Tag, Typography } from "antd";
import {
  ApiOutlined,
  DatabaseOutlined,
  HddOutlined,
  ReloadOutlined,
  SafetyOutlined,
} from "@ant-design/icons";

import { getSqliteBackendBaseUrl } from "../../../services/System/sqliteBackendStatusService";

const { Text } = Typography;

const formatNumber = (value) => Number(value || 0).toLocaleString("id-ID");

const SqliteBackendStatusPanel = ({
  statusData = {},
  isOnline = false,
  loading = false,
  onRefresh,
} = {}) => {
  const statusReady = isOnline
    && Number(statusData.maintenanceStatusContractVersion || 0) >= 2
    && statusData.capabilities?.tableCounts === true;
  const formatStatusNumber = (value) => statusReady ? formatNumber(value) : "-";
  const statusStats = [
    { key: "schema", label: "Versi DB", value: statusData.schemaVersion || "-", icon: <DatabaseOutlined /> },
    { key: "users", label: "User", value: formatStatusNumber(statusData.userCount) },
    { key: "admins", label: "Admin Aktif", value: formatStatusNumber(statusData.activeAdministratorCount), icon: <SafetyOutlined /> },
    { key: "backups", label: "Backup", value: formatStatusNumber(statusData.backupCount), icon: <HddOutlined /> },
  ];

  return (
    <Card size="small" className="offline-db-action-card sqlite-backend-status-panel">
      <div className="offline-db-health-strip">
        <div className="offline-db-health-main">
          <Space size={8} wrap>
            <ApiOutlined />
            <Text strong>Layanan lokal IMS</Text>
            <Tag color={statusReady ? "green" : "orange"}>{statusReady ? "Aktif" : "Perlu diperiksa"}</Tag>
          </Space>
          <Text type="secondary">
            {statusReady
              ? "Database utama dapat diakses dan siap melayani modul IMS."
              : "Status belum dapat dipercaya. Restart layanan lokal bila frontend baru saja diperbarui, lalu klik Refresh."}
          </Text>
        </div>
        <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      <div className="offline-db-mini-stat-grid offline-db-mini-stat-grid-compact">
        {statusStats.map((item) => (
          <div key={item.key} className="offline-db-mini-stat">
            <Text type="secondary">{item.label}</Text>
            <Text strong>{item.icon ? <Space size={6}>{item.icon}<span>{item.value}</span></Space> : item.value}</Text>
          </div>
        ))}
      </div>

      <Text className="offline-db-service-address" type="secondary" copyable>
        {getSqliteBackendBaseUrl()}
      </Text>
    </Card>
  );
};

export default SqliteBackendStatusPanel;
