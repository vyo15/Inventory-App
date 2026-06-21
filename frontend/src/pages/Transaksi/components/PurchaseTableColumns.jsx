import { Button, Space, Tag, Tooltip } from "antd";
import dayjs from "dayjs";
import { formatNumberId } from "../../../utils/formatters/numberId";
import { formatCurrencyId as formatCurrencyIdr } from "../../../utils/formatters/currencyId";
import { getPurchaseSavingMeta } from "../../../services/Transaksi/purchasesService";
import { buildPurchaseNoteTableMeta } from "../../../utils/purchases/purchaseNoteDisplay";

/* =====================================================
   SECTION: Compact Purchases Table Columns — AKTIF/GUARDED
   Fungsi:
   - Menampilkan ringkasan pembelian/restock tanpa horizontal scroll besar.
   Dipakai oleh:
   - Purchases main table.
   Risiko:
   - Jangan mengubah transaction, stock-in, expense, conversion, actual unit cost, atau inventory log dari render kolom ini.
   ===================================================== */
export const createPurchaseTableColumns = ({ onOpenShopeeOcrDetail }) => [
  {
    title: "Tanggal / Supplier",
    key: "dateSupplier",
    width: 220,
    render: (_, record) => {
      const dateText = record.date?.toDate ? dayjs(record.date.toDate()).format("DD-MM-YYYY") : "-";
      const supplierName = record.supplierName || "Supplier tidak tercatat";
      return (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{dateText}</div>
          <Tooltip title={record.purchaseNumber || record.code || record.referenceNumber || supplierName}>
            <div style={{ color: "var(--ims-text-secondary)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {record.purchaseNumber || record.code || record.referenceNumber || "Kode otomatis"}
            </div>
          </Tooltip>
          <Tooltip title={supplierName}>
            <div style={{ color: "var(--ims-text-secondary)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {supplierName}
            </div>
          </Tooltip>
          <Tag color={record.purchaseType === "offline" ? "default" : "blue"} style={{ marginTop: 4 }}>
            {record.purchaseType === "offline" ? "Offline" : "Online"}
          </Tag>
        </div>
      );
    },
  },
  {
    title: "Item / Material",
    key: "itemMaterial",
    width: 260,
    render: (_, record) => {
      const itemName = record.itemName || "-";
      const typeTag = record.type === "product" ? <Tag color="blue">Produk</Tag> : <Tag color="gold">Bahan Baku</Tag>;
      const variantTag = record.variantLabel || record.variantKey ? (
        <Tag color="purple">{record.variantLabel || record.variantKey}</Tag>
      ) : (
        <Tag>Master</Tag>
      );

      return (
        <div style={{ minWidth: 0 }}>
          <Tooltip title={itemName}>
            <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {itemName}
            </div>
          </Tooltip>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
            {typeTag}
            {variantTag}
          </div>
        </div>
      );
    },
  },
  {
    title: "Qty / Stok Masuk",
    key: "quantityStockIn",
    width: 170,
    render: (_, record) => {
      const quantityText = record.type === "material"
        ? `${formatNumberId(record.quantity)} ${record.purchaseUnit || ""}`
        : formatNumberId(record.quantity);
      const stockInText = record.type === "material"
        ? `${formatNumberId(record.totalStockIn || record.quantity)} ${record.stockUnit || ""}`
        : formatNumberId(record.quantity);

      return (
        <div>
          <div>
            <span style={{ color: "var(--ims-text-secondary)" }}>Qty: </span>
            <strong>{quantityText}</strong>
          </div>
          <div style={{ fontSize: 12, color: "var(--ims-text-secondary)" }}>
            Stok Masuk: {stockInText}
          </div>
        </div>
      );
    },
  },
  {
    title: "Total / Modal",
    key: "totalActual",
    width: 190,
    align: "right",
    render: (_, record) => {
      const savingMeta = getPurchaseSavingMeta(record.purchaseSaving);
      return (
        <div>
          <div style={{ fontWeight: 700 }}>{formatCurrencyIdr(record.totalActualPurchase)}</div>
          <div style={{ color: "var(--ims-text-secondary)", fontSize: 12 }}>
            Modal: {formatCurrencyIdr(record.actualUnitCost)}{record.stockUnit ? ` / ${record.stockUnit}` : ""}
          </div>
          <Tag color={savingMeta.color} style={{ marginTop: 4 }}>{savingMeta.label}</Tag>
        </div>
      );
    },
  },
  {
    title: "Info",
    dataIndex: "note",
    key: "note",
    width: 170,
    render: (value, record) => {
      const { hasShopeeOcrNote, manualNote, manualPreview } = buildPurchaseNoteTableMeta(value);

      if (!manualPreview && !hasShopeeOcrNote) {
        return <span style={{ color: "var(--ims-text-muted)" }}>-</span>;
      }

      return (
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          {manualPreview ? (
            <Tooltip title={<span style={{ whiteSpace: "pre-line" }}>{manualNote}</span>}>
              <span
                style={{
                  color: "var(--ims-text-primary)",
                  display: "block",
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {manualPreview}
              </span>
            </Tooltip>
          ) : null}
          {hasShopeeOcrNote ? (
            <Space size={6} wrap>
              <Tooltip title="Dibantu OCR Shopee. Detail angka disimpan di catatan transaksi.">
                <Tag color="blue" style={{ marginInlineEnd: 0, width: "fit-content" }}>
                  OCR Shopee
                </Tag>
              </Tooltip>
              <Button
                type="link"
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenShopeeOcrDetail?.(record);
                }}
                style={{ height: "auto", lineHeight: 1.2, padding: 0 }}
              >
                Lihat
              </Button>
            </Space>
          ) : null}
        </Space>
      );
    },
  },
];
