import { createClientId } from "../../utils/ids/createClientId";
const STORAGE_KEY = "ims.maintenance.session-log.v1";
const EVIDENCE_SCOPE = "client_session_only";
const memoryFallbackLogs = [];

const getSessionStorage = () => {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

const readLogs = () => {
  const storage = getSessionStorage();
  if (!storage) return [...memoryFallbackLogs];

  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLogs = (logs) => {
  const normalizedLogs = Array.isArray(logs) ? logs : [];
  const storage = getSessionStorage();

  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalizedLogs));
    return;
  }

  memoryFallbackLogs.splice(0, memoryFallbackLogs.length, ...normalizedLogs);
};

export const createMaintenanceLog = async ({
  actionType = "maintenance",
  mode = "dry_run",
  modules = [],
  summary = {},
  affectedCollections = [],
  affectedCount = 0,
  dryRun = true,
  status = "success",
  note = "",
  executedBy = "client-ui",
} = {}) => {
  const now = new Date().toISOString();
  const id = createClientId("maintenance");
  const logs = readLogs();

  logs.unshift({
    id,
    actionType,
    mode,
    modules,
    summary,
    affectedCollections,
    affectedCount,
    dryRun,
    status,
    note,
    executedBy,
    evidenceScope: EVIDENCE_SCOPE,
    executedAt: now,
  });

  writeLogs(logs.slice(0, 100));
  return id;
};

export const updateMaintenanceLogStatus = async (logId, payload = {}) => {
  const logs = readLogs();
  const row = logs.find((item) => item.id === logId);

  if (row) {
    Object.assign(row, payload, {
      evidenceScope: EVIDENCE_SCOPE,
      updatedAt: new Date().toISOString(),
    });
    writeLogs(logs);
  }

  return logId;
};

export const getLatestMaintenanceLogs = async (maxItems = 20) =>
  readLogs().slice(0, Math.max(0, Number(maxItems) || 0));

export const MAINTENANCE_LOG_EVIDENCE_SCOPE = EVIDENCE_SCOPE;
