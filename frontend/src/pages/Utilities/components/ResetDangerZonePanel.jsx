import React from "react";
import { Button, Space, Tag, Typography } from "antd";
import { DatabaseOutlined, FileSearchOutlined, LockOutlined, SafetyOutlined } from "@ant-design/icons";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";

const { Text } = Typography;

const statusItems = [
  {
    key: "legacy-reset",
    title: "Status reset lama",
    icon: <LockOutlined />,
    tag: "Nonaktif",
    color: "red",
    description: "Service reset lama tidak menjalankan penghapusan data.",
  },
  {
    key: "backup-restore",
    title: "Recovery utama",
    icon: <DatabaseOutlined />,
    tag: "Backup & Restore",
    color: "green",
    description: "Gunakan File Backup IMS .imsbackup, preview restore, dan keyword konfirmasi.",
  },
  {
    key: "data-tools",
    title: "Data tools",
    icon: <SafetyOutlined />,
    tag: "Terpisah",
    color: "blue",
    description: "Export master/checklist dipisah dari area reset agar aman untuk operasional.",
  },
];

const ResetDangerZonePanel = ({ loadingAutoDetect, onRunAllAudits }) => (
  <div className="reset-danger-flat-panel">
    <div className="reset-danger-heading">
      <Space size={8} wrap>
        <Text strong>Reset Testing / Development</Text>
        <Tag color="red">Reset lama nonaktif</Tag>
      </Space>
      <Button icon={<FileSearchOutlined />} loading={loadingAutoDetect} onClick={onRunAllAudits}>
        Jalankan Audit Data
      </Button>
    </div>

    <ImsNotice
      variant="guard"
      compact
      title="Reset testing lama dinonaktifkan pada mode database lokal"
      description="Pemulihan data utama sekarang wajib lewat Backup & Restore resmi. Reset penghapusan data belum tersedia dan tidak akan diaktifkan tanpa guard layanan lokal, preview, backup otomatis, keyword, serta audit log."
    />

    <div className="reset-danger-status-grid">
      {statusItems.map((item) => (
        <div className="reset-danger-status-item" key={item.key}>
          <Space size={8} wrap>
            <Text strong>{item.title}</Text>
            <Tag icon={item.icon} color={item.color}>{item.tag}</Tag>
          </Space>
          <Text type="secondary">{item.description}</Text>
        </div>
      ))}
    </div>
  </div>
);

export default ResetDangerZonePanel;
