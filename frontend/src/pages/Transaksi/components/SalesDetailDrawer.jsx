import { Space, Tag, Typography } from "antd";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";
import { formatCurrencyId } from "../../../utils/formatters/currencyId";
import { formatNumberId } from "../../../utils/formatters/numberId";
import {
  getSaleDisplayReference,
  getSaleExternalReference,
  getSalesStatusColor,
} from "../helpers/salesPageHelpers";

const { Text } = Typography;

const SalesDetailDrawer = ({ sale, onClose }) => (
  <MobileDetailDrawer
    title="Detail Penjualan"
    open={Boolean(sale)}
    onClose={onClose}
    width="min(100vw, 440px)"
  >
    {sale ? (
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <div className="ims-cell-stack">
          <Text type="secondary">Referensi</Text>
          <Text strong>{getSaleDisplayReference(sale)}</Text>
          {getSaleExternalReference(sale) !== "-" ? (
            <Text type="secondary">Order marketplace: {getSaleExternalReference(sale)}</Text>
          ) : null}
        </div>
        <div className="ims-cell-stack">
          <Text type="secondary">Tanggal / Customer</Text>
          <Text strong>{sale.date || "-"}</Text>
          <Text>{sale.customerName || "Customer tidak tercatat"}</Text>
        </div>
        <Space wrap>
          <Tag>{sale.salesChannel || "Channel tidak tercatat"}</Tag>
          <Tag color={getSalesStatusColor(sale.status)}>{sale.status || "-"}</Tag>
        </Space>
        <div className="ims-cell-stack">
          <Text type="secondary">Total</Text>
          <Text strong>{formatCurrencyId(sale.total || 0)}</Text>
        </div>
        <div className="ims-cell-stack">
          <Text type="secondary">Item</Text>
          {Array.isArray(sale.items) && sale.items.length > 0 ? (
            <Space direction="vertical" size={8} style={{ width: "100%" }}>
              {sale.items.map((item, index) => (
                <div
                  key={`${item.itemId || item.itemName || "item"}-${index}`}
                  className="ims-cell-stack ims-cell-stack-tight"
                >
                  <Text strong>
                    {item.itemName || "Item"}{item.variantLabel ? ` - ${item.variantLabel}` : ""}
                  </Text>
                  <Text type="secondary">
                    {formatNumberId(item.quantity)} x {formatCurrencyId(item.pricePerUnit || 0)} = {formatCurrencyId(item.subtotal || 0)}
                  </Text>
                </div>
              ))}
            </Space>
          ) : (
            <Text type="secondary">Item belum tercatat.</Text>
          )}
        </div>
      </Space>
    ) : null}
  </MobileDetailDrawer>
);

export default SalesDetailDrawer;
