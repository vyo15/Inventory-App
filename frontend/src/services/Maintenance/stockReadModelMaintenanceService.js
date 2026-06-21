import { throwUnavailableMaintenanceTool } from "./resetMaintenanceDataService";

export const getStockReadModelMaintenanceAudit = async () =>
  throwUnavailableMaintenanceTool("Audit Stock Read Model");

export const rebuildStockReadModelMaintenance = async () =>
  throwUnavailableMaintenanceTool("Rebuild Stock Read Model");

export const backfillStockReadModelRestockMetadataMaintenance = async () =>
  throwUnavailableMaintenanceTool("Backfill metadata restock Stock Read Model");

export const deleteOrphanStockReadModelsMaintenance = async () =>
  throwUnavailableMaintenanceTool("Cleanup orphan Stock Read Model");
