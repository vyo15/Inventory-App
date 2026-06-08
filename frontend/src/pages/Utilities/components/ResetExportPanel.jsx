import React from "react";
import { Button, Space, Statistic, Tag, Typography } from "antd";
import { DownloadOutlined, EyeOutlined } from "@ant-design/icons";

const { Text } = Typography;

const ResetExportPanel = ({
  loadingMasterExportPreview,
  onLoadMasterExportPreview,
  loadingMasterExport,
  onDownloadMasterExport,
  onDownloadMasterExportChecklist,
  masterExportPreview,
  lastMasterExport,
}) => (
  <div className="reset-export-flat-panel">
    <div className="reset-export-heading">
      <div>
        <Space size={8} wrap>
          <Text strong>Data Tools: Export Master</Text>
          <Tag color="green">Non-destructive</Tag>
        </Space>
        <Text type="secondary">Export membaca master data SQLite secara read-only untuk arsip/audit manual. Restore penuh tetap memakai File Backup IMS.</Text>
      </div>
      <Space wrap>
        <Button icon={<EyeOutlined />} loading={loadingMasterExportPreview} onClick={onLoadMasterExportPreview}>
          Preview
        </Button>
        <Button icon={<DownloadOutlined />} loading={loadingMasterExport} onClick={onDownloadMasterExport}>
          Export Master
        </Button>
        <Button icon={<DownloadOutlined />} loading={loadingMasterExport} onClick={onDownloadMasterExportChecklist}>
          Checklist
        </Button>
      </Space>
    </div>

    <div className="reset-export-metrics">
      <Statistic title="Master" value={masterExportPreview?.summary?.totalRecords || lastMasterExport?.totalRecords || 0} />
      <Statistic title="Opening Stock" value={masterExportPreview?.summary?.openingStockRows || lastMasterExport?.openingStockRows || 0} />
      <Statistic title="Warning" value={masterExportPreview?.summary?.warnings || lastMasterExport?.warnings?.length || 0} />
    </div>
  </div>
);

export default ResetExportPanel;
