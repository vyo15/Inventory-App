import { requestSqliteApi } from "../../data/adapters/sqlite/sqliteApiClient";
import { throwUnavailableMaintenanceTool } from "./resetMaintenanceDataService";

export const getStockReadModelMaintenanceAudit = async () => {
  const response = await requestSqliteApi("/api/maintenance/stock-read-model-audit");
  return response?.data || response;
};

export const rebuildStockReadModelMaintenance = async () => {
  const response = await requestSqliteApi("/api/maintenance/stock-read-model-rebuild", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return response?.data || response;
};

export const backfillStockReadModelRestockMetadataMaintenance = async () =>
  throwUnavailableMaintenanceTool("Backfill metadata restock Stock Read Model");

export const deleteOrphanStockReadModelsMaintenance = async ({ confirmKeyword = "" } = {}) => {
  const response = await requestSqliteApi("/api/maintenance/stock-read-model-orphan-cleanup", {
    method: "POST",
    body: JSON.stringify({ confirmKeyword }),
  });
  return response?.data || response;
};
