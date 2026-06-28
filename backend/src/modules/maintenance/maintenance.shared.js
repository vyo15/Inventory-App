const { createHttpError: createCanonicalHttpError } = require("../../utils/httpError");
const createHttpError = (message, statusCode = 400, errorCode = "MAINTENANCE_ERROR", options = {}) =>
  createCanonicalHttpError(message, errorCode, statusCode, options);



const decodeImportFilename = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";
  try {
    return decodeURIComponent(rawValue);
  } catch (_error) {
    return rawValue;
  }
};


module.exports = { createHttpError, decodeImportFilename };
