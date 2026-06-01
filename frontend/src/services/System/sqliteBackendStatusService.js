const DEFAULT_SQLITE_BACKEND_PORT = "3001";

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
    error.payload = payload;
    throw error;
  }

  return payload;
};

export const getSqliteBackendHealth = async () => fetchSqliteJson("/health");

export const getSqliteBackendStatus = async () => fetchSqliteJson("/api/maintenance/status");

export const createSqliteBackendBackup = async () => fetchSqliteJson("/api/maintenance/backup", {
  method: "POST",
});

export const getSqliteBackendBackups = async () => fetchSqliteJson("/api/maintenance/backups");


export const getSqliteMigrationStatus = async () => fetchSqliteJson("/api/migration-status");

export const createSqliteRestorePlan = async (values = {}) => fetchSqliteJson("/api/maintenance/restore-plan", {
  method: "POST",
  body: JSON.stringify(values),
});

export const getSqliteRestoreLogs = async () => fetchSqliteJson("/api/maintenance/restore-logs");
