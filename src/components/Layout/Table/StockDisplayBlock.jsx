import { Typography } from "antd";
import { formatNumberId } from "../../../utils/formatters/numberId";
import {
  getInventoryVariantStockRows,
  resolveInventoryAvailableStock,
  resolveInventoryCurrentStock,
} from "../../../utils/stock/stockHelpers";

const { Text } = Typography;

const resolveStockUnit = (record = {}, fallbackUnit = "pcs") =>
  record.stockUnit || record.unit || record.baseUnit || fallbackUnit || "pcs";

const resolveVariantLabel = (variant = {}, index = 0, getVariantLabel) => {
  if (typeof getVariantLabel === "function") {
    return getVariantLabel(variant, index);
  }

  return (
    variant.variantLabel ||
    variant.label ||
    variant.name ||
    variant.variantName ||
    variant.color ||
    variant.sku ||
    `Varian ${index + 1}`
  );
};

const formatStockWithUnit = (value, unit = "pcs") => `${formatNumberId(value)} ${unit}`;

const getVariantPillClassName = (statusKey = "safe") => {
  if (statusKey === "empty") return "stock-variant-pill stock-variant-pill--danger";
  if (statusKey === "low") return "stock-variant-pill stock-variant-pill--warning";
  return "stock-variant-pill";
};

/* =====================================================
SECTION: Locked stock balance display — AKTIF / GUARDED
Fungsi:
- Menampilkan saldo stok item dalam format owner-locked: Total, Tersedia, dan semua variant sebagai chip/pill langsung di table utama.
- Untuk item bervarian, minimum stok master dipakai untuk menandai varian mana yang kosong/rendah tanpa membuat input min stok per varian.

Dipakai oleh:
- Products table, Semi Finished table, dan StockReport table untuk saldo stok item/master inventory.

Alasan perubahan:
- Batch compact table tetap harus menjaga format stok varian yang sudah dikunci owner dan tidak boleh menyembunyikan semua varian ke drawer/tooltip.

Catatan cleanup:
- Bisa dipakai bertahap oleh RawMaterials pada patch terpisah agar helper stok benar-benar tunggal.

Risiko:
- Jangan dipakai untuk Stok Masuk Purchases, audit log, snapshot mutasi, atau field yang bukan saldo stok item karena bisa membuat user salah membaca qty transaksi sebagai saldo master.
===================================================== */
const StockDisplayBlock = ({
  record = {},
  unit,
  getVariantLabel,
  sourceType = "",
  className = "ims-cell-stack ims-cell-stack-tight",
  metaClassName = "ims-cell-meta",
  showNonVariantLabel = true,
  showVariantStatus = true,
}) => {
  const stockUnit = unit || resolveStockUnit(record);
  const variants = Array.isArray(record.variants) ? record.variants : [];
  const hasVariants = (record.hasVariants === true || variants.length > 0) && variants.length > 0;
  const totalStock = resolveInventoryCurrentStock(record);
  const availableStock = resolveInventoryAvailableStock(record);
  const variantRows = hasVariants
    ? getInventoryVariantStockRows(record, sourceType, (variant, index) => resolveVariantLabel(variant, index, getVariantLabel))
    : [];

  return (
    <div className={className}>
      <Text strong>{`Total ${formatStockWithUnit(totalStock, stockUnit)}`}</Text>
      <Text type="secondary" className={metaClassName}>
        {`Tersedia ${formatStockWithUnit(availableStock, stockUnit)}`}
      </Text>

      {hasVariants ? (
        <div className="stock-variant-pill-wrap">
          {variantRows.map((variantMeta) => (
            <span
              key={`${variantMeta.variant.variantKey || variantMeta.variant.sku || variantMeta.variant.color || variantMeta.label || "variant"}-${variantMeta.index}`}
              className={getVariantPillClassName(showVariantStatus ? variantMeta.statusKey : "safe")}
              title={showVariantStatus && variantMeta.threshold > 0 ? `Min master ${formatStockWithUnit(variantMeta.threshold, stockUnit)}` : undefined}
            >
              <Text className="stock-variant-pill-label">{`${variantMeta.label}:`}</Text>
              <Text className="stock-variant-pill-value">
                {formatStockWithUnit(variantMeta.currentStock, stockUnit)}
              </Text>
              {showVariantStatus && (variantMeta.statusKey === "empty" || variantMeta.statusKey === "low") ? (
                <Text className="stock-variant-pill-status">
                  {variantMeta.statusKey === "empty" ? "Kosong" : "Rendah"}
                </Text>
              ) : null}
            </span>
          ))}
        </div>
      ) : showNonVariantLabel ? (
        <Text type="secondary" className={metaClassName}>Non-varian</Text>
      ) : null}
    </div>
  );
};

export default StockDisplayBlock;
