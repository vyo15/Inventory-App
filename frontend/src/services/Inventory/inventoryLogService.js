import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";
export const INVENTORY_LOG_COLLECTION = "inventory_logs";
export const resolveInventoryLogReference = (type = "", extraData = {}) => {
  const referenceId = extraData.referenceId || extraData.saleId || extraData.purchaseId || extraData.returnId || extraData.adjustmentId || extraData.productionOrderId || extraData.workLogId || extraData.workLogRefId || "";
  const normalizedType = String(type || "").toLowerCase();
  const referenceType = extraData.referenceType || (normalizedType.includes("sale") ? "sale" : normalizedType.includes("purchase") ? "purchase" : normalizedType.includes("return") ? "return" : normalizedType.includes("adjustment") ? "stock_adjustment" : normalizedType.includes("production") || normalizedType.includes("work_log") ? "production" : "inventory_log");
  return { referenceId, referenceType };
};
export const resolveInventoryLogDisplayReference = (record = {}) => resolveDisplayReference(record, { fallback: "", extraFields: ["sourceRef", "referenceCode", "referenceNumber", "purchaseNumber", "returnNumber", "workNumber", "productionOrderCode"] });
export const buildInventoryLogReferenceFields = ({ referenceId = "", referenceNumber = "", referenceCode = "", sourceRef = "", referenceType = "" } = {}) => ({ referenceId, referenceNumber: referenceNumber || referenceCode || sourceRef || "", referenceCode: referenceCode || referenceNumber || sourceRef || "", sourceRef: sourceRef || referenceNumber || referenceCode || "", referenceType: referenceType || "inventory_log" });
export const buildInventoryLogVariantFields = ({ selectedVariant = null, variantKey = "", variantLabel = "", stockSourceType = "" } = {}) => ({ variantKey: variantKey || selectedVariant?.variantKey || "", variantLabel: variantLabel || selectedVariant?.variantLabel || selectedVariant?.name || "", stockSourceType: stockSourceType || (selectedVariant ? "variant" : "master") });
export const resolveInventoryStockUnit = ({ item = null, unit = "", stockUnit = "", fallbackUnit = "", collectionName = "" } = {}) => stockUnit || unit || item?.stockUnit || item?.unit || item?.baseUnit || fallbackUnit || (collectionName === "products" ? "pcs" : "");
export const buildInventoryLogUnitFields = (options = {}) => { const normalizedUnit = resolveInventoryStockUnit(options); return { unit: options.unit || normalizedUnit, stockUnit: options.stockUnit || normalizedUnit }; };
export const buildInventoryLogPayload = ({ itemId = "", itemName = "", quantityChange = 0, type = "", collectionName = "", extraData = {}, timestamp = new Date().toISOString() } = {}) => {
  const normalizedExtraData = extraData && typeof extraData === "object" ? extraData : {};
  const referenceMeta = resolveInventoryLogReference(type, normalizedExtraData);
  return { ...normalizedExtraData, itemId, itemName, quantityChange: Number(quantityChange || 0), type, collectionName, timestamp, referenceId: referenceMeta.referenceId, referenceType: referenceMeta.referenceType, details: { ...normalizedExtraData, ...referenceMeta } };
};
