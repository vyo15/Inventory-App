import dayjs from 'dayjs';

// IMS NOTE [AKTIF/UI ONLY] - Helper Purchases page ini hanya menghitung preview/form display.
// Tidak menulis purchase, stok, expense, inventory log, atau data stok turunan.
export const calculateSupplierSubtotal = (qty, supplierItemPrice) => {
  return Math.round(Math.max(Number(qty || 0), 0) * Math.max(Number(supplierItemPrice || 0), 0));
};

export const calculateSupplierReferenceTotal = ({
  qty,
  supplierItemPrice,
  defaultShippingCost,
  defaultServiceFee,
  defaultDiscount,
  fallbackStockIn,
  fallbackReferencePerStockUnit,
}) => {
  const safeQty = Math.max(Number(qty || 0), 0);
  const safeSupplierItemPrice = Math.max(Number(supplierItemPrice || 0), 0);

  if (safeSupplierItemPrice > 0) {
    return Math.round(
      safeQty * safeSupplierItemPrice +
        Math.max(Number(defaultShippingCost || 0), 0) +
        Math.max(Number(defaultServiceFee || 0), 0) -
        Math.max(Number(defaultDiscount || 0), 0),
    );
  }

  return Math.round(
    Math.max(Number(fallbackStockIn || 0), 0) * Math.max(Number(fallbackReferencePerStockUnit || 0), 0),
  );
};

export const buildShopeeOcrPurchaseMeta = (purchaseRecord = {}) => {
  const dateText = purchaseRecord?.date?.toDate ? dayjs(purchaseRecord.date.toDate()).format('DD-MM-YYYY') : '';

  return {
    purchaseNumber:
      purchaseRecord?.purchaseNumber || purchaseRecord?.code || purchaseRecord?.referenceNumber || 'Kode otomatis',
    supplierName: purchaseRecord?.supplierName || 'Supplier tidak tercatat',
    dateText,
  };
};
