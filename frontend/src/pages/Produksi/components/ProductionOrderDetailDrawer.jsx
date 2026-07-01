import {
  Badge,
  Card,
  Col,
  Descriptions,
  Divider,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from "antd";
import DataTableView from "../../../components/Layout/Table/DataTableView";
import EmptyStateBlock from "../../../components/Layout/Feedback/EmptyStateBlock";
import ImsNotice from "../../../components/Layout/Feedback/ImsNotice";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";
import formatNumber from "../../../utils/formatters/numberId";
import { resolveDisplayReference } from "../../../utils/references/displayReferenceResolver";
import {
  ORDER_STATUS_MAP,
  formatDateTimeLabel,
  formatQtyWithUnit,
  getPriorityMeta,
  getRequirementStockSourceMeta,
} from "../helpers/productionOrdersPageHelpers";

const ProductionOrderDetailDrawer = ({
  detailRequirementColumns,
  detailVisible,
  selectedOrder,
  setDetailVisible,
}) => (
      <MobileDetailDrawer
        title="Detail Production Order"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={920}
      >
        {!selectedOrder ? (
          <EmptyStateBlock compact description="Tidak ada data" />
        ) : (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Qty Batch"
                    value={formatNumber(selectedOrder.batchCount ?? selectedOrder.orderQty)}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Estimasi Output"
                    value={formatNumber(selectedOrder.expectedOutputQty || 0)}
                    suffix={selectedOrder.targetUnit || "pcs"}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Typography.Text type="secondary">Priority</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    <Tag color={getPriorityMeta(selectedOrder.priority).color}>
                      {getPriorityMeta(selectedOrder.priority).label}
                    </Tag>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Typography.Text type="secondary">Status</Typography.Text>
                  <div style={{ marginTop: 8 }}>
                    <Badge
                      status={(ORDER_STATUS_MAP[selectedOrder.status] || ORDER_STATUS_MAP.draft).status}
                      text={(ORDER_STATUS_MAP[selectedOrder.status] || ORDER_STATUS_MAP.draft).text}
                    />
                  </div>
                </Card>
              </Col>
            </Row>

            {/* =====================================================
                Ringkasan order.
                Blok ini dipakai user operasional untuk membaca target, BOM,
                dan priority tanpa harus memindai tabel requirement. */}
            <Descriptions
              bordered
              size="small"
              column={1}
              title="Ringkasan Order"
            >
              <Descriptions.Item label="Kode">
                {resolveDisplayReference(selectedOrder, { fields: ["code", "productionOrderCode"], fallback: "-" })}
              </Descriptions.Item>
              <Descriptions.Item label="Target Type">
                {selectedOrder.targetType === "product" ? "Product" : "Semi Finished"}
              </Descriptions.Item>
              <Descriptions.Item label="Target">
                {selectedOrder.targetName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Varian Target">
                {selectedOrder.targetVariantLabel || "-"}
              </Descriptions.Item>
              {/* =====================================================
                  ACTIVE - display planning reference.
                  Fungsi:
                  - PO manual lama tetap menampilkan tanda "-";
                  - PO dari planning punya jejak balik tanpa mengubah lifecycle PO.
              ===================================================== */}
              <Descriptions.Item label="Planning Reference">
                {selectedOrder.planningCode
                  ? `${selectedOrder.planningCode}${selectedOrder.planningTitle ? ` - ${selectedOrder.planningTitle}` : ""}`
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="BOM / Step">
                {selectedOrder.bomName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag color={getPriorityMeta(selectedOrder.priority).color}>
                  {getPriorityMeta(selectedOrder.priority).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Dibuat Pada">
                {formatDateTimeLabel(selectedOrder.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Mulai Produksi">
                {formatDateTimeLabel(selectedOrder.startedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="Catatan">
                {selectedOrder.notes || "-"}
              </Descriptions.Item>
            </Descriptions>

            {(selectedOrder.reservationSummary?.shortageLines || 0) > 0 ? (
              <ImsNotice
                variant="critical"
                compact
                title={`Ada ${formatNumber(
                  selectedOrder.reservationSummary?.shortageLines,
                )} item yang stoknya masih kurang.`}
                description="Cek requirement yang perlu disiapkan."
              />
            ) : (
              <ImsNotice
                variant="status"
                compact
                title="Semua kebutuhan material cukup dan siap untuk mulai produksi."
                description="PO siap masuk antrian produksi."
              />
            )}

            <Divider orientation="left">Requirement Material</Divider>

            <DataTableView
              className="ims-table"
              rowKey="id"
              pagination={false}
              showRefreshIndicator={false}
              dataSource={selectedOrder.materialRequirementLines || []}
              columns={detailRequirementColumns}
              tableLayout="fixed"
              mobileCardConfig={{
                title: (record) => record.itemName || "Material",
                tags: (record) => {
                  const sourceMeta = getRequirementStockSourceMeta(record);
                  return [
                    <Tag key="type" className="ims-status-tag" color={record.itemType === "raw_material" ? "orange" : "blue"}>
                      {record.itemType === "raw_material" ? "Raw Material" : "Semi Finished"}
                    </Tag>,
                    <Tag key="source" className="ims-status-tag" color={sourceMeta.color}>
                      {sourceMeta.label}
                    </Tag>,
                    record.isSufficient ? <Badge key="ok" status="success" text="Cukup" /> : <Badge key="short" status="error" text="Kurang" />,
                  ];
                },
                subtitle: (record) => getRequirementStockSourceMeta(record).variantLabel,
                meta: [
                  { label: "Need", value: (record) => formatQtyWithUnit(record.qtyRequired, record.unit) },
                  { label: "Current", value: (record) => formatQtyWithUnit(record.currentStockSnapshot, record.unit) },
                  { label: "Tersedia", value: (record) => formatQtyWithUnit(record.availableStockSnapshot, record.unit) },
                  { label: "Kurang", value: (record) => formatQtyWithUnit(record.shortageQty || 0, record.unit) },
                ],
              }}
            />
          </Space>
        )}
      </MobileDetailDrawer>
);

export default ProductionOrderDetailDrawer;
