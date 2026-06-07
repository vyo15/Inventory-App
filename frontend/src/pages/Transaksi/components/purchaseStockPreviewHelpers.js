// IMS NOTE [AKTIF/GUARDED] - Snapshot stok preview pembelian
// Fungsi blok: menormalisasi currentStock, reservedStock, dan availableStock untuk card stok read-only di modal pembelian.
// Hubungan flow Purchases: hanya display sebelum restock; tidak dipakai untuk mutasi stok, cash out, expense, inventory log, atau payload submit.
// Status: AKTIF untuk UI preview, COMPATIBILITY untuk fallback currentStock ?? stock, GUARDED karena bukan sumber mutasi stok.
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
