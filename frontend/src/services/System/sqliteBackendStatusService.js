const DEFAULT_SQLITE_BACKEND_PORT = "3001";
const LEGACY_AUTH_TOKEN_KEY = "ims.sqlite.authToken";
export const MAINTENANCE_STATUS_CONTRACT_VERSION = 3;
const LEGACY_SQLITE_CLIENT_ID_KEY = "ims.sqlite.clientId";
const SQLITE_BROWSER_ID_KEY = "ims.sqlite.browserId";
let sqliteBrowserId = "";
let sqlitePageInstanceId = "";

const REQUIRED_MAINTENANCE_COUNT_TABLES = Object.freeze([
  "categories",
  "customers",
  "suppliers",
  "users",
  "audit_logs",
]);

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

const createRuntimeIdentifier = (prefix) => {
  const randomPart = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${randomPart}`;
};

const getSqliteBrowserId = () => {
  if (sqliteBrowserId) return sqliteBrowserId;

  try {
    const existing = window.localStorage.getItem(SQLITE_BROWSER_ID_KEY);
    if (existing) {
      sqliteBrowserId = existing;
      return sqliteBrowserId;
    }

    sqliteBrowserId = createRuntimeIdentifier("browser");
    window.localStorage.setItem(SQLITE_BROWSER_ID_KEY, sqliteBrowserId);
    return sqliteBrowserId;
  } catch {
    sqliteBrowserId = createRuntimeIdentifier("browser-volatile");
    return sqliteBrowserId;
  }
};

const getSqlitePageInstanceId = () => {
  if (!sqlitePageInstanceId) sqlitePageInstanceId = createRuntimeIdentifier("page");
  return sqlitePageInstanceId;
};

export const getSqliteClientId = () => {
  if (typeof window === "undefined") return "server-render";
  try {
    window.sessionStorage.removeItem(LEGACY_SQLITE_CLIENT_ID_KEY);
  } catch {
    // Legacy sessionStorage boleh tidak tersedia; ID halaman tetap dibuat di memory.
  }
  return `${getSqliteBrowserId()}:${getSqlitePageInstanceId()}`.slice(0, 128);
};

export const getSqliteClientHeaders = () => ({
  "X-IMS-Client-ID": getSqliteClientId(),
});

export const getStoredSqliteAuthToken = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(LEGACY_AUTH_TOKEN_KEY) || "";
};

export const clearStoredSqliteAuthToken = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
};

// Temporary compatibility for sessions created before HttpOnly cookie migration.
export const getStoredSqliteAuthHeaders = () => {
  const token = getStoredSqliteAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const fetchSqliteJson = async (path, options = {}) => {
  const baseUrl = getSqliteBackendBaseUrl();
  let response;

  try {
    response = await fetch(`${baseUrl}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...getSqliteClientHeaders(),
        ...(options.headers || {}),
      },
    });
  } catch (requestError) {
    const error = new Error(
      `Layanan lokal tidak bisa dihubungi di ${baseUrl}. Pastikan layanan aplikasi berjalan dan HP/PC berada di jaringan yang sama.`
    );
    error.code = "SQLITE_BACKEND_UNAVAILABLE";
    error.errorCode = "SQLITE_BACKEND_UNAVAILABLE";
    error.cause = requestError;
    throw error;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok === false) {
    const error = new Error(payload?.message || `Request layanan lokal gagal (${response.status})`);
    error.status = response.status;
    error.code = payload?.code || payload?.errorCode || "";
    error.errorCode = payload?.code || payload?.errorCode || "";
    error.payload = payload;
    throw error;
  }

  return payload;
};

export const getSqliteBackendHealth = async () => fetchSqliteJson("/health");

export const validateSqliteMaintenanceStatusResponse = (response) => {
  const data = response?.data;
  const contractVersion = Number(data?.maintenanceStatusContractVersion || 0);
  const tableCounts = data?.tableCounts;
  const missingRequiredTables = REQUIRED_MAINTENANCE_COUNT_TABLES.filter((tableName) => (
    !Object.prototype.hasOwnProperty.call(tableCounts || {}, tableName)
  ));
  const contractReady = contractVersion >= MAINTENANCE_STATUS_CONTRACT_VERSION
    && data?.capabilities?.sqliteOnlyRuntime === true
    && data?.capabilities?.tableCounts === true
    && data?.capabilities?.tableRecordStatusCounts === true
    && data?.capabilities?.realtimeEvents === true
    && tableCounts
    && typeof tableCounts === "object"
    && !Array.isArray(tableCounts)
    && missingRequiredTables.length === 0;

  if (!contractReady) {
    const error = new Error(
      "Frontend dan backend IMS belum menggunakan versi yang sama. Hentikan layanan lalu jalankan kembali npm run dev dari folder project."
    );
    error.code = "SQLITE_STATUS_CONTRACT_MISMATCH";
    error.errorCode = "SQLITE_STATUS_CONTRACT_MISMATCH";
    error.expectedContractVersion = MAINTENANCE_STATUS_CONTRACT_VERSION;
    error.receivedContractVersion = contractVersion || null;
    error.missingRequiredTables = missingRequiredTables;
    error.payload = response;
    throw error;
  }

  return response;
};

