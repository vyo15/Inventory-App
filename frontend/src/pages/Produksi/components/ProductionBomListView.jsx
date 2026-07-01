import { Badge, Card, Collapse, Space, Tag, Tooltip, Typography } from "antd";
import { EditOutlined, EyeOutlined } from "@ant-design/icons";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import StatusTag from "../../../components/Layout/Feedback/StatusTag";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import TableActionMenu from "../../../components/Layout/Table/TableActionMenu";
import { DataRefreshIndicator } from "../../../components/Layout/Feedback/DataLoadingState";
import { BOM_TARGET_TYPE_MAP } from "../../../constants/productionBomOptions";
import formatCurrency from "../../../utils/formatters/currencyId";
import formatNumber from "../../../utils/formatters/numberId";
import { clampTwoLineStyle, compactTagStyle } from "../helpers/productionBomsPageHelpers";

const createBomColumns = ({ onEdit, onToggleActive, onViewDetail }) => [
  {
    title: "BOM / Target",
    key: "bomTarget",
    width: "34%",
    render: (_, record) => (
      <Space direction="vertical" size={6} style={{ width: "100%" }}>
        <Tooltip title={record.name || "-"}>
          <Typography.Text strong style={{ ...clampTwoLineStyle }}>
            {record.name || "-"}
          </Typography.Text>
        </Tooltip>
        <Tooltip title={record.description || "Belum ada deskripsi"}>
          <Typography.Text type="secondary" style={clampTwoLineStyle}>
            {record.description || "Belum ada deskripsi"}
          </Typography.Text>
        </Tooltip>
        <Space size={6} wrap>
          <Tag color="blue" style={compactTagStyle}>
            {BOM_TARGET_TYPE_MAP[record.targetType] || "-"}
          </Tag>
          <Tooltip title={record.targetName || "-"}>
            <Typography.Text style={{ ...clampTwoLineStyle, maxWidth: 220 }}>
              {record.targetName || "-"}
            </Typography.Text>
          </Tooltip>
        </Space>
      </Space>
    ),
  },
  {
    title: "Komposisi / Output",
    key: "compositionOutput",
    width: "22%",
    render: (_, record) => (
      <Space direction="vertical" size={4}>
        <Space size={6} wrap>
          <Tag style={compactTagStyle}>Material: {formatNumber(record.materialLines?.length || 0)}</Tag>
          <Tag style={compactTagStyle}>Step: {formatNumber(record.stepLines?.length || 0)}</Tag>
        </Space>
        <Typography.Text type="secondary">Output batch</Typography.Text>
        <Typography.Text strong>
          {formatNumber(record.batchOutputQty || 0)} {record.targetUnit || "pcs"}
        </Typography.Text>
      </Space>
    ),
  },
  {
    title: "Estimasi",
    key: "estimate",
    width: "22%",
    render: (_, record) => (
      <Space direction="vertical" size={2}>
        <Typography.Text>Material: {formatCurrency(record.materialCostEstimate || 0)}</Typography.Text>
        <Typography.Text>Upah step: {formatCurrency(record.laborCostEstimate || 0)}</Typography.Text>
        {Number(record.overheadCostEstimate || 0) > 0 ? (
          <Typography.Text>Overhead: {formatCurrency(record.overheadCostEstimate || 0)}</Typography.Text>
        ) : null}
        <Typography.Text strong>Total: {formatCurrency(record.totalCostEstimate || 0)}</Typography.Text>
      </Space>
    ),
  },
  {
    title: "Status",
    key: "status",
    width: 116,
    align: "center",
    className: "app-table-status-column",
    render: (_, record) => (
      <Space direction="vertical" size={0}>
        {record.isActive ? <Badge status="success" text="Aktif" /> : <Badge status="default" text="Nonaktif" />}
        {record.isDefault ? (
          <Typography.Text type="secondary" className="ims-cell-meta">Default</Typography.Text>
        ) : null}
      </Space>
    ),
  },
  {
    title: "Aksi",
    key: "actions",
    width: 132,
    className: "app-table-action-column",
    render: (_, record) => (
      <TableActionMenu
        visibleActions={[{
          key: "detail",
          label: "Detail",
          icon: <EyeOutlined />,
          onClick: () => onViewDetail(record),
        }]}
        moreActions={[
          {
            key: "edit",
            label: "Edit",
            icon: <EditOutlined />,
            onClick: () => onEdit(record),
          },
          {
            key: "toggle",
            label: record.isActive ? "Nonaktifkan" : "Aktifkan",
            danger: record.isActive,
            confirm: {
              title: record.isActive ? "Nonaktifkan BOM ini?" : "Aktifkan BOM ini?",
              okText: "Ya",
              cancelText: "Batal",
            },
            onClick: () => onToggleActive(record),
          },
        ]}
      />
    ),
  },
];

