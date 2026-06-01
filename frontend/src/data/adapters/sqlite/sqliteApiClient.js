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

export const requestSqliteApi = (path, options = {}) => fetchSqliteJson(path, withLocalAuthHeaders(options));
