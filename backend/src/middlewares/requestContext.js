const crypto = require("crypto");
const { AsyncLocalStorage } = require("node:async_hooks");

const requestContextStorage = new AsyncLocalStorage();

const normalizeClientId = (value = "") => String(value || "")
  .trim()
  .replace(/[^a-zA-Z0-9._:-]/g, "")
  .slice(0, 128);

const requestContextMiddleware = (req, _res, next) => {
  const clientId = normalizeClientId(
    req.get("x-ims-client-id") || req.query?.clientId || ""
  );

  requestContextStorage.run({
    clientId,
    requestId: crypto.randomUUID(),
    method: req.method,
    path: req.path,
  }, next);
};

const getRequestContext = () => requestContextStorage.getStore() || {};

module.exports = {
  getRequestContext,
  normalizeClientId,
  requestContextMiddleware,
};
