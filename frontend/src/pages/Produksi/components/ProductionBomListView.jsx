import { Card, Collapse, Space, Tag, Typography } from "antd";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import StatusTag from "../../../components/Layout/Feedback/StatusTag";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import { DataRefreshIndicator } from "../../../components/Layout/Feedback/DataLoadingState";
import formatNumber from "../../../utils/formatters/numberId";

// IMS NOTE [AKTIF] - Presentational split daftar BOM Produksi.
// Fungsi blok: memisahkan rendering list/global-grouped BOM dari page besar tanpa mengubah filter, columns, dataSource, service call, atau payload BOM.
const ProductionBomListView = ({
  loading,
  filteredData,
  listViewMode,
  columns,
  mobileCardConfig,
  groupedFilteredData,
  shouldAutoOpenBomGroups,
}) => (
  <Card className="page-section ims-production-list-surface">
    {/* ===============================================================
        Tabel utama BOM dibuat compact tanpa horizontal scroll besar.
        Detail komposisi tetap tersedia di drawer detail existing.
    =============================================================== */}
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
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
        }}
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

export default ProductionBomListView;
