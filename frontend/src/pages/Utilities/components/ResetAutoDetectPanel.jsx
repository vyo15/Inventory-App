import { FileSearchOutlined } from "@ant-design/icons";
import { Button, Card, Col, Row, Space, Tag } from "antd";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import { buildAutoDetectIssueSummaryMessage, getAuditIssueCountColor } from "../utils/resetMaintenanceUiHelpers";

const ResetAutoDetectPanel = ({
  autoBugSummary,
  loadingAutoDetect,
  loadingStockAudit,
  loadingTransactionVariantAudit,
  onRunAllAudits,
  onLoadStockAudit,
  onLoadTransactionVariantAudit,
  auditOverviewRows,
  auditIssueRows,
  renderCompactText,
}) => (
  <Card title="Auto Detect Bug Data" size="small" extra={<Tag color={autoBugSummary.color}>{autoBugSummary.status}</Tag>}>
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Row gutter={[8, 8]}>
        <Col xs={24} md={8}>
          <Button block type="primary" icon={<FileSearchOutlined />} loading={loadingAutoDetect} onClick={onRunAllAudits}>
            Cek Semua Area
          </Button>
        </Col>
        <Col xs={24} md={8}>
          <Button block icon={<FileSearchOutlined />} loading={loadingStockAudit} onClick={onLoadStockAudit}>
            Cek Stok
          </Button>
        </Col>
        <Col xs={24} md={8}>
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
      {auditIssueRows.length > 0 && (
        <ImsNotice
          variant="data-quality"
          compact
          title={buildAutoDetectIssueSummaryMessage(autoBugSummary)}
          description="Gunakan ringkasan area dan Repair Aman sebagai langkah berikutnya. Audit hanya membaca data dan tidak melakukan backfill otomatis."
        />
      )}
    </Space>
  </Card>
);

export default ResetAutoDetectPanel;
