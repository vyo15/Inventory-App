import { Space, Tag, Typography } from "antd";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";

const { Text } = Typography;

const StockItemDetailDrawer = ({
  record,
  onClose,
  formatDate,
  formatQuantity,
  resolveTypeLabel,
}) => (
  <MobileDetailDrawer
    title="Detail Riwayat Stok"
    open={Boolean(record)}
    onClose={onClose}
    width="min(100vw, 420px)"
  >
    {record ? (
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <div className="ims-cell-stack">
          <Text type="secondary">Tanggal</Text>
          <Text strong>{formatDate(record.timestamp)}</Text>
        </div>
        <div className="ims-cell-stack">
          <Text type="secondary">Item</Text>
          <Text strong>{record.itemName || "-"}</Text>
          <Text type="secondary">
            {record.itemTypeLabel || resolveTypeLabel(record.collectionName)}
            {record.variantLabelResolved ? ` • Varian: ${record.variantLabelResolved}` : ""}
          </Text>
        </div>
        <Space wrap>
          <Tag color={record.directionMeta?.color || "default"}>
            {record.directionMeta?.label || "-"}
          </Tag>
          <Tag color={record.sourceMeta?.color || "default"}>
            {record.sourceMeta?.label || "-"}
          </Tag>
        </Space>
        <div className="ims-cell-stack">
          <Text type="secondary">Qty</Text>
          <Text
            strong
            style={{
              color:
                record.directionMeta?.value === "in"
                  ? "var(--ims-color-success-text)"
                  : "var(--ims-color-danger-text)",
            }}
          >
            {formatQuantity(record.quantityChange, record)}
          </Text>
        </div>
        <div className="ims-cell-stack">
          <Text type="secondary">Referensi Audit</Text>
          {Array.isArray(record.referenceItems) && record.referenceItems.length > 0 ? (
            <Space direction="vertical" size={6}>
              {record.referenceItems.map((item) => (
                <div
                  key={`${item.label}-${item.referenceId || item.detail}`}
                  className="ims-cell-stack ims-cell-stack-tight"
                >
                  <Text strong>{item.label}</Text>
                  {item.detail ? <Text type="secondary">{item.detail}</Text> : null}
                </div>
              ))}
            </Space>
          ) : (
            <Text type="secondary">-</Text>
          )}
        </div>
        <div className="ims-cell-stack">
          <Text type="secondary">Catatan</Text>
          <Text>{record.noteText || "-"}</Text>
        </div>
      </Space>
    ) : null}
  </MobileDetailDrawer>
);

export default StockItemDetailDrawer;
