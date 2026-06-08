const { getDb } = require("../../db/connection");

const normalizeLimit = (value) => Math.min(Number(value || 50), 200);
const normalizeModuleName = (value) => (value ? String(value) : null);

const listAuditLogs = async ({ limit: requestedLimit, module: requestedModule } = {}) => {
  const db = await getDb();
  const limit = normalizeLimit(requestedLimit);
  const moduleName = normalizeModuleName(requestedModule);

  const rows = moduleName
    ? await db.all(
      "SELECT * FROM audit_logs WHERE module = ? ORDER BY id DESC LIMIT ?",
      [moduleName, limit]
    )
    : await db.all("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", [limit]);

  return {
    rows,
    meta: {
      limit,
      module: moduleName,
    },
  };
};

module.exports = {
  listAuditLogs,
};
