import { FileSearchOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Col, Row, Space, Table, Tag } from "antd";

const ResetAutoDetectPanel = ({
  autoBugSummary,
  loadingAutoDetect,
  loadingDataQualityAudit,
  loadingStockAudit,
  loadingTransactionVariantAudit,
  onRunAllAudits,
  onLoadDataQualityAudit,
  onLoadStockAudit,
  onLoadTransactionVariantAudit,
  auditOverviewRows,
  auditIssueRows,
  renderCompactText,
}) => (
  <Card title="Auto Detect Bug Data" size="small" extra={<Tag color={autoBugSummary.color}>{autoBugSummary.status}</Tag>}>
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Row gutter={[8, 8]}>
        <Col xs={24} md={6}>
          <Button block type="primary" icon={<FileSearchOutlined />} loading={loadingAutoDetect} onClick={onRunAllAudits}>
            Cek Semua Area
          </Button>
        </Col>
        <Col xs={24} md={6}>
          <Button block icon={<FileSearchOutlined />} loading={loadingDataQualityAudit} onClick={() => onLoadDataQualityAudit({ showProblemPreview: true })}>
            Cek Data Lama
          </Button>
        </Col>
        <Col xs={24} md={6}>
          <Button block icon={<FileSearchOutlined />} loading={loadingStockAudit} onClick={onLoadStockAudit}>
            Cek Stok
          </Button>
        </Col>
        <Col xs={24} md={6}>
          <Button block icon={<FileSearchOutlined />} loading={loadingTransactionVariantAudit} onClick={onLoadTransactionVariantAudit}>
            Cek Variant Transaksi
          </Button>
        </Col>
      </Row>
      <Table
        className="app-data-table"
        size="small"
        pagination={false}
        dataSource={auditOverviewRows}
        columns={[
          { title: "Area", dataIndex: "area", key: "area", width: 150, render: (value) => renderCompactText(value, 135) },
          { title: "Dicek", dataIndex: "checkedRecords", key: "checkedRecords", width: 90 },
          { title: "Issue", dataIndex: "issueCount", key: "issueCount", width: 90, render: (value) => <Tag color={value ? "red" : "green"}>{value || 0}</Tag> },
          { title: "Repair", dataIndex: "safeRepairCount", key: "safeRepairCount", width: 90, render: (value) => <Tag color={value ? "blue" : "default"}>{value || 0}</Tag> },
          { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", render: (value) => renderCompactText(value, 360) },
        ]}
        scroll={{ x: 780 }}
      />
      {auditIssueRows.length > 0 && (
        <Alert
          type="warning"
          showIcon
          message={`${autoBugSummary.issueCount} issue dan ${autoBugSummary.safeRepairCount} kandidat repair aman terdeteksi.`}
          description="Buka Detail Audit jika perlu melihat sample record. Untuk data lama setelah patch, coba Repair Turunan dulu sebelum reset destructive."
        />
      )}
    </Space>
  </Card>
);

export default ResetAutoDetectPanel;
