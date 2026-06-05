import React from "react";
import { Button, Card, Col, Popconfirm, Row, Space, Statistic, Table, Tag } from "antd";
import { DeleteOutlined, DownloadOutlined, EyeOutlined } from "@ant-design/icons";

const ResetExportPanel = ({
  loadingTestDataPreview,
  onLoadTestDataPreview,
  loadingDeleteTestData,
  testDataPreview,
  onDeleteDevTestData,
  loadingMasterExportPreview,
  onLoadMasterExportPreview,
  loadingMasterExport,
  onDownloadMasterExport,
  onDownloadMasterExportChecklist,
  masterExportPreview,
  lastMasterExport,
  testDataRows,
  renderCompactText,
}) => (
  <Row gutter={[12, 12]}>
    <Col xs={24}>
      <Card title="Data Tools: Test Seed & Export" size="small" extra={<Tag color="gold">Non-destructive</Tag>}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Space wrap>
            <Button icon={<EyeOutlined />} loading={loadingTestDataPreview} onClick={onLoadTestDataPreview}>
              Preview Data Test Bermarker
            </Button>
            <Popconfirm
              title="Hapus data test bermarker?"
              description="Hanya dokumen isTestData/test_seed/dev_seed. Data normal dan supplier protected tidak ikut."
              okText="Ya, hapus"
              cancelText="Batal"
              onConfirm={onDeleteDevTestData}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={loadingDeleteTestData}
                disabled={!testDataPreview?.totalRecords}
              >
                Hapus Data Test Bermarker
              </Button>
            </Popconfirm>
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
            <Col xs={8}><Statistic title="Data Test" value={testDataPreview?.totalRecords || 0} /></Col>
            <Col xs={8}><Statistic title="Master" value={masterExportPreview?.summary?.totalRecords || lastMasterExport?.totalRecords || 0} /></Col>
            <Col xs={8}><Statistic title="Warning" value={masterExportPreview?.summary?.warnings || lastMasterExport?.warnings?.length || 0} /></Col>
          </Row>
          {Boolean(testDataRows.length) && (
            <Table
              className="app-data-table"
              size="small"
              pagination={false}
              dataSource={testDataRows}
              columns={[
                { title: "Collection", dataIndex: "name", key: "name", render: (value) => renderCompactText(value, 180) },
                { title: "Jumlah", dataIndex: "count", key: "count", width: 90 },
                { title: "Aksi", dataIndex: "action", key: "action", render: (value) => renderCompactText(value, 220) },
              ]}
              scroll={{ x: 520 }}
            />
          )}
        </Space>
      </Card>
    </Col>
  </Row>
);

export default ResetExportPanel;
