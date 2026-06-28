const { failure } = require("../utils/response");
const {
  getTestingLabWriteLock,
  registerTestingLabWriteRequest,
} = require("../modules/testingLab/testingLab.runtime");

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const WRITE_LOCK_CONTROL_ENDPOINTS = new Set([
  "/api/testing-lab/reset",
  "/api/testing-lab/operational-source/clone",
]);

const testingLabWriteGuard = (req, res, next) => {
  if (READ_ONLY_METHODS.has(String(req.method || "").toUpperCase())) return next();

  const lock = getTestingLabWriteLock();
  if (lock) {
    return failure(
      res,
      "Database sedang dikunci sementara oleh Lab Pengujian. Tunggu proses selesai lalu muat ulang data.",
      "TESTING_LAB_WRITE_LOCKED",
      423,
      { lock },
    );
  }

  const rawRequestPath = String(req.originalUrl || req.url || "").split("?")[0];
  const requestPath = rawRequestPath.length > 1 ? rawRequestPath.replace(/\/+$/, "") : rawRequestPath;
  if (WRITE_LOCK_CONTROL_ENDPOINTS.has(requestPath)) return next();

  const release = registerTestingLabWriteRequest({
    method: req.method,
    path: requestPath,
  });
  res.once("finish", release);
  res.once("close", release);
  return next();
};

module.exports = { testingLabWriteGuard };
