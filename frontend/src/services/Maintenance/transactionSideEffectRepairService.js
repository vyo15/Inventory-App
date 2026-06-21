import { throwUnavailableMaintenanceTool } from "./resetMaintenanceDataService";

export const getTransactionSideEffectRepairAudit = async () =>
  throwUnavailableMaintenanceTool("Audit side-effect transaksi");

export const repairTransactionSideEffects = async () =>
  throwUnavailableMaintenanceTool("Repair side-effect transaksi");
