import { throwUnavailableMaintenanceTool } from "./resetMaintenanceDataService";

export const getHistoricalDataMaintenanceAudit = async () =>
  throwUnavailableMaintenanceTool("Audit data historis");
