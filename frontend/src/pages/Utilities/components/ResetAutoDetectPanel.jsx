import { FileSearchOutlined } from "@ant-design/icons";
import { Button, Card, Col, Row, Space, Tag } from "antd";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import { buildAutoDetectIssueSummaryMessage, getAuditIssueCountColor } from "../utils/resetMaintenanceUiHelpers";
import {
  MAINTENANCE_DATA_TOOLS_AVAILABLE,
  MAINTENANCE_DATA_TOOLS_MODE,
  MAINTENANCE_DATA_TOOLS_UNAVAILABLE_MESSAGE,
} from "../../../services/Maintenance/resetMaintenanceDataService";

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
}) => {
  if (!MAINTENANCE_DATA_TOOLS_AVAILABLE) {
    return (
      <Card title="Auto Detect Bug Data" size="small" extra={<Tag color="orange">Belum tersedia</Tag>}>
        <ImsNotice
          variant="guidance"
          compact
          title="Audit otomatis belum diaktifkan"
          description={MAINTENANCE_DATA_TOOLS_UNAVAILABLE_MESSAGE}
        />
      </Card>
    );
  }

  if (MAINTENANCE_DATA_TOOLS_MODE === "safe_subset") {
    return (
      <Card title="Audit Kualitas Data" size="small" extra={<Tag color={autoBugSummary.color}>{autoBugSummary.status}</Tag>}>
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <ImsNotice
            variant="guidance"
            compact
            title="Audit read-only aktif"
            description="Audit memeriksa integrity SQLite, invariant stok, data turunan stok, registry backup, serta pasangan kas-ledger. Tidak ada data bisnis yang diubah."
          />
          <Button
            type="primary"
            icon={<FileSearchOutlined />}
            loading={loadingDataQualityAudit || loadingAutoDetect}
            onClick={() => onLoadDataQualityAudit?.({ showProblemPreview: false })}
          >
            Jalankan Audit Aman
          </Button>
          <DataTableView
            className="app-data-table"
            size="small"
            pagination={false}
            dataSource={dataQualityCategoryRows}
            columns={[
              { title: "Area", dataIndex: "categoryLabel", key: "categoryLabel", width: 180, render: (value) => renderCompactText(value, 165) },
              { title: "Issue", dataIndex: "count", key: "count", width: 90, render: (value) => <Tag color={getAuditIssueCountColor(value)}>{value || 0}</Tag> },
              { title: "Contoh", dataIndex: "samplePreview", key: "samplePreview", render: (value) => renderCompactText(value, 360) },
              { title: "Rekomendasi", dataIndex: "recommendation", key: "recommendation", render: (value) => renderCompactText(value, 360) },
            ]}
            mobileCardConfig={{
              title: (record) => record.categoryLabel || "Area Audit",
              subtitle: (record) => record.recommendation || "Rekomendasi audit",
              tags: (record) => <Tag color={getAuditIssueCountColor(record.count)}>Issue {record.count || 0}</Tag>,
              meta: [{ label: "Contoh", value: (record) => record.samplePreview || "Tidak ada temuan." }],
            }}
            scroll={{ x: 920 }}
          />
          <ImsNotice
            variant="status"
            compact
            title="Repair otomatis dibatasi"
            description={MAINTENANCE_DATA_TOOLS_UNAVAILABLE_MESSAGE}
          />
        </Space>
      </Card>
    );
  }

  return (
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
};

export default ResetAutoDetectPanel;
