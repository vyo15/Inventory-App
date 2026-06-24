import { FileSearchOutlined } from "@ant-design/icons";
import { Button, Card, Col, Row, Space, Statistic, Tag, Typography } from "antd";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import { MAINTENANCE_DATA_TOOL_CAPABILITIES } from "../../../services/Maintenance/resetMaintenanceDataService";
import { formatMaintenanceDate, getAuditIssueCountColor } from "../utils/resetMaintenanceUiHelpers";

const { Text } = Typography;

const ResetAutoDetectPanel = ({
  autoBugSummary,
  loadingDataQualityAudit,
  onLoadDataQualityAudit,
  dataQualityCategoryRows = [],
  renderCompactText,
}) => (
  <Card
    title="Audit & Health"
    size="small"
    extra={<Tag color={autoBugSummary.color}>{autoBugSummary.status}</Tag>}
  >
    <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <ImsNotice
        variant="guidance"
        compact
        title="Pemeriksaan read-only"
        description="Audit memeriksa integritas SQLite, foreign key, invariant stok master, data turunan stok, registry backup, serta pasangan kas dan ledger. Audit tidak mengubah data bisnis."
      />

      <Row gutter={[12, 12]}>
        <Col xs={12} md={6}>
          <Statistic title="Area Dicek" value={autoBugSummary.checkedAreas || 0} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Record Dicek" value={autoBugSummary.checkedRecords || 0} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Issue" value={autoBugSummary.issueCount || 0} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Kandidat Repair" value={autoBugSummary.safeRepairCount || 0} />
        </Col>
      </Row>

      <Space wrap>
        <Button
          type="primary"
          icon={<FileSearchOutlined />}
          loading={loadingDataQualityAudit}
          disabled={!MAINTENANCE_DATA_TOOL_CAPABILITIES.dataQualityAudit}
          onClick={() => onLoadDataQualityAudit?.()}
        >
          Jalankan Audit Sistem
        </Button>
        <Text type="secondary">
          Audit terakhir: {formatMaintenanceDate(autoBugSummary.auditedAt)}
        </Text>
      </Space>

      <DataTableView
        className="app-data-table"
        size="small"
        loading={loadingDataQualityAudit}
        pagination={false}
        dataSource={dataQualityCategoryRows}
        columns={[
          {
            title: "Area",
            dataIndex: "categoryLabel",
            key: "categoryLabel",
            width: 180,
            render: (value) => renderCompactText(value, 165),
          },
          {
            title: "Dicek",
            dataIndex: "checkedRecords",
            key: "checkedRecords",
            width: 90,
          },
          {
            title: "Issue",
            dataIndex: "count",
            key: "count",
            width: 90,
            render: (value) => <Tag color={getAuditIssueCountColor(value)}>{value || 0}</Tag>,
          },
          {
            title: "Contoh",
            dataIndex: "samplePreview",
            key: "samplePreview",
            render: (value) => renderCompactText(value, 360),
          },
          {
            title: "Rekomendasi",
            dataIndex: "recommendation",
            key: "recommendation",
            render: (value) => renderCompactText(value, 360),
          },
        ]}
        mobileCardConfig={{
          title: (record) => record.categoryLabel || "Area Audit",
          subtitle: (record) => record.recommendation || "Rekomendasi audit",
          tags: (record) => <Tag color={getAuditIssueCountColor(record.count)}>Issue {record.count || 0}</Tag>,
          meta: [
            { label: "Record dicek", value: (record) => record.checkedRecords || 0 },
            { label: "Contoh", value: (record) => record.samplePreview || "Tidak ada temuan." },
          ],
        }}
        scroll={{ x: 980 }}
      />
    </Space>
  </Card>
);

export default ResetAutoDetectPanel;
