import { Space, Tag, Typography } from "antd";
import dayjs from "dayjs";
import StatusTag from "../../../components/Layout/Feedback/StatusTag";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";

const { Text } = Typography;

const StockAdjustmentDetailDrawer = ({
  closeAdjustmentDetail,
  formatQuantityId,
  getStockAdjustmentReasonLabel,
  normalizeCompactText,
  resolveStockAdjustmentItemTypeConfig,
  selectedAdjustmentDetail,
}) => (
      <MobileDetailDrawer
        title="Detail Penyesuaian Stok"
        open={Boolean(selectedAdjustmentDetail)}
        onClose={closeAdjustmentDetail}
        width="min(100vw, 420px)"
      >
        {selectedAdjustmentDetail ? (() => {
          const itemTypeConfig = resolveStockAdjustmentItemTypeConfig({
            itemType: selectedAdjustmentDetail.itemType,
            collectionName: selectedAdjustmentDetail.collectionName,
          });
          const reasonText = getStockAdjustmentReasonLabel(selectedAdjustmentDetail.reason);

          return (
            <Space direction="vertical" size={14} style={{ width: "100%" }}>
              <div className="ims-cell-stack">
                <Text type="secondary">Tanggal</Text>
                <Text strong>
                  {selectedAdjustmentDetail.date?.toDate
                    ? dayjs(selectedAdjustmentDetail.date.toDate()).format("DD-MM-YYYY")
                    : "-"}
                </Text>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Item</Text>
                <Text strong>{selectedAdjustmentDetail.itemName || "-"}</Text>
                <Space wrap>
                  <Tag color={itemTypeConfig.tagColor}>{itemTypeConfig.label}</Tag>
                  {selectedAdjustmentDetail.variantLabel ? <Tag color="purple">{selectedAdjustmentDetail.variantLabel}</Tag> : null}
                </Space>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Adjustment</Text>
                <Space wrap>
                  {selectedAdjustmentDetail.adjustmentType === "in" ? (
                    <StatusTag tone="success">Tambah</StatusTag>
                  ) : (
                    <Tag color="red">Kurang</Tag>
                  )}
                  <Text strong>{formatQuantityId(selectedAdjustmentDetail.quantity, selectedAdjustmentDetail.unit)}</Text>
                </Space>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Alasan</Text>
                <Text>{reasonText}</Text>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Catatan</Text>
                <Text>{normalizeCompactText(selectedAdjustmentDetail.note) || "-"}</Text>
              </div>
            </Space>
          );
        })() : null}
      </MobileDetailDrawer>
);

export default StockAdjustmentDetailDrawer;
