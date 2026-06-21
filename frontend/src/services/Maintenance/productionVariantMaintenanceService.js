import { throwUnavailableMaintenanceTool } from "./resetMaintenanceDataService";

export const getProductionVariantMaintenanceAudit = async () =>
  throwUnavailableMaintenanceTool("Audit varian produksi");

export const repairProductionVariantMaintenance = async () =>
  throwUnavailableMaintenanceTool("Repair varian produksi");
