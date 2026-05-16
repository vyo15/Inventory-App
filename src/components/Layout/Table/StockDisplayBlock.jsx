import { Typography } from "antd";
import { formatNumberId } from "../../../utils/formatters/numberId";
import { getVariantStockStatusMeta } from "../../../utils/stock/stockHelpers";

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

/* =====================================================
SECTION: Locked stock balance display — AKTIF / GUARDED
Fungsi:
- Menampilkan saldo stok item dalam format owner-locked: Total, Tersedia, dan semua variant sebagai chip/pill langsung di table utama.

Dipakai oleh:
- Products table dan StockReport table untuk saldo stok item/master inventory.

Alasan perubahan:
- Batch compact table tetap harus menjaga format stok varian yang sudah dikunci owner dan tidak boleh menyembunyikan semua varian ke drawer/tooltip.

Catatan cleanup:
- Bisa dipakai bertahap oleh RawMaterials/SemiFinishedMaterials pada patch terpisah agar helper stok benar-benar tunggal.

Risiko:
- Jangan dipakai untuk Stok Masuk Purchases, audit log, snapshot mutasi, atau field yang bukan saldo stok item karena bisa membuat user salah membaca qty transaksi sebagai saldo master.
===================================================== */
const StockDisplayBlock = ({
  record = {},
  unit,
  getVariantLabel,
  className = "ims-cell-stack ims-cell-stack-tight",
  metaClassName = "ims-cell-meta",
  showNonVariantLabel = true,
  minStockThreshold = 0,
}) => {
  const stockUnit = unit || resolveStockUnit(record);
  const variants = Array.isArray(record.variants) ? record.variants : [];
  const hasVariants = (record.hasVariants === true || variants.length > 0) && variants.length > 0;
  const totalStock = Number(record.currentStock ?? record.stock ?? record.stockDisplay ?? 0);
  const availableStock = Number(record.availableStock ?? totalStock);

  return (
    <div className={className}>
      <Text strong>{`Total ${formatStockWithUnit(totalStock, stockUnit)}`}</Text>
      <Text type="secondary" className={metaClassName}>
        {`Tersedia ${formatStockWithUnit(availableStock, stockUnit)}`}
      </Text>

      {hasVariants ? (
        <div className="stock-variant-pill-wrap">
          {variants.map((variant, index) => {
            const variantLabel = resolveVariantLabel(variant, index, getVariantLabel);
            const variantStatusMeta = getVariantStockStatusMeta(variant, minStockThreshold);
            const pillClassName = ["stock-variant-pill", variantStatusMeta.pillClassName].filter(Boolean).join(" ");

            return (
              <span
                key={`${variant.variantKey || variant.sku || variant.color || variantLabel || "variant"}-${index}`}
                className={pillClassName}
                title={variantStatusMeta.status === "safe" ? undefined : variantStatusMeta.label}
              >
                <Text className="stock-variant-pill-label">{`${variantLabel}:`}</Text>
                <Text className="stock-variant-pill-value">
                  {formatStockWithUnit(variant.currentStock ?? variant.stock ?? 0, stockUnit)}
                </Text>
              </span>
            );
          })}
        </div>
      ) : showNonVariantLabel ? (
        <Text type="secondary" className={metaClassName}>Non-varian</Text>
      ) : null}
    </div>
  );
};

export default StockDisplayBlock;
