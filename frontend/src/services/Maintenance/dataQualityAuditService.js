import { requestSqliteApi } from "../../data/adapters/sqlite/sqliteApiClient";

export const getDataQualityAudit = async () => {
  const response = await requestSqliteApi("/api/maintenance/data-audit");
  return response?.data || response;
};
