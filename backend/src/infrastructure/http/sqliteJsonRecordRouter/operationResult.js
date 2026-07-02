const {
  normalizeText,
  normalizeUpperText,
  toRoundedInteger: toInteger,
} = require("../../../utils/textNormalization");
const { failure, success } = require("../../../utils/response");




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
  normalizeCode: normalizeUpperText,
  normalizeText,
  operationFailure,
  operationSuccess,
  sendOperationResult,
  toInteger,
};
