const { createSqliteJsonRecordRouter } = require("./createSqliteJsonRecordRouter");
const { defaultExtractColumns } = require("./recordMapper");
const { normalizeCode, normalizeText, toInteger } = require("./operationResult");

module.exports = {
  createSqliteJsonRecordRouter,
  defaultExtractColumns,
  normalizeCode,
  normalizeText,
  toInteger,
};
