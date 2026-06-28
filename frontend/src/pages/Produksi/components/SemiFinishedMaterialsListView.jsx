import { Card, Collapse, Space, Tag, Typography } from "antd";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import StatusTag from "../../../components/Layout/Feedback/StatusTag";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import { DataRefreshIndicator } from "../../../components/Layout/Feedback/DataLoadingState";
import formatNumber from "../../../utils/formatters/numberId";

// IMS NOTE [AKTIF] - Presentational split daftar Semi Finished Materials.
// Fungsi blok: memisahkan rendering list/global-grouped dari page besar tanpa mengubah stok, varian, HPP aktif, service call, atau payload item.
const SemiFinishedMaterialsListView = ({
  loading,
  filteredData,
  listViewMode,
  columns,
  mobileCardConfig,
  groupedFilteredData,
  shouldAutoOpenSemiGroups,
}) => (
  <>
    <DataRefreshIndicator loading={loading} dataSource={filteredData} />
    {listViewMode === "global" ? (
      <DataTableView
        loading={loading}
        showRefreshIndicator={false}
        // AKTIF / GUARDED UI: class standar hanya menyamakan surface table; flow semi finished material dan produksi tidak diubah.
        className="app-data-table"
        rowKey="id"
        size="small"
        tableLayout="fixed"
        columns={columns}
        dataSource={filteredData}
        // AKTIF / GUARDED: primary table memakai layout fixed tanpa horizontal scroll default; stok varian tetap tampil sebagai pill langsung di kolom Stok.
        emptyState={{ description: "Belum ada data semi finished materials" }}
        mobileCardConfig={mobileCardConfig}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} item`,
        }}
      />
    ) : filteredData.length === 0 ? (
      <EmptyStateBlock compact description={loading ? "Memuat data..." : "Belum ada data semi finished materials"} />
    ) : (
      <Collapse
        className="ims-production-group-collapse"
        bordered={false}
        defaultActiveKey={groupedFilteredData[0]?.key ? [groupedFilteredData[0].key] : []}
        activeKey={shouldAutoOpenSemiGroups ? groupedFilteredData.map((group) => group.key) : undefined}
        items={groupedFilteredData.map((familyGroup) => ({
          key: familyGroup.key,
          label: (
            <Space direction="vertical" size={2}>
              <Typography.Text strong>
                Product Family / Jenis Bunga: {familyGroup.label}
              </Typography.Text>
              <Space size={6} wrap>
                <Tag>{formatNumber(familyGroup.items.length)} item</Tag>
                <StatusTag tone="success">Aman {formatNumber(familyGroup.statusCounts.safe)}</StatusTag>
                <Tag color="red">Kosong {formatNumber(familyGroup.statusCounts.empty)}</Tag>
                <Tag color="orange">Rendah {formatNumber(familyGroup.statusCounts.low)}</Tag>
                {familyGroup.statusCounts.inactive > 0 ? (
                  <Tag color="default">Nonaktif {formatNumber(familyGroup.statusCounts.inactive)}</Tag>
                ) : null}
              </Space>
            </Space>
          ),
          children: (
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {familyGroup.categories.map((categoryGroup) => (
                <Card
                  key={categoryGroup.key}
                  size="small"
                  title={`${categoryGroup.label} (${formatNumber(categoryGroup.items.length)} item)`}
                >
                  <DataTableView
                    showRefreshIndicator={false}
                    className="app-data-table"
                    rowKey="id"
                    size="small"
                    tableLayout="fixed"
                    columns={columns}
                    dataSource={categoryGroup.items}
                    pagination={false}
                    emptyState={{ description: "Tidak ada item pada kategori ini" }}
                    mobileCardConfig={mobileCardConfig}
                  />
                </Card>
              ))}
            </Space>
          ),
        }))}
      />
    )}
  </>
);

export default SemiFinishedMaterialsListView;
