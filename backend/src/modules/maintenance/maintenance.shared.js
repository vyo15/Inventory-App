const createHttpError = (message, statusCode = 400, errorCode = "MAINTENANCE_ERROR") => {
  const error = new Error(message);
  error.publicMessage = message;
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
};



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
