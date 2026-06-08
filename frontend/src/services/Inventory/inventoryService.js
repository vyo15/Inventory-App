import { commitStockAdjustment } from "../../data/adapters/sqlite/sqliteStockAdjustmentsAdapter";
import { createSqliteJsonRecordAdapter } from "../../data/adapters/sqlite/sqliteJsonRecordAdapterFactory";
import { buildInventoryLogPayload } from "./inventoryLogService";

const logsAdapter = createSqliteJsonRecordAdapter({ endpoint: "/api/stock-adjustments" });
const DEFAULT_INVENTORY_LOG_LIMIT = 300;

const resolveSourceType = (collectionName = "") => {
  if (collectionName === "products") return "product";
  if (collectionName === "semi_finished_materials") return "semi_finished";
  return "raw_material";
};

export const getInventoryLogs = async ({ limit = DEFAULT_INVENTORY_LOG_LIMIT } = {}) => logsAdapter.list({ limit });

export const addInventoryLog = async (
  itemId,
  itemName,
  quantityChange,
  type,
  collectionName,
  extraData = {}
) => buildInventoryLogPayload({
  itemId,
  itemName,
  quantityChange,
  type,
  collectionName,
  extraData,
});

export const updateInventoryStock = async ({
  itemId,
  collectionName,
  quantityChange = 0,
  variantKey = "",
  preventNegative = false,
} = {}) => {
  const quantityDelta = Number(quantityChange || 0);

  return commitStockAdjustment({
    sourceType: resolveSourceType(collectionName),
    sourceId: itemId,
    variantKey,
    quantity: Math.abs(quantityDelta),
    deltaCurrent: quantityDelta,
    preventNegative,
    reason: "inventory_service_update",
    referenceNumber: `INV-${Date.now()}`,
  });
};
