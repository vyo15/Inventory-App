import { throwUnavailableMaintenanceTool } from "./resetMaintenanceDataService";

export const getHppReconcileMaintenanceAudit = async () =>
  throwUnavailableMaintenanceTool("Audit reconcile HPP");

export const repairHppReconcileMaintenance = async () =>
  throwUnavailableMaintenanceTool("Repair reconcile HPP");
