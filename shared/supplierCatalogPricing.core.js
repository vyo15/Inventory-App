export const toNonNegativeInteger = (value, fallback = 0) => {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
};

export const toPositiveInteger = (value, fallback = 1) => {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

export const calculateSupplierCatalogMetrics = (offer = {}) => {
  const purchaseType = offer.purchaseType === "offline" ? "offline" : "online";
  const purchaseQty = toPositiveInteger(offer.purchaseQty, 1);
  const conversionValue = toPositiveInteger(offer.conversionValue, 1);
  const supplierItemPrice = toNonNegativeInteger(offer.supplierItemPrice, 0);
  const estimatedShippingCost = purchaseType === "offline"
    ? 0
    : toNonNegativeInteger(offer.estimatedShippingCost, 0);
  const serviceFee = purchaseType === "offline"
    ? 0
    : toNonNegativeInteger(offer.serviceFee, 0);
  const discount = purchaseType === "offline"
    ? 0
    : toNonNegativeInteger(offer.discount, 0);
  const totalStockQty = purchaseQty * conversionValue;
  const totalEstimatedSupplier = Math.max(
    0,
    (purchaseQty * supplierItemPrice) + estimatedShippingCost + serviceFee - discount,
  );
  const estimatedUnitPrice = totalStockQty > 0
    ? Math.round(totalEstimatedSupplier / totalStockQty)
    : 0;

  return {
    purchaseType,
    purchaseQty,
    conversionValue,
    supplierItemPrice,
    estimatedShippingCost,
    serviceFee,
    discount,
    totalStockQty,
    totalEstimatedSupplier,
    estimatedUnitPrice,
    referencePrice: estimatedUnitPrice,
  };
};
