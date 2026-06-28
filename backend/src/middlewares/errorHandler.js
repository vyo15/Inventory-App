const { failure } = require("../utils/response");
const logger = require("../utils/logger");
const { resolvePublicHttpError } = require("../utils/httpError");

function notFoundHandler(req, res) {
  logger.warn("http_not_found", { method: req.method, path: req.path });
  return failure(res, "Endpoint tidak ditemukan", "NOT_FOUND", 404);
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const resolved = resolvePublicHttpError(error);
  const logPayload = {
    method: req.method,
    path: req.path,
    actor: req.localAuth?.user?.username || null,
    statusCode: resolved.statusCode,
    errorCode: resolved.errorCode,
  };

  if (resolved.statusCode >= 500) {
    logger.error("http_request_error", { ...logPayload, error });
  } else {
    logger.warn("http_request_rejected", {
      ...logPayload,
      message: resolved.publicMessage,
    });
  }

  return failure(
    res,
    resolved.publicMessage,
    resolved.errorCode,
    resolved.statusCode,
    resolved.details,
  );
}

module.exports = { notFoundHandler, errorHandler };
