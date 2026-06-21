import { throwUnavailableMaintenanceTool } from "./resetMaintenanceDataService";

export const getTransactionVariantMaintenanceAudit = async () =>
  throwUnavailableMaintenanceTool("Audit varian transaksi");

export const repairTransactionVariantMaintenance = async () =>
  throwUnavailableMaintenanceTool("Repair varian transaksi");
