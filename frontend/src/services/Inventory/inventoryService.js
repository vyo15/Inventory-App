import { commitStockAdjustment } from "../../data/adapters/sqlite/sqliteStockAdjustmentsAdapter";
import { createSqliteJsonRecordAdapter } from "../../data/adapters/sqlite/sqliteJsonRecordAdapterFactory";
import { buildInventoryLogPayload } from "./inventoryLogService";

const logsAdapter = createSqliteJsonRecordAdapter({ endpoint: "/api/stock-adjustments" });
const DEFAULT_INVENTORY_LOG_LIMIT = 300;
export const getInventoryLogs = async ({ limit = DEFAULT_INVENTORY_LOG_LIMIT } = {}) => logsAdapter.list({ limit });
export const addInventoryLog = async (itemId, itemName, quantityChange, type, collectionName, extraData = {}) => buildInventoryLogPayload({ itemId, itemName, quantityChange, type, collectionName, extraData });
export const updateInventoryStock = async ({ itemId, collectionName, quantityChange = 0, variantKey = "", preventNegative = false } = {}) => {
  const sourceType = collectionName === "products" ? "product" : collectionName === "semi_finished_materials" ? "semi_finished" : "raw_material";
  return commitStockAdjustment({ sourceType, sourceId: itemId, variantKey, quantity: Math.abs(Number(quantityChange || 0)), deltaCurrent: Number(quantityChange || 0), preventNegative, reason: "inventory_service_update", referenceNumber: `INV-${Date.now()}` });
};
