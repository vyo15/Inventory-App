const {
  getBusinessCodePreview,
  resolveBusinessCode,
} = require("../../../utils/businessCodeCounter");
const { normalizeCode } = require("./operationResult");

const getCodeCounterOptions = (tableName, prefix = "REF") => ({
  counterKey: `${tableName}:${normalizeCode(prefix)}`,
  prefix: normalizeCode(prefix),
  tableName,
  columnName: "code",
  minWidth: 3,
  notes: `Runtime counter untuk ${tableName}`,
});

const generateNextCode = (db, tableName, prefix = "REF") => getBusinessCodePreview(
  db,
  getCodeCounterOptions(tableName, prefix),
);

const resolveCreateCode = (db, tableName, prefix, requestedCode = "") => resolveBusinessCode(
  db,
  requestedCode,
  getCodeCounterOptions(tableName, prefix),
);

module.exports = { generateNextCode, resolveCreateCode };
