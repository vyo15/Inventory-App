import React from "react";
import { Button, Card, Col, Row, Space, Statistic, Tag } from "antd";
import { DownloadOutlined, EyeOutlined } from "@ant-design/icons";

const ResetExportPanel = ({
  loadingMasterExportPreview,
  onLoadMasterExportPreview,
  loadingMasterExport,
  onDownloadMasterExport,
  onDownloadMasterExportChecklist,
  masterExportPreview,
  lastMasterExport,
}) => (
  <Row gutter={[12, 12]}>
    <Col xs={24}>
      <Card title="Data Tools: Export Master" size="small" extra={<Tag color="green">Non-destructive</Tag>}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space wrap>
            <Button icon={<EyeOutlined />} loading={loadingMasterExportPreview} onClick={onLoadMasterExportPreview}>
              Preview Download Export Master
            </Button>
            <Button icon={<DownloadOutlined />} loading={loadingMasterExport} onClick={onDownloadMasterExport}>
              Download Export Master
            </Button>
            <Button icon={<DownloadOutlined />} loading={loadingMasterExport} onClick={onDownloadMasterExportChecklist}>
              Download Checklist
            </Button>
          </Space>
          <Row gutter={[8, 8]}>
            <Col xs={12} md={8}>
              <Statistic title="Master" value={masterExportPreview?.summary?.totalRecords || lastMasterExport?.totalRecords || 0} />
            </Col>
            <Col xs={12} md={8}>
              <Statistic title="Warning" value={masterExportPreview?.summary?.warnings || lastMasterExport?.warnings?.length || 0} />
            </Col>
          </Row>
        </Space>
      </Card>
    </Col>
  </Row>
);

export default ResetExportPanel;
