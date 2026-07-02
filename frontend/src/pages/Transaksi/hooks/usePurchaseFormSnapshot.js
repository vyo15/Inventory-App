import { Form } from "antd";

const usePurchaseFormSnapshot = (form) => ({
  itemType: Form.useWatch("type", form),
  itemId: Form.useWatch("itemId", form),
  quantity: Form.useWatch("quantity", form),
  conversionValue: Form.useWatch("conversionValue", form),
  materialVariantId: Form.useWatch("materialVariantId", form),
  productVariantKey: Form.useWatch("productVariantKey", form),
  supplierId: Form.useWatch("supplierId", form),
  catalogOfferId: Form.useWatch("catalogOfferId", form),
  priceVerified: Form.useWatch("priceVerified", form),
  purchaseType: Form.useWatch("purchaseType", form),
  subtotalItems: Form.useWatch("subtotalItems", form),
  shippingCost: Form.useWatch("shippingCost", form),
  shippingDiscount: Form.useWatch("shippingDiscount", form),
  voucherDiscount: Form.useWatch("voucherDiscount", form),
  serviceFee: Form.useWatch("serviceFee", form),
  totalStockIn: Form.useWatch("totalStockIn", form),
  restockReferencePrice: Form.useWatch("restockReferencePrice", form),
});

export default usePurchaseFormSnapshot;
