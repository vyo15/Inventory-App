import { requestSqliteApi } from "./sqliteApiClient";
import { createSqliteJsonRecordAdapter } from "./sqliteJsonRecordAdapterFactory";

const adapter = createSqliteJsonRecordAdapter({ endpoint: "/api/stock-adjustments" });

export const listStockAdjustments = adapter.list;
export const subscribeStockAdjustments = adapter.subscribe;

export const commitStockAdjustment = async (payload = {}) => {
  const result = await requestSqliteApi("/api/stock/adjustments/commit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result?.data || null;
};
