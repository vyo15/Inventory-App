import { Space, Tag, Typography } from "antd";
import dayjs from "dayjs";
import MobileDetailDrawer from "../../../components/Layout/Mobile/MobileDetailDrawer";
import { formatCurrencyId } from "../../../utils/formatters/currencyId";
import { formatNumberId } from "../../../utils/formatters/numberId";

const { Text } = Typography;

const PurchaseDetailDrawer = ({
  closePurchaseDetail,
  selectedPurchaseDetail,
}) => (
      <MobileDetailDrawer
        title="Detail Pembelian"
        open={Boolean(selectedPurchaseDetail)}
        onClose={closePurchaseDetail}
        width="min(100vw, 440px)"
      >
        {selectedPurchaseDetail ? (() => {
          const dateText = selectedPurchaseDetail.date?.toDate
            ? dayjs(selectedPurchaseDetail.date.toDate()).format("DD-MM-YYYY")
            : "-";
          const stockIn = selectedPurchaseDetail.type === "material"
            ? selectedPurchaseDetail.totalStockIn || selectedPurchaseDetail.quantity
            : selectedPurchaseDetail.quantity;

          return (
            <Space direction="vertical" size={14} style={{ width: "100%" }}>
              <div className="ims-cell-stack">
                <Text type="secondary">Kode / Tanggal</Text>
                <Text strong>{selectedPurchaseDetail.purchaseNumber || selectedPurchaseDetail.code || selectedPurchaseDetail.referenceNumber || "Kode otomatis"}</Text>
                <Text>{dateText}</Text>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Supplier</Text>
                <Text strong>{selectedPurchaseDetail.supplierName || "Supplier tidak tercatat"}</Text>
              </div>
              <Space wrap>
                <Tag color={selectedPurchaseDetail.purchaseType === "offline" ? "default" : "blue"}>
                  {selectedPurchaseDetail.purchaseType === "offline" ? "Offline" : "Online"}
                </Tag>
                <Tag color={selectedPurchaseDetail.type === "product" ? "blue" : "gold"}>
                  {selectedPurchaseDetail.type === "product" ? "Produk" : "Bahan Baku"}
                </Tag>
                {selectedPurchaseDetail.variantLabel || selectedPurchaseDetail.variantKey ? (
                  <Tag color="purple">{selectedPurchaseDetail.variantLabel || selectedPurchaseDetail.variantKey}</Tag>
                ) : (
                  <Tag>Master</Tag>
                )}
              </Space>
              <div className="ims-cell-stack">
                <Text type="secondary">Item</Text>
                <Text strong>{selectedPurchaseDetail.itemName || "-"}</Text>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Qty / Stok Masuk</Text>
                <Text>Qty beli: {formatNumberId(selectedPurchaseDetail.quantity || 0)}{selectedPurchaseDetail.purchaseUnit ? ` ${selectedPurchaseDetail.purchaseUnit}` : ""}</Text>
                <Text strong>Stok masuk: {formatNumberId(stockIn || 0)}{selectedPurchaseDetail.stockUnit ? ` ${selectedPurchaseDetail.stockUnit}` : ""}</Text>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Biaya</Text>
                <Text strong>Total: {formatCurrencyId(selectedPurchaseDetail.totalActualPurchase || 0)}</Text>
                <Text>Modal: {formatCurrencyId(selectedPurchaseDetail.actualUnitCost || 0)}{selectedPurchaseDetail.stockUnit ? ` / ${selectedPurchaseDetail.stockUnit}` : ""}</Text>
              </div>
              <div className="ims-cell-stack">
                <Text type="secondary">Catatan</Text>
                <Text style={{ whiteSpace: "pre-line" }}>{selectedPurchaseDetail.note || "-"}</Text>
              </div>
            </Space>
          );
        })() : null}
      </MobileDetailDrawer>
);

export default PurchaseDetailDrawer;
