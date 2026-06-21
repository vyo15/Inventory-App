import { throwUnavailableMaintenanceTool } from "./resetMaintenanceDataService";

export const getDataQualityAudit = async () =>
  throwUnavailableMaintenanceTool("Audit kualitas data");
