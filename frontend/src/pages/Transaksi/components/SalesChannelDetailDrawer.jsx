import { Empty, Input, Select, Space } from "antd";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import { formatCurrencyId } from "../../../utils/formatters/currencyId";

const SalesChannelDetailDrawer = ({
  summary,
  onClose,
  searchValue,
  onSearchChange,
  statusValue,
  onStatusChange,
  statusOptions,
  columns,
  transactions,
  mobileCardConfig,
}) => (
  <MobileDetailDrawer
    title={summary ? `Detail Channel — ${summary.channel}` : "Detail Channel"}
    placement="right"
    width="min(100vw, 720px)"
    open={Boolean(summary)}
    onClose={onClose}
    destroyOnClose
  >
    {summary ? (
      <>
        <div className="ims-readonly-stat-grid" style={{ marginBottom: 16 }}>
          <div className="ims-readonly-stat-field">
            <div className="ims-readonly-stat-label">Omzet</div>
            <div className="ims-readonly-stat-value">{formatCurrencyId(summary.totalAmount)}</div>
            <div className="ims-cell-meta">Total channel</div>
          </div>
          <div className="ims-readonly-stat-field">
            <div className="ims-readonly-stat-label">Selesai</div>
            <div className="ims-readonly-stat-value">{formatCurrencyId(summary.completedAmount)}</div>
            <div className="ims-cell-meta">Income resmi</div>
          </div>
          <div className="ims-readonly-stat-field">
            <div className="ims-readonly-stat-label">Pending</div>
            <div className="ims-readonly-stat-value">{formatCurrencyId(summary.pendingAmount)}</div>
            <div className="ims-cell-meta">Belum masuk kas</div>
          </div>
        </div>

        <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
          <Input.Search
            placeholder="Cari ref / order / pelanggan"
            allowClear
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            style={{ width: "min(100%, 280px)" }}
          />
          <Select
            value={statusValue}
            onChange={onStatusChange}
            style={{ width: "min(100%, 180px)" }}
            options={[
              { value: "all", label: "Semua Status" },
              ...(statusOptions || []).map((status) => ({ value: status, label: status })),
            ]}
          />
        </Space>

        <DataTableView
          className="app-data-table"
          columns={columns}
          dataSource={transactions}
          rowKey="id"
          pagination={{ pageSize: 5 }}
          size="small"
          tableLayout="fixed"
          scroll={{ x: 560 }}
          showRefreshIndicator={false}
          mobileCardConfig={mobileCardConfig}
          locale={{
            emptyText: (
              <EmptyStateBlock compact
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Tidak ada transaksi yang cocok dengan filter ini."
              />
            ),
          }}
        />
      </>
    ) : null}
  </MobileDetailDrawer>
);

export default SalesChannelDetailDrawer;
