const DEFAULT_SQLITE_BACKEND_PORT = "3001";
const LOCAL_AUTH_TOKEN_KEY = "ims.sqlite.authToken";

const normalizeBaseUrl = (value) => String(value || "").replace(/\/$/, "");

const getRuntimeHostBaseUrl = () => {
  if (typeof window === "undefined") return `http://localhost:${DEFAULT_SQLITE_BACKEND_PORT}`;

  const { protocol, hostname } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const targetHost = isLocalhost ? "localhost" : hostname;

  return `${protocol}//${targetHost}:${DEFAULT_SQLITE_BACKEND_PORT}`;
};

export const getSqliteBackendBaseUrl = () => normalizeBaseUrl(
  import.meta.env.VITE_SQLITE_API_BASE_URL || getRuntimeHostBaseUrl(),
);

export const getStoredSqliteAuthHeaders = () => {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem(LOCAL_AUTH_TOKEN_KEY) || "";
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchSqliteJson = async (path, options = {}) => {
  const baseUrl = getSqliteBackendBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok === false) {
    const error = new Error(payload?.message || `SQLite backend request gagal (${response.status})`);
    error.status = response.status;
    error.code = payload?.code || payload?.errorCode || "";
    error.errorCode = payload?.code || payload?.errorCode || "";
    error.payload = payload;
    throw error;
  }

  return payload;
};

export const getSqliteBackendHealth = async () => fetchSqliteJson("/health");

export const getSqliteBackendStatus = async () => fetchSqliteJson("/api/maintenance/status");

export const createSqliteBackendBackup = async (values = {}) => fetchSqliteJson("/api/maintenance/backup", {
  method: "POST",
  headers: getStoredSqliteAuthHeaders(),
  body: JSON.stringify(values),
});

export const getSqliteBackendBackups = async () => fetchSqliteJson("/api/maintenance/backups", {
  headers: getStoredSqliteAuthHeaders(),
});


export const getSqliteMigrationStatus = async () => fetchSqliteJson("/api/migration-status");

export const createSqliteRestorePlan = async (values = {}) => fetchSqliteJson("/api/maintenance/restore-plan", {
  method: "POST",
  headers: getStoredSqliteAuthHeaders(),
  body: JSON.stringify(values),
});

export const getSqliteRestoreLogs = async () => fetchSqliteJson("/api/maintenance/restore-logs", {
  headers: getStoredSqliteAuthHeaders(),
});

export const getSqliteAuthStatus = async () => fetchSqliteJson("/api/auth/status");

export const executeSqliteRestore = async (values = {}, token = "") => fetchSqliteJson("/api/maintenance/restore-execute", {
  method: "POST",
  headers: token ? { Authorization: `Bearer ${token}` } : getStoredSqliteAuthHeaders(),
  body: JSON.stringify(values),
});
