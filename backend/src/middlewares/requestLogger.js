const logger = require("../utils/logger");

function requestLogger(req, res, next) {
  const startedAt = Date.now();
  res.on("finish", () => {
    logger.info("http_request", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      actor: req.localAuth?.user?.username || null,
    });
  });
  next();
}

module.exports = requestLogger;
