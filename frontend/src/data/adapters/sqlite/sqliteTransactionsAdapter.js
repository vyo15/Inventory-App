import { requestSqliteApi } from "./sqliteApiClient";
import { createSqliteJsonRecordAdapter } from "./sqliteJsonRecordAdapterFactory";

const purchasesAdapter = createSqliteJsonRecordAdapter({ endpoint: "/api/transactions/purchases" });
const salesAdapter = createSqliteJsonRecordAdapter({ endpoint: "/api/transactions/sales" });
const returnsAdapter = createSqliteJsonRecordAdapter({ endpoint: "/api/transactions/returns" });

export const listPurchases = purchasesAdapter.list;
export const subscribePurchases = purchasesAdapter.subscribe;
export const listSales = salesAdapter.list;
export const subscribeSales = salesAdapter.subscribe;
export const listReturns = returnsAdapter.list;
export const subscribeReturns = returnsAdapter.subscribe;

export const commitPurchase = async (payload = {}) => {
  const result = await requestSqliteApi("/api/transactions/purchases/commit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result?.data || null;
};

export const commitSale = async (payload = {}) => {
  const result = await requestSqliteApi("/api/transactions/sales/commit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result?.data || null;
};

export const updateSaleStatus = async (saleId, payload = {}) => {
  const result = await requestSqliteApi(`/api/transactions/sales/${encodeURIComponent(saleId)}/status`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return result?.data || null;
};

export const commitReturn = async (payload = {}) => {
  const result = await requestSqliteApi("/api/transactions/returns/commit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result?.data || null;
};
