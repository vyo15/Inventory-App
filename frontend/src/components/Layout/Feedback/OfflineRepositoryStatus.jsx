import React from "react";
import { Alert, Button, Empty, Space, Tag, Typography } from "antd";
import {
  ApiOutlined,
  CloudSyncOutlined,
  DatabaseOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import { REPOSITORY_MODES } from "../../../data/repositories/repositoryMode";
import "./OfflineRepositoryStatus.css";

const { Text } = Typography;

const OFFLINE_DATABASE_CENTER_ROUTE = "/utilities/reset-maintenance-data";

const isSqliteMode = (repositoryMode) => repositoryMode === REPOSITORY_MODES.SQLITE_SIDECAR;

const getModeCopy = ({ repositoryMode, dataLabel }) => {
  if (isSqliteMode(repositoryMode)) {
    return {
      type: "success",
      title: "Mode SQLite lokal aktif",
      source: "SQLite LAN",
      description: `${dataLabel} sedang membaca dan menyimpan data ke SQLite lokal lewat backend laptop/server. Data bisa dibuka dari HP selama backend dan WiFi/LAN aktif.`,
    };
  }

  return {
    type: "info",
    title: "Mode Firebase fallback aktif",
    source: "Firebase Server",
    description: `${dataLabel} sedang membaca dan menyimpan data langsung dari Firebase. Mode ini hanya fallback sampai migrasi SQLite modul terkait selesai.`,
  };
};

// =====================================================
// SECTION: RepositoryStatus — AKTIF / UI-ONLY
// Fungsi:
// - Menjelaskan mode data pada page pilot Categories/Customers agar user tidak bingung antara Firebase dan SQLite local.
// - Tidak lagi membaca sync_queue/Dexie/IndexedDB.
// =====================================================
const OfflineRepositoryStatus = ({
  repositoryMode,
  queuePending = 0,
  dataLabel = "Data",
  loading = false,
  onRefresh,
}) => {
  const modeCopy = getModeCopy({ repositoryMode, dataLabel });
  const pendingCount = Number(queuePending || 0);

  return (
    <Alert
      className="ims-offline-repository-status"
      type={modeCopy.type}
      showIcon
      message={(
        <Space size={8} wrap>
          <span>{modeCopy.title}</span>
          <Tag color={isSqliteMode(repositoryMode) ? "green" : "blue"} icon={<DatabaseOutlined />}>
            {modeCopy.source}
          </Tag>
          {pendingCount > 0 ? (
            <Tag color="gold" icon={<CloudSyncOutlined />}>
              Queue legacy: {pendingCount}
            </Tag>
          ) : null}
        </Space>
      )}
      description={(
        <div className="ims-offline-repository-status__description">
          <Text>{modeCopy.description}</Text>
          {isSqliteMode(repositoryMode) ? (
            <Text type="secondary">
              Jalankan backend dari folder backend dengan npm run dev. Untuk HP, gunakan IP laptop dan pastikan firewall mengizinkan port 3001/5173.
            </Text>
          ) : null}
        </div>
      )}
      action={(
        <Space className="ims-offline-repository-status__actions" wrap>
          <Button size="small" icon={<ApiOutlined />}>
            <Link to={OFFLINE_DATABASE_CENTER_ROUTE}>SQLite Center</Link>
          </Button>
          {onRefresh ? (
            <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
              Refresh
            </Button>
          ) : null}
        </Space>
      )}
    />
  );
};

export const OfflineRepositoryEmptyState = ({
  repositoryMode,
  dataLabel = "data",
}) => {
  if (!isSqliteMode(repositoryMode)) {
    return `Belum ada ${dataLabel}.`;
  }

  return (
    <div className="ims-offline-repository-empty-state">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={(
          <Space direction="vertical" size={6} align="center">
            <Text strong>Data SQLite masih kosong atau backend belum tersambung.</Text>
            <Text type="secondary">
              Jalankan backend SQLite, lalu tambah {dataLabel} dari halaman ini.
            </Text>
          </Space>
        )}
      >
        <Button type="primary" icon={<ApiOutlined />}>
          <Link to={OFFLINE_DATABASE_CENTER_ROUTE}>Buka SQLite Center</Link>
        </Button>
      </Empty>
    </div>
  );
};

export default OfflineRepositoryStatus;
