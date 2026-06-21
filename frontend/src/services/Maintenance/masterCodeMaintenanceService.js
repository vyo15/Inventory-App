import { throwUnavailableMaintenanceTool } from "./resetMaintenanceDataService";

export const getMasterCodeMaintenanceAudit = async () =>
  throwUnavailableMaintenanceTool("Audit kode master");

export const repairMasterCodeMaintenance = async () =>
  throwUnavailableMaintenanceTool("Repair kode master");
