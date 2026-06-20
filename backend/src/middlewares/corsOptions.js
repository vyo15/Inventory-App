const env = require("../config/env");
const { failure } = require("../utils/response");

const normalizeOrigin = (value = "") => String(value || "").trim().replace(/\/$/, "");
const normalizeHostname = (value = "") => String(value || "").trim().toLowerCase().replace(/^\[|\]$/g, "");

const isLoopbackHostname = (hostname) => ["localhost", "127.0.0.1", "::1"].includes(
  normalizeHostname(hostname)
);

const parseOrigin = (origin = "") => {
  try {
    const parsed = new URL(origin);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const getRequestHostname = (req) => normalizeHostname(req?.hostname || req?.headers?.host?.split(":")[0]);

const isTrustedOrigin = (req, origin = "") => {
  if (!origin) return true;

  const parsedOrigin = parseOrigin(origin);
  if (!parsedOrigin) return false;

  const normalizedOrigin = normalizeOrigin(parsedOrigin.origin);
  if (env.corsOrigins.includes(normalizedOrigin)) return true;

  const originHostname = normalizeHostname(parsedOrigin.hostname);
  const requestHostname = getRequestHostname(req);
  if (!originHostname || !requestHostname) return false;

  if (originHostname === requestHostname) return true;
  return isLoopbackHostname(originHostname) && isLoopbackHostname(requestHostname);
};

const enforceTrustedOrigin = (req, res, next) => {
  const origin = req.get("origin") || "";
  res.vary("Origin");

  if (!isTrustedOrigin(req, origin)) {
    return failure(
      res,
      "Origin aplikasi tidak diizinkan mengakses layanan lokal.",
      "CORS_ORIGIN_FORBIDDEN",
      403
    );
  }

  return next();
};

const createCorsOptionsDelegate = (req, callback) => {
  const origin = req.get("origin") || "";
  const allowed = isTrustedOrigin(req, origin);

  callback(null, {
    origin: allowed && origin ? origin : false,
    credentials: true,
    optionsSuccessStatus: 204,
  });
};

module.exports = {
  createCorsOptionsDelegate,
  enforceTrustedOrigin,
  isTrustedOrigin,
};
