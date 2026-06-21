import { throwUnavailableMaintenanceTool } from "./resetMaintenanceDataService";

export const getInventoryStockMaintenanceAudit = async () =>
  throwUnavailableMaintenanceTool("Audit stok inventory");

export const repairInventoryStockMaintenance = async () =>
  throwUnavailableMaintenanceTool("Repair stok inventory");

export const getInventoryLogSchemaAudit = async () =>
  throwUnavailableMaintenanceTool("Audit schema inventory log");

export const repairInventoryLogSchema = async () =>
  throwUnavailableMaintenanceTool("Repair schema inventory log");
