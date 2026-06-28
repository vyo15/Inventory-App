import { requestSqliteApi } from "./sqliteApiClient";
import { createSqliteInitialLoadSubscription } from "./sqliteJsonRecordAdapterFactory";

const normalizePricingRulePayload = (values = {}) => ({
  id: values.id || "",
  code: values.code || "",
  name: String(values.name || "").trim(),
  description: String(values.description || "").trim(),
  targetType: values.targetType === "products" ? "products" : "raw_materials",
  isActive: values.isActive !== false,
  baseCostSource: values.baseCostSource || (values.targetType === "products" ? "hppPerUnit" : "averageActualUnitCost"),
  marginType: values.marginType === "nominal" ? "nominal" : "percent",
  marginValue: Math.max(0, Math.round(Number(values.marginValue || 0))),
  includeMarketplaceBuffer: Boolean(values.includeMarketplaceBuffer),
  marketplaceBufferType: values.marketplaceBufferType === "nominal" ? "nominal" : "percent",
  marketplaceBufferValue: Math.max(0, Math.round(Number(values.marketplaceBufferValue || 0))),
  roundingType: ["up", "down", "nearest"].includes(values.roundingType) ? values.roundingType : "up",
  roundingUnit: Math.max(1, Math.round(Number(values.roundingUnit || 100))),
});

const normalizeRecord = (record = {}) => ({
  ...record,
  id: record.id || record.code || "",
  name: record.name || "",
  targetType: record.targetType === "products" ? "products" : "raw_materials",
  isActive: record.isActive !== false,
  baseCostSource: record.baseCostSource || (record.targetType === "products" ? "hppPerUnit" : "averageActualUnitCost"),
  marginType: record.marginType === "nominal" ? "nominal" : "percent",
  marginValue: Math.max(0, Math.round(Number(record.marginValue || 0))),
  includeMarketplaceBuffer: Boolean(record.includeMarketplaceBuffer),
  marketplaceBufferType: record.marketplaceBufferType === "nominal" ? "nominal" : "percent",
  marketplaceBufferValue: Math.max(0, Math.round(Number(record.marketplaceBufferValue || 0))),
  roundingType: ["up", "down", "nearest"].includes(record.roundingType) ? record.roundingType : "up",
  roundingUnit: Math.max(1, Math.round(Number(record.roundingUnit || 100))),
});

export const listPricingRules = async () => {
  const result = await requestSqliteApi("/api/pricing-rules");
  return (result?.data || []).map(normalizeRecord);
};

export const createPricingRule = async (values = {}) => {
  const result = await requestSqliteApi("/api/pricing-rules", {
    method: "POST",
    body: JSON.stringify(normalizePricingRulePayload(values)),
  });
  return result?.data ? normalizeRecord(result.data) : null;
};

export const updatePricingRule = async (ruleId, values = {}) => {
  if (!ruleId) {
    throw new Error("Pricing rule yang akan diubah tidak valid.");
  }

  const result = await requestSqliteApi(`/api/pricing-rules/${encodeURIComponent(ruleId)}`, {
    method: "PUT",
    body: JSON.stringify(normalizePricingRulePayload(values)),
  });
  return result?.data ? normalizeRecord(result.data) : null;
};

export const deletePricingRule = async (ruleId) => {
  if (!ruleId) {
    throw new Error("Pricing rule yang akan dihapus tidak valid.");
  }

  const result = await requestSqliteApi(`/api/pricing-rules/${encodeURIComponent(ruleId)}`, {
    method: "DELETE",
  });
  return result?.data || { id: ruleId, deleted: true };
};

export const applyPricingRuleBatch = async (ruleId, payload = {}) => {
  if (!ruleId) {
    throw new Error("Pricing rule yang akan diterapkan tidak valid.");
  }

  const result = await requestSqliteApi(`/api/pricing-rules/${encodeURIComponent(ruleId)}/apply`, {
    method: "POST",
    body: JSON.stringify({
      targetType: payload.targetType || "",
      updates: Array.isArray(payload.updates) ? payload.updates : [],
    }),
  });
  return result?.data || null;
};

export const subscribePricingRules = (callback, onError, options = {}) => {
  void options;
  return createSqliteInitialLoadSubscription({
    loadRecords: listPricingRules,
    callback,
    onError,
  });
};
