import { FileSearchOutlined } from "@ant-design/icons";
import { Button, Card, Col, Row, Space, Tag } from "antd";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import { buildAutoDetectIssueSummaryMessage, getAuditIssueCountColor } from "../utils/resetMaintenanceUiHelpers";

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
  dataQualityCategoryRows = [],
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
          <Button block icon={<FileSearchOutlined />} loading={loadingDataQualityAudit} onClick={() => onLoadDataQualityAudit({ showProblemPreview: false })}>
            Cek Data Historis
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
      <DataTableView
        className="app-data-table"
        size="small"
        pagination={false}
        dataSource={auditOverviewRows}
        columns={[
          { title: "Area", dataIndex: "area", key: "area", width: 150, render: (value) => renderCompactText(value, 135) },
          { title: "Dicek", dataIndex: "checkedRecords", key: "checkedRecords", width: 90 },
          { title: "Issue", dataIndex: "issueCount", key: "issueCount", width: 90, render: (value) => <Tag color={getAuditIssueCountColor(value)}>{value || 0}</Tag> },
          { title: "Repair", dataIndex: "safeRepairCount", key: "safeRepairCount", width: 90, render: (value) => <Tag color={value ? "blue" : "default"}>{value || 0}</Tag> },
          { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", render: (value) => renderCompactText(value, 360) },
        ]}
        mobileCardConfig={{
          title: (record) => record.area || "Area Audit",
          subtitle: (record) => record.recommendation || "Rekomendasi audit",
          tags: (record) => <Tag color={getAuditIssueCountColor(record.issueCount)}>Issue {record.issueCount || 0}</Tag>,
          meta: [
            { label: "Dicek", value: (record) => record.checkedRecords || 0 },
            { label: "Repair", value: (record) => record.safeRepairCount || 0 },
          ],
        }}
        scroll={{ x: 780 }}
      />
      {dataQualityCategoryRows.length > 0 && (
        <DataTableView
          className="app-data-table"
          size="small"
          title={() => "Detail Data Quality Audit"}
          pagination={{ pageSize: 5, size: "small" }}
          dataSource={dataQualityCategoryRows}
          columns={[
            { title: "Kategori", dataIndex: "categoryLabel", key: "categoryLabel", width: 220, render: (value) => renderCompactText(value, 210) },
            { title: "Issue", dataIndex: "count", key: "count", width: 80, render: (value) => <Tag color="red">{value || 0}</Tag> },
            { title: "Sample", dataIndex: "samplePreview", key: "samplePreview", render: (value) => renderCompactText(value, 520) },
            { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", width: 260, render: (value) => renderCompactText(value, 240) },
          ]}
          mobileCardConfig={{
            title: (record) => record.categoryLabel || "Kategori Data",
            subtitle: (record) => record.recommendation || "Rekomendasi",
            tags: (record) => <Tag color="red">Issue {record.count || 0}</Tag>,
            meta: [
              { label: "Issue", value: (record) => record.count || 0 },
              { label: "Sample", value: (record) => record.samplePreview || "-" },
            ],
          }}
          scroll={{ x: 980 }}
        />
      )}
      {auditIssueRows.length > 0 && (
        <ImsNotice
          variant="data-quality"
          compact
          title={buildAutoDetectIssueSummaryMessage(autoBugSummary)}
          description="Gunakan ringkasan area, detail kategori Data Quality, dan Repair Turunan sebagai langkah aman. Sample audit hanya read-only dan tidak melakukan backfill otomatis."
        />
      )}
    </Space>
  </Card>
);

export default ResetAutoDetectPanel;
