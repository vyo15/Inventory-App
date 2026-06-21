import { throwUnavailableMaintenanceTool } from "./resetMaintenanceDataService";

export const getPayrollSnapshotMaintenanceAudit = async () =>
  throwUnavailableMaintenanceTool("Audit snapshot payroll");

export const repairPayrollSnapshotMaintenance = async () =>
  throwUnavailableMaintenanceTool("Repair snapshot payroll");
