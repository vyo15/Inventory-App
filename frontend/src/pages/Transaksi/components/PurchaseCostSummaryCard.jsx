import { Form, InputNumber, Space, Tag } from "antd";
import { formatNumberId } from "../../../utils/formatters/numberId";
import { formatCurrencyId as formatCurrencyIdr } from "../../../utils/formatters/currencyId";
import { getPurchaseSavingMeta } from "../../../services/Transaksi/purchasesService";

// IMS NOTE [AKTIF/GUARDED] - Ringkasan biaya modal Purchases
// Fungsi blok: menampilkan hidden calculated fields dan breakdown biaya aktual/pembanding supplier.
// Hubungan flow: read-only dari Form values existing; formula effect, submit purchase, stok, expense, dan inventory log tetap di parent/service.
const PurchaseCostSummaryCard = () => (
  <>
    <Form.Item name="totalStockIn" hidden>
      <InputNumber />
    </Form.Item>
    <Form.Item name="restockReferencePrice" hidden>
      <InputNumber />
    </Form.Item>
    <Form.Item name="totalReferencePurchase" hidden>
      <InputNumber />
    </Form.Item>
    <Form.Item name="totalActualPurchase" hidden>
      <InputNumber />
    </Form.Item>
    <Form.Item name="actualUnitCost" hidden>
      <InputNumber />
    </Form.Item>
    <Form.Item name="purchaseSaving" hidden>
      <InputNumber />
    </Form.Item>

    <Form.Item shouldUpdate noStyle>
      {({ getFieldValue }) => {
        const stockUnit = getFieldValue("stockUnit") || "satuan stok";
        const stockInValue = Number(getFieldValue("totalStockIn") || 0);
        const supplierPriceValue = Number(getFieldValue("restockReferencePrice") || 0);
        const totalReferenceValue = Number(getFieldValue("totalReferencePurchase") || 0);
        const totalActualValue = Number(getFieldValue("totalActualPurchase") || 0);
        const actualUnitCostValue = Number(getFieldValue("actualUnitCost") || 0);
        const purchaseSavingValue = Number(getFieldValue("purchaseSaving") || 0);
        const summaryPurchaseType = getFieldValue("purchaseType") || "online";
        const summaryIsOfflinePurchase = summaryPurchaseType === "offline";
        const subtotalItemsValue = Number(getFieldValue("subtotalItems") || 0);
        const shippingCostValue = summaryIsOfflinePurchase ? 0 : Number(getFieldValue("shippingCost") || 0);
        const shippingDiscountValue = summaryIsOfflinePurchase ? 0 : Number(getFieldValue("shippingDiscount") || 0);
        const voucherDiscountValue = summaryIsOfflinePurchase ? 0 : Number(getFieldValue("voucherDiscount") || 0);
        const serviceFeeValue = summaryIsOfflinePurchase ? 0 : Number(getFieldValue("serviceFee") || 0);
        const savingMeta = getPurchaseSavingMeta(purchaseSavingValue);
        const hasSupplierReference = totalReferenceValue > 0;
        const formatDiscountValue = (value) =>
          Number(value || 0) > 0 ? `- ${formatCurrencyIdr(value)}` : formatCurrencyIdr(0);

        return (
          <div
            style={{
              border: "1px solid var(--ims-border-color-soft)",
              borderRadius: 12,
              padding: 14,
              marginBottom: 16,
              background: "var(--ims-bg-card)",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              Ringkasan Perbandingan Supplier
            </div>
            <div style={{ color: "var(--ims-text-secondary)", fontSize: 12, marginBottom: 12 }}>
              Rincian otomatis dari field pembelian. Total aktual menjadi dasar biaya.
            </div>
            {summaryIsOfflinePurchase ? (
              <div style={{ color: "var(--ims-text-secondary)", fontSize: 12, marginBottom: 10 }}>
                Offline: ongkir, admin, dan potongan dihitung 0.
              </div>
            ) : null}

            <Space direction="vertical" size={8} className="ims-filter-control">
              <div style={{ fontWeight: 600 }}>Biaya Aktual</div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Subtotal Barang</span>
                <strong>{formatCurrencyIdr(subtotalItemsValue)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Ongkir</span>
                <strong>{formatCurrencyIdr(shippingCostValue)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Biaya Layanan</span>
                <strong>{formatCurrencyIdr(serviceFeeValue)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Potongan Ongkir</span>
                <strong>{formatDiscountValue(shippingDiscountValue)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Voucher / Koin / Potongan</span>
                <strong>{formatDiscountValue(voucherDiscountValue)}</strong>
              </div>
              <div
                style={{
                  borderTop: "1px solid var(--ims-border-color-soft)",
                  marginTop: 4,
                  paddingTop: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <span>Total Aktual Pembelian</span>
                <strong>{formatCurrencyIdr(totalActualValue)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Modal Aktual / Satuan Stok</span>
                <strong>{formatCurrencyIdr(actualUnitCostValue)} / {stockUnit}</strong>
              </div>

              <div style={{ fontWeight: 600, marginTop: 8 }}>Pembanding Supplier</div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Stok Masuk</span>
                <strong>{formatNumberId(stockInValue)} {stockUnit}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Harga Acuan Supplier</span>
                <strong>
                  {supplierPriceValue > 0
                    ? `${formatCurrencyIdr(supplierPriceValue)} / ${stockUnit}`
                    : "Belum ada harga acuan supplier"}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>Total Pembanding Supplier</span>
                <strong>{hasSupplierReference ? formatCurrencyIdr(totalReferenceValue) : "-"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <span>Selisih</span>
                <Tag color={savingMeta.color}>{hasSupplierReference ? savingMeta.label : "-"}</Tag>
              </div>
            </Space>
          </div>
        );
      }}
    </Form.Item>
  </>
);

export default PurchaseCostSummaryCard;
