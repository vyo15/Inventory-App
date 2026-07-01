import { Descriptions, Divider, Space, Tag, Typography } from "antd";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";
import {
  BOM_MATERIAL_ITEM_TYPE_MAP,
  BOM_TARGET_TYPE_MAP,
} from "../../../constants/productionBomOptions";
import formatCurrency, { formatHppUnitCurrencyId } from "../../../utils/formatters/currencyId";
import formatNumber from "../../../utils/formatters/numberId";
import { resolveBomCostSourceLabel } from "../../../utils/produksi/productionBomCostHelpers";

const ProductionBomDetailDrawer = ({
  detailVisible,
  selectedBom,
  setDetailVisible,
}) => (
      <MobileDetailDrawer
        title="Detail BOM Produksi"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={760}
      >
        {!selectedBom ? (
          <EmptyStateBlock compact description="Tidak ada data" />
        ) : (
          <>
            <Descriptions
              column={1}
              bordered
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Descriptions.Item label="Nama">
                {selectedBom.name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Target Type">
                {BOM_TARGET_TYPE_MAP[selectedBom.targetType] || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Target Name">
                {selectedBom.targetName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Estimasi Material">
                {formatCurrency(selectedBom.materialCostEstimate)}
              </Descriptions.Item>
              <Descriptions.Item label="Estimasi Upah Step">
                {formatCurrency(selectedBom.laborCostEstimate)}
              </Descriptions.Item>
              <Descriptions.Item label="Overhead Manual">
                {formatCurrency(selectedBom.overheadCostEstimate)}
              </Descriptions.Item>
              <Descriptions.Item label="Estimasi Total">
                {formatCurrency(selectedBom.totalCostEstimate)}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {selectedBom.isActive ? "Aktif" : "Nonaktif"}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">Komposisi Bahan</Divider>

            <DataTableView
              rowKey={(record) => record.id}
              pagination={false}
              size="small"
              showRefreshIndicator={false}
              dataSource={selectedBom.materialLines || []}
              locale={{ emptyText: "Belum ada material line" }}
              mobileCardConfig={{
                title: (record) => record.itemName || "Material",
                tags: (record) => <Tag>{BOM_MATERIAL_ITEM_TYPE_MAP[record.itemType] || "-"}</Tag>,
                meta: [
                  { label: "Qty Total", value: (record) => formatNumber(record.totalRequiredQty) },
                  { label: "Cost", value: (record) => formatCurrency(record.totalCostSnapshot) },
                  { label: "Cost/Unit", value: (record) => `${formatHppUnitCurrencyId(record.costPerUnitSnapshot)} / ${record.unit || "pcs"}` },
                ],
                subtext: (record) => resolveBomCostSourceLabel(record.costSourceSnapshot),
              }}
              columns={[
                {
                  title: "Item",
                  key: "item",
                  render: (_, record) => (
                    <div>
                      <div className="ims-cell-title">
                        {record.itemName || "-"}
                      </div>
                    </div>
                  ),
                },
                {
                  title: "Tipe",
                  dataIndex: "itemType",
                  render: (value) => (
                    <Tag>{BOM_MATERIAL_ITEM_TYPE_MAP[value] || "-"}</Tag>
                  ),
                },
                {
                  title: "Qty Total",
                  dataIndex: "totalRequiredQty",
                  render: (value) => formatNumber(value),
                },
                {
                  title: "Cost",
                  key: "cost",
                  render: (_, record) => (
                    <Space direction="vertical" size={0}>
                      <Typography.Text>{formatCurrency(record.totalCostSnapshot)}</Typography.Text>
                      <Typography.Text type="secondary" className="ims-cell-meta">
                        {formatHppUnitCurrencyId(record.costPerUnitSnapshot)} / {record.unit || "pcs"}
                      </Typography.Text>
                      <Typography.Text type="secondary" className="ims-cell-meta">
                        {resolveBomCostSourceLabel(record.costSourceSnapshot)}
                      </Typography.Text>
                    </Space>
                  ),
                },
              ]}
            />

            <Divider orientation="left">Tahapan Pekerjaan</Divider>

            <DataTableView
              rowKey={(record) => record.id}
              pagination={false}
              size="small"
              showRefreshIndicator={false}
              dataSource={selectedBom.stepLines || []}
              locale={{ emptyText: "Belum ada step line" }}
              mobileCardConfig={{
                title: (record) => `Langkah ${formatNumber(record.sequenceNo)} - ${record.stepName || "-"}`,
                meta: [
                  { label: "Estimasi Upah", value: (record) => formatCurrency(record.laborCostEstimateSnapshot || 0) },
                ],
                subtext: (record) => record.notes || null,
              }}
              columns={[
                {
                  title: "Urutan Langkah",
                  key: "step",
                  render: (_, record) => (
                    <div>
                      <div className="ims-cell-title">
                        Langkah {formatNumber(record.sequenceNo)} -{" "}
                        {record.stepName || "-"}
                      </div>
                      {record.notes ? (
                        <div className="ims-cell-meta">{record.notes}</div>
                      ) : null}
                    </div>
                  ),
                },
                {
                  title: "Estimasi Upah",
                  key: "laborEstimate",
                  width: 160,
                  render: (_, record) => formatCurrency(record.laborCostEstimateSnapshot || 0),
                },
              ]}
            />
          </>
        )}
      </MobileDetailDrawer>
);

export default ProductionBomDetailDrawer;
