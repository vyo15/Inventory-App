import { createSqliteJsonRecordAdapter } from "./sqliteJsonRecordAdapterFactory";

const adapter = createSqliteJsonRecordAdapter({ endpoint: "/api/stock-read-models" });

export const listStockReadModels = adapter.list;
export const createStockReadModel = adapter.create;
export const updateStockReadModel = adapter.update;
export const deleteStockReadModel = adapter.remove;
