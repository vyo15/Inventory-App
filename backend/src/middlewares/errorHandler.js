const { failure } = require("../utils/response");
const logger = require("../utils/logger");

function notFoundHandler(req, res) {
  logger.warn("http_not_found", { method: req.method, path: req.path });
  return failure(res, "Endpoint tidak ditemukan", "NOT_FOUND", 404);
}

function errorHandler(error, req, res, next) {
  logger.error("http_request_error", {
    method: req.method,
    path: req.path,
    actor: req.localAuth?.user?.username || null,
    error,
  });

  if (res.headersSent) {
    return next(error);
  }

  return failure(
    res,
    error?.publicMessage || "Terjadi error pada server layanan database lokal",
    error?.errorCode || "INTERNAL_SERVER_ERROR",
    error?.statusCode || 500
  );
}

module.exports = { notFoundHandler, errorHandler };