const createBomMobileCardConfig = ({ onEdit, onToggleActive, onViewDetail }) => ({
  title: (record) => record.name || "-",
  subtitle: (record) => [record.targetName || "Target belum tercatat", record.description || null].filter(Boolean),
  tags: (record) => [
    <Tag key="target-type" color="blue" style={compactTagStyle}>
      {BOM_TARGET_TYPE_MAP[record.targetType] || "-"}
    </Tag>,
    record.isActive ? (
      <StatusTag key="status" tone="success" style={compactTagStyle}>Aktif</StatusTag>
    ) : (
      <StatusTag key="status" tone="neutral" style={compactTagStyle}>Nonaktif</StatusTag>
    ),
    record.isDefault ? <Tag key="default" color="purple" style={compactTagStyle}>Default</Tag> : null,
  ].filter(Boolean),
  meta: [
    { label: "Material", value: (record) => formatNumber(record.materialLines?.length || 0) },
    { label: "Step", value: (record) => formatNumber(record.stepLines?.length || 0) },
    {
      label: "Output Batch",
      value: (record) => `${formatNumber(record.batchOutputQty || 0)} ${record.targetUnit || "pcs"}`,
    },
    { label: "Estimasi", value: (record) => formatCurrency(record.totalCostEstimate || 0) },
  ],
  content: (record) => [
    `Material: ${formatCurrency(record.materialCostEstimate || 0)}`,
    `Upah step: ${formatCurrency(record.laborCostEstimate || 0)}`,
    Number(record.overheadCostEstimate || 0) > 0
      ? `Overhead: ${formatCurrency(record.overheadCostEstimate || 0)}`
      : null,
  ].filter(Boolean),
  primaryActions: (record) => [{
    key: "detail",
    label: "Detail",
    icon: <EyeOutlined />,
    onClick: () => onViewDetail(record),
  }],
  moreActions: (record) => [
    {
      key: "edit",
      label: "Edit",
      icon: <EditOutlined />,
      onClick: () => onEdit(record),
    },
    {
      key: "toggle",
      label: record.isActive ? "Nonaktifkan" : "Aktifkan",
      danger: record.isActive,
      confirm: {
        title: record.isActive ? "Nonaktifkan BOM ini?" : "Aktifkan BOM ini?",
        okText: "Ya",
        cancelText: "Batal",
      },
      onClick: () => onToggleActive(record),
    },
  ],
});

const ProductionBomListView = ({
  loading,
  filteredData,
  listViewMode,
  groupedFilteredData,
  shouldAutoOpenBomGroups,
  onEdit,
  onToggleActive,
  onViewDetail,
}) => {
  const actionHandlers = { onEdit, onToggleActive, onViewDetail };
  const columns = createBomColumns(actionHandlers);
  const mobileCardConfig = createBomMobileCardConfig(actionHandlers);

  return (
    <Card className="page-section ims-production-list-surface">
      <DataRefreshIndicator loading={loading} dataSource={filteredData} />
      {listViewMode === "global" ? (
        <DataTableView
          loading={loading}
          showRefreshIndicator={false}
          className="app-data-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          emptyState={{ description: "Belum ada data BOM produksi" }}
          mobileCardConfig={mobileCardConfig}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      ) : filteredData.length === 0 ? (
        <EmptyStateBlock compact description={loading ? "Memuat data..." : "Belum ada data BOM produksi"} />
      ) : (
        <Collapse
          className="ims-production-group-collapse"
          bordered={false}
          defaultActiveKey={groupedFilteredData[0]?.key ? [groupedFilteredData[0].key] : []}
          activeKey={shouldAutoOpenBomGroups ? groupedFilteredData.map((group) => group.key) : undefined}
          items={groupedFilteredData.map((typeGroup) => ({
            key: typeGroup.key,
            label: (
              <Space direction="vertical" size={2}>
                <Typography.Text strong>{typeGroup.label}</Typography.Text>
                <Space size={6} wrap>
                  <Tag>{formatNumber(typeGroup.items.length)} BOM</Tag>
                  <StatusTag tone="success">Aktif {formatNumber(typeGroup.counts.active)}</StatusTag>
                  <Tag color="blue">Default {formatNumber(typeGroup.counts.default)}</Tag>
                  {typeGroup.counts.inactive > 0 ? (
                    <Tag color="default">Nonaktif {formatNumber(typeGroup.counts.inactive)}</Tag>
                  ) : null}
                </Space>
              </Space>
            ),
            children: (
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                {typeGroup.targets.map((targetGroup) => (
                  <Card
                    key={targetGroup.key}
                    size="small"
                    title={`${targetGroup.label} (${formatNumber(targetGroup.items.length)} BOM)`}
                  >
                    <DataTableView
                      showRefreshIndicator={false}
                      className="app-data-table"
                      rowKey="id"
                      columns={columns}
                      dataSource={targetGroup.items}
                      pagination={false}
                      emptyState={{ description: "Tidak ada BOM pada target ini" }}
                      mobileCardConfig={mobileCardConfig}
                    />
                  </Card>
                ))}
              </Space>
            ),
          }))}
        />
      )}
    </Card>
  );
};

export default ProductionBomListView;