export const getSqliteBackendStatus = async () => validateSqliteMaintenanceStatusResponse(
  await fetchSqliteJson("/api/maintenance/status", {
    headers: getStoredSqliteAuthHeaders(),
  })
);

export const getSqliteInitialSetupReadiness = async () => fetchSqliteJson(
  "/api/maintenance/initial-setup-readiness",
  { headers: getStoredSqliteAuthHeaders() },
);

export const createSqliteBackendBackup = async (values = {}) => fetchSqliteJson("/api/maintenance/backup", {
  method: "POST",
  headers: getStoredSqliteAuthHeaders(),
  body: JSON.stringify(values),
});

export const getSqliteBackendBackups = async () => fetchSqliteJson("/api/maintenance/backups", {
  headers: getStoredSqliteAuthHeaders(),
});

export const getSqliteMasterDataExport = async ({ includeOpeningStock = true } = {}) => fetchSqliteJson(
  `/api/maintenance/master-data-export?includeOpeningStock=${includeOpeningStock ? "true" : "false"}`,
  { headers: getStoredSqliteAuthHeaders() },
);

export const downloadSqliteBackendBackup = async (filename) => {
  const baseUrl = getSqliteBackendBaseUrl();
  const response = await fetch(`${baseUrl}/api/maintenance/backups/${encodeURIComponent(filename)}/download`, {
    credentials: "include",
    headers: { ...getSqliteClientHeaders(), ...getStoredSqliteAuthHeaders() },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || `Download backup gagal (${response.status})`);
  }

  return {
    blob: await response.blob(),
    filename: decodeURIComponent(response.headers.get("X-IMS-Backup-Filename") || encodeURIComponent(filename)),
  };
};

export const importSqliteBackendBackup = async (file) => {
  const baseUrl = getSqliteBackendBaseUrl();
  const response = await fetch(`${baseUrl}/api/maintenance/backups/import`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...getSqliteClientHeaders(),
      ...getStoredSqliteAuthHeaders(),
      "Content-Type": "application/octet-stream",
      "X-IMS-Backup-Filename": encodeURIComponent(file?.name || "backup.imsbackup"),
    },
    body: file,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || `Import backup gagal (${response.status})`);
  }

  return payload;
};

export const getSqliteModuleRuntimeStatus = async () => fetchSqliteJson("/api/module-runtime-status", {
  headers: getStoredSqliteAuthHeaders(),
});

export const getSqliteMigrationStatus = getSqliteModuleRuntimeStatus;

export const createSqliteRestorePlan = async (values = {}) => fetchSqliteJson("/api/maintenance/restore-plan", {
  method: "POST",
  headers: getStoredSqliteAuthHeaders(),
  body: JSON.stringify(values),
});

export const getSqliteRestoreLogs = async () => fetchSqliteJson("/api/maintenance/restore-logs", {
  headers: getStoredSqliteAuthHeaders(),
});

export const getSqliteAuditLogs = async ({ module = "maintenance", limit = 50 } = {}) => {
  const query = new URLSearchParams({ module, limit: String(limit) });
  return fetchSqliteJson(`/api/audit-logs?${query.toString()}`, {
    headers: getStoredSqliteAuthHeaders(),
  });
};

export const getSqliteAuthStatus = async () => fetchSqliteJson("/api/auth/status");

export const executeSqliteRestore = async (values = {}, token = "") => fetchSqliteJson("/api/maintenance/restore-execute", {
  method: "POST",
  headers: token ? { Authorization: `Bearer ${token}` } : getStoredSqliteAuthHeaders(),
  body: JSON.stringify(values),
});

export const getSqliteInactiveData = async ({ entityType = "" } = {}) => {
  const query = new URLSearchParams();
  if (entityType) query.set("entityType", entityType);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return fetchSqliteJson(`/api/maintenance/inactive-data${suffix}`, {
    headers: getStoredSqliteAuthHeaders(),
  });
};

export const purgeSqliteInactiveData = async (values = {}) => fetchSqliteJson(
  "/api/maintenance/inactive-data/purge",
  {
    method: "POST",
    headers: getStoredSqliteAuthHeaders(),
    body: JSON.stringify(values),
  },
);

