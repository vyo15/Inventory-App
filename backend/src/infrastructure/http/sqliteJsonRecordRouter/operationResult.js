const { failure, success } = require("../../../utils/response");

const normalizeText = (value) => String(value ?? "").trim();
const normalizeCode = (value) => normalizeText(value).toUpperCase();
const toInteger = (value = 0) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const operationSuccess = (message, data = null, meta = undefined, statusCode = 200) => ({
  ok: true,
  message,
  data,
  meta,
  statusCode,
});

const operationFailure = (message, errorCode = "ERROR", statusCode = 400, details = undefined) => ({
  ok: false,
  message,
  errorCode,
  statusCode,
  details,
});

const sendOperationResult = (res, result = {}) => (result.ok
  ? success(res, result.message, result.data, result.meta, result.statusCode)
  : failure(res, result.message, result.errorCode, result.statusCode, result.details));

module.exports = {
  normalizeCode,
  normalizeText,
  operationFailure,
  operationSuccess,
  sendOperationResult,
  toInteger,
};
