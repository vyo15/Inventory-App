const { failure } = require("../utils/response");

function notFoundHandler(req, res) {
  void req;
  return failure(res, "Endpoint tidak ditemukan", "NOT_FOUND", 404);
}

function errorHandler(error, req, res, next) {
  void req;
  console.error("IMS layanan database lokal error:", error);

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
