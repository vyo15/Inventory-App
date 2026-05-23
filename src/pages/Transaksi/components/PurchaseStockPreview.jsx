import React from "react";
import { Tag } from "antd";
import { formatNumberId } from "../../../utils/formatters/numberId";

// IMS NOTE [AKTIF/GUARDED] - Snapshot stok preview pembelian
// Fungsi blok: menormalisasi currentStock, reservedStock, dan availableStock untuk card stok read-only di modal pembelian.
// Hubungan flow Purchases: hanya display sebelum restock; tidak dipakai untuk mutasi stok, cash out, expense, inventory log, atau payload submit.
// Status: AKTIF untuk UI preview, LEGACY-COMPAT untuk fallback currentStock ?? stock, GUARDED karena bukan sumber mutasi stok.
export const buildPurchaseStockPreviewSnapshot = (stockSource = {}) => {
  const parsedCurrentStock = Number(stockSource?.currentStock ?? stockSource?.stock ?? 0);
  const parsedReservedStock = Number(stockSource?.reservedStock || 0);
  const currentStock = Number.isFinite(parsedCurrentStock) ? parsedCurrentStock : 0;
  const reservedStock = Number.isFinite(parsedReservedStock) ? parsedReservedStock : 0;
  const calculatedAvailableStock = Math.max(currentStock - reservedStock, 0);
  const availableStock = Number(stockSource?.availableStock ?? calculatedAvailableStock);

  return {
    currentStock,
    reservedStock,
    availableStock: Number.isFinite(availableStock) ? Math.max(availableStock, 0) : calculatedAvailableStock,
  };
};

const formatPurchaseStockWithUnit = (value, unit = "pcs") => `${formatNumberId(value)} ${unit || "pcs"}`;

const PurchaseStockPreview = ({ preview }) => {
  if (!preview) return null;

  return (
    <div
      style={{
        border: "1px solid var(--ims-border-color-soft)",
        borderRadius: 12,
        padding: 14,
        marginBottom: 16,
        background: "var(--ims-bg-card-soft)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>
        Stok Aktual Sebelum Restock
      </div>
      <div style={{ color: "var(--ims-text-secondary)", fontSize: 12, marginBottom: 10 }}>
        Info ini hanya snapshot stok saat ini sebelum pembelian disimpan.
      </div>

      {preview.status === "needs_variant" ? (
        <div
          style={{
            border: "1px dashed var(--ims-border-color)",
            borderRadius: 10,
            padding: 12,
            background: "var(--ims-bg-card)",
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {preview.itemName || "Item bervarian"}
          </div>
          <div style={{ color: "var(--ims-text-secondary)", marginTop: 4 }}>
            {preview.message}
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
            <Tag color={preview.sourceType === "variant" ? "purple" : "default"}>
              {preview.sourceType === "variant" ? "Varian" : "Master"}
            </Tag>
            <span style={{ fontWeight: 600 }}>
              {preview.itemName}
            </span>
            <span style={{ color: "var(--ims-text-secondary)" }}>
              {` — ${preview.sourceLabel}`}
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            {[
              ["Current Stock", preview.currentStock],
              ["Reserved Stock", preview.reservedStock],
              ["Available Stock", preview.availableStock],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  border: "1px solid var(--ims-border-color-soft)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: "var(--ims-bg-card)",
                }}
              >
                <div style={{ color: "var(--ims-text-secondary)", fontSize: 12, marginBottom: 4 }}>{label}</div>
                <strong style={{ display: "block", fontSize: 16 }}>
                  {formatPurchaseStockWithUnit(value, preview.stockUnit)}
                </strong>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PurchaseStockPreview;
