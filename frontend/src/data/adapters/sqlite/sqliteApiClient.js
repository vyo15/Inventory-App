import {
  fetchSqliteJson,
  getStoredSqliteAuthHeaders,
} from "../../../services/System/sqliteBackendStatusService";

const withLocalAuthHeaders = (options = {}) => ({
  ...options,
  headers: {
    ...getStoredSqliteAuthHeaders(),
    ...(options.headers || {}),
  },
});

// fetchSqliteJson menyuntikkan X-IMS-Client-ID secara terpusat agar seluruh adapter
// memakai origin ID yang sama dengan koneksi SSE tanpa duplikasi header per modul.
export const requestSqliteApi = (path, options = {}) => fetchSqliteJson(
  path,
  withLocalAuthHeaders(options),
);
