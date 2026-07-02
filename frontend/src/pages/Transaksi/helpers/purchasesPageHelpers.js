import dayjs from "dayjs";

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

export const buildPurchaseItemSelectionFields = ({ itemType, material } = {}) => {
  if (itemType === "product") {
    return {
      productVariantKey: undefined,
      purchaseUnit: undefined,
      stockUnit: undefined,
      conversionValue: undefined,
      purchaseType: "online",
      totalStockIn: undefined,
      restockReferencePrice: 0,
    };
  }

  if (itemType !== "material") return {};

  if (material) {
    return {
      materialVariantId: undefined,
      productVariantKey: undefined,
      purchaseUnit: material.defaultPurchaseUnit || "",
      stockUnit: material.stockUnit || material.unit || "",
      purchaseType: "online",
      restockReferencePrice: 0,
    };
  }

  return {
    materialVariantId: undefined,
    productVariantKey: undefined,
    purchaseUnit: null,
    stockUnit: null,
    conversionValue: undefined,
    purchaseType: "online",
    totalStockIn: undefined,
    restockReferencePrice: 0,
  };
};


export const resolvePurchaseCatalogOfferSelection = ({
  currentOfferId,
  offers = [],
  prefilledOfferId,
} = {}) => {
  const currentStillAvailable = offers.some(
    (offer) => String(offer.id || offer.catalogOfferId) === String(currentOfferId || ""),
  );
  const prefilledOffer = offers.find(
    (offer) => String(offer.id || offer.catalogOfferId) === String(prefilledOfferId || ""),
  );

  return {
    nextOfferId: currentStillAvailable
      ? currentOfferId
      : prefilledOffer
        ? prefilledOffer.id || prefilledOffer.catalogOfferId
        : offers.length === 1
          ? offers[0].id || offers[0].catalogOfferId
          : undefined,
    consumedPrefill: Boolean(prefilledOffer),
  };
};

export const buildPurchaseCatalogOfferFields = ({
  offer = {},
  metrics = {},
  quantity,
  itemType,
  fallbackStockUnit,
} = {}) => {
  const purchaseType = offer.purchaseType === "offline" ? "offline" : "online";
  const supplierItemPrice = Number(metrics.supplierItemPrice || 0);
  const subtotalItems = supplierItemPrice > 0
    ? calculateSupplierSubtotal(quantity, supplierItemPrice)
    : 0;

  return {
    supplierItemPrice,
    subtotalItems,
    fields: {
      productLink: offer.productLink || "",
      purchaseUnit: offer.purchaseUnit || "",
      stockUnit: offer.stockUnit || fallbackStockUnit || "",
      conversionValue: itemType === "product"
        ? 1
        : Math.max(1, Number(offer.conversionValue || 1)),
      restockReferencePrice: metrics.estimatedUnitPrice || 0,
      purchaseType,
      subtotalItems,
      shippingCost: purchaseType === "offline" ? 0 : metrics.estimatedShippingCost || 0,
      shippingDiscount: 0,
      voucherDiscount: purchaseType === "offline" ? 0 : metrics.discount || 0,
      serviceFee: purchaseType === "offline" ? 0 : metrics.serviceFee || 0,
      priceVerified: false,
      priceVerifiedAt: undefined,
      verifiedCatalogPrice: 0,
    },
  };
};

export const canAutoApplySupplierSubtotal = ({
  manualOverride,
  currentSubtotal,
  previousBaselineSubtotal,
} = {}) => (
  !manualOverride
  || Math.round(Number(currentSubtotal || 0)) === Math.round(Number(previousBaselineSubtotal || 0))
  || Math.round(Number(currentSubtotal || 0)) === 0
);

export const buildPurchaseVerificationSignature = ({ catalogOfferId, quantity, subtotalItems } = {}) => (
  `${String(catalogOfferId || "")}::${Math.round(Number(quantity || 0))}::${Math.round(Number(subtotalItems || 0))}`
);

export const shouldApplyPurchaseItemDefaults = ({
  appliedContext,
  currentContext,
  isItemContextChanged,
  itemType,
  material,
} = {}) => (
  Boolean(isItemContextChanged)
  || (itemType === "material" && Boolean(material) && appliedContext !== currentContext)
);

export const calculatePurchaseCostSummary = ({
  subtotalItems,
  shippingCost,
  shippingDiscount,
  voucherDiscount,
  serviceFee,
  purchaseType,
  totalStockIn,
  quantity,
  restockReferencePrice,
  supplierItemPrice,
  referenceShippingCost,
  referenceServiceFee,
  referenceDiscount,
} = {}) => {
  const isOffline = purchaseType === "offline";
  const totalActualPurchase = Math.round(
    Number(subtotalItems || 0)
      + (isOffline ? 0 : Number(shippingCost || 0))
      - (isOffline ? 0 : Number(shippingDiscount || 0))
      - (isOffline ? 0 : Number(voucherDiscount || 0))
      + (isOffline ? 0 : Number(serviceFee || 0)),
  );
  const stockIn = Number(totalStockIn || 0);
  const actualUnitCost = stockIn > 0 ? Math.round(totalActualPurchase / stockIn) : 0;
  const totalReferencePurchase = calculateSupplierReferenceTotal({
    qty: quantity,
    supplierItemPrice,
    defaultShippingCost: referenceShippingCost,
    defaultServiceFee: referenceServiceFee,
    defaultDiscount: referenceDiscount,
    fallbackStockIn: stockIn,
    fallbackReferencePerStockUnit: restockReferencePrice,
  });

  return {
    totalActualPurchase,
    actualUnitCost,
    totalReferencePurchase,
    purchaseSaving: Math.round(totalReferencePurchase - totalActualPurchase),
  };
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


export const buildPurchaseFormDefaults = (overrides = {}) => ({
  type: "material",
  materialVariantId: undefined,
  productVariantKey: undefined,
  quantity: 1,
  subtotalItems: 0,
  shippingCost: 0,
  shippingDiscount: 0,
  voucherDiscount: 0,
  serviceFee: 0,
  purchaseType: "online",
  totalActualPurchase: 0,
  actualUnitCost: 0,
  restockReferencePrice: 0,
  totalReferencePurchase: 0,
  purchaseSaving: 0,
  productLink: "",
  catalogOfferId: undefined,
  priceVerified: false,
  priceVerifiedAt: undefined,
  verifiedCatalogPrice: 0,
  ...overrides,
});
