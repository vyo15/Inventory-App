import { Input, Space } from "antd";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";

const ProductionStepRelationDrawer = ({
  columns,
  dataSource,
  emptyDescription,
  mobileCardConfig,
  onClose,
  onSearchChange,
  open,
  searchPlaceholder,
  searchValue,
  title,
  width,
}) => (
  <MobileDetailDrawer
    title={title}
    open={open}
    onClose={onClose}
    width={width}
  >
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Input
        placeholder={searchPlaceholder}
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        allowClear
      />

      <DataTableView
        rowKey="id"
        columns={columns}
        dataSource={dataSource}
        pagination={{ pageSize: 8, showSizeChanger: true }}
        showRefreshIndicator={false}
        mobileCardConfig={mobileCardConfig}
        locale={{ emptyText: <EmptyStateBlock compact description={emptyDescription} /> }}
      />
    </Space>
  </MobileDetailDrawer>
);

export default ProductionStepRelationDrawer;
