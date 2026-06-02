import { createSqliteJsonRecordAdapter } from "./sqliteJsonRecordAdapterFactory";

const purchasesAdapter = createSqliteJsonRecordAdapter({ endpoint: "/api/transactions/purchases" });
const salesAdapter = createSqliteJsonRecordAdapter({ endpoint: "/api/transactions/sales" });
const returnsAdapter = createSqliteJsonRecordAdapter({ endpoint: "/api/transactions/returns" });

export const listPurchases = purchasesAdapter.list;
export const listSales = salesAdapter.list;
export const listReturns = returnsAdapter.list;
