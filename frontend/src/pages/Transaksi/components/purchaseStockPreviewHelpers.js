import { getPurchaseStockUnit } from "../../../services/Transaksi/purchasesService";

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

export const buildPurchaseStockPreview = ({
  itemId,
  itemType,
  materialVariantId,
  productVariantKey,
  selectedMaterial,
  selectedMaterialVariant,
  selectedProduct,
  selectedProductHasVariants,
  selectedProductVariant,
} = {}) => {
  if (!itemType || !itemId) return null;

  const buildReadyPreview = ({ itemName, sourceLabel, sourceType, stockSource, stockUnit }) => ({
    status: "ready",
    itemName,
    sourceLabel,
    sourceType,
    stockUnit: stockUnit || getPurchaseStockUnit(stockSource),
    ...buildPurchaseStockPreviewSnapshot(stockSource),
  });
  const buildNeedsVariantPreview = ({ itemName, variantLabel }) => ({
    status: "needs_variant",
    itemName,
    variantLabel: variantLabel || "Varian",
    message: "Pilih varian untuk melihat stok varian.",
  });

  if (itemType === "material") {
    if (!selectedMaterial) return null;
    const hasVariants = selectedMaterial.hasVariantOptions || selectedMaterial.hasVariants;
    if (hasVariants && (!materialVariantId || !selectedMaterialVariant)) {
      return buildNeedsVariantPreview({
        itemName: selectedMaterial.name,
        variantLabel: selectedMaterial.variantLabel || "Varian Bahan",
      });
    }
    if (hasVariants) {
      return buildReadyPreview({
        itemName: selectedMaterial.name,
        sourceLabel: selectedMaterialVariant.variantName
          || selectedMaterialVariant.variantLabel
          || selectedMaterialVariant.name
          || selectedMaterialVariant.variantKey
          || "Varian terpilih",
        sourceType: "variant",
        stockSource: selectedMaterialVariant,
        stockUnit: getPurchaseStockUnit(selectedMaterial),
      });
    }
    return buildReadyPreview({
      itemName: selectedMaterial.name,
      sourceLabel: "Master / non-varian",
      sourceType: "master",
      stockSource: selectedMaterial,
      stockUnit: getPurchaseStockUnit(selectedMaterial),
    });
  }

  if (itemType === "product") {
    if (!selectedProduct) return null;
    if (selectedProductHasVariants && (!productVariantKey || !selectedProductVariant)) {
      return buildNeedsVariantPreview({
        itemName: selectedProduct.name,
        variantLabel: selectedProduct.variantLabel || "Varian Produk",
      });
    }
    if (selectedProductHasVariants) {
      return buildReadyPreview({
        itemName: selectedProduct.name,
        sourceLabel: selectedProductVariant.variantLabel
          || selectedProductVariant.label
          || selectedProductVariant.name
          || selectedProductVariant.color
          || selectedProductVariant.variantKey
          || "Varian terpilih",
        sourceType: "variant",
        stockSource: selectedProductVariant,
        stockUnit: getPurchaseStockUnit(selectedProduct),
      });
    }
    return buildReadyPreview({
      itemName: selectedProduct.name,
      sourceLabel: "Master / non-varian",
      sourceType: "master",
      stockSource: selectedProduct,
      stockUnit: getPurchaseStockUnit(selectedProduct),
    });
  }

  return null;
};
