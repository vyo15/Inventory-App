import { Button, Space, Statistic, Tag, Typography } from "antd";
import { DownloadOutlined, EyeOutlined } from "@ant-design/icons";

const { Text } = Typography;

const ResetExportPanel = ({
  loadingMasterExportPreview,
  onLoadMasterExportPreview,
  loadingMasterExport,
  onDownloadMasterExport,
  masterExportPreview,
  lastMasterExport,
}) => (
  <div className="reset-export-flat-panel">
    <div className="reset-export-heading">
      <div>
        <Space size={8} wrap>
          <Text strong>Export Data Master</Text>
          <StatusTag tone="success">Read-only</StatusTag>
        </Space>
        <Text type="secondary">
          Export untuk arsip dan review master data. File JSON ini bukan paket restore; pemulihan penuh tetap memakai File Backup IMS.
        </Text>
      </div>
      <Space wrap>
        <Button icon={<EyeOutlined />} loading={loadingMasterExportPreview} onClick={() => onLoadMasterExportPreview?.()}>
          Preview
        </Button>
        <Button type="primary" icon={<DownloadOutlined />} loading={loadingMasterExport} onClick={() => onDownloadMasterExport?.(true)}>
          Export Master
        </Button>
      </Space>
    </div>

    <div className="reset-export-metrics">
      <Statistic title="Collection" value={masterExportPreview?.summary?.totalCollections || lastMasterExport?.totalCollections || 0} />
      <Statistic title="Record Master" value={masterExportPreview?.summary?.totalRecords || lastMasterExport?.totalRecords || 0} />
      <Statistic title="Opening Stock" value={masterExportPreview?.summary?.openingStockRows || lastMasterExport?.openingStockRows || 0} />
      <Statistic title="Warning" value={masterExportPreview?.summary?.warnings || lastMasterExport?.warnings?.length || 0} />
    </div>
  </div>
);

import StatusTag from "../../../components/Layout/Feedback/StatusTag";
export default ResetExportPanel;
