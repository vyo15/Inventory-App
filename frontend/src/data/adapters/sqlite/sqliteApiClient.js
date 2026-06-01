import { fetchSqliteJson } from "../../../services/System/sqliteBackendStatusService";

export const requestSqliteApi = (path, options = {}) => fetchSqliteJson(path, options);
