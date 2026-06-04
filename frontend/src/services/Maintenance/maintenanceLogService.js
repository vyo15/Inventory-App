const logs = [];
export const createMaintenanceLog = async ({ actionType = "maintenance", mode = "dry_run", modules = [], summary = {}, affectedCollections = [], affectedCount = 0, dryRun = true, status = "success", note = "", executedBy = "client-ui" } = {}) => {
  const id = `maintenance_${Date.now()}`;
  logs.unshift({ id, actionType, mode, modules, summary, affectedCollections, affectedCount, dryRun, status, note, executedBy, executedAt: new Date().toISOString() });
  return id;
};
export const updateMaintenanceLogStatus = async (logId, payload = {}) => { const row = logs.find((item) => item.id === logId); if (row) Object.assign(row, payload, { updatedAt: new Date().toISOString() }); return logId; };
export const getLatestMaintenanceLogs = async (maxItems = 20) => logs.slice(0, maxItems);
