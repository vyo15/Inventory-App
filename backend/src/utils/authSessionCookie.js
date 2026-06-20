const env = require("../config/env");

const SESSION_COOKIE_NAME = "ims_session";

const parseCookieHeader = (header = "") => String(header || "")
  .split(";")
  .map((part) => part.trim())
  .filter(Boolean)
  .reduce((cookies, part) => {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) return cookies;

    const name = part.slice(0, separatorIndex).trim();
    const rawValue = part.slice(separatorIndex + 1).trim();
    try {
      cookies[name] = decodeURIComponent(rawValue);
    } catch {
      cookies[name] = rawValue;
    }
    return cookies;
  }, {});

const getSessionCookieToken = (req) => {
  const cookies = parseCookieHeader(req?.headers?.cookie || "");
  return String(cookies[SESSION_COOKIE_NAME] || "").trim();
};

const buildCookieAttributes = ({ expiresAt, clear = false } = {}) => {
  const attributes = [
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (env.authCookieSecure) attributes.push("Secure");

  if (clear) {
    attributes.push("Max-Age=0");
    attributes.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    return attributes;
  }

  const expires = expiresAt ? new Date(expiresAt) : null;
  if (expires && !Number.isNaN(expires.getTime())) {
    const maxAgeSeconds = Math.max(Math.floor((expires.getTime() - Date.now()) / 1000), 0);
    attributes.push(`Max-Age=${maxAgeSeconds}`);
    attributes.push(`Expires=${expires.toUTCString()}`);
  }

  return attributes;
};

const setSessionCookie = (res, token, expiresAt) => {
  const value = encodeURIComponent(String(token || ""));
  res.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${value}; ${buildCookieAttributes({ expiresAt }).join("; ")}`
  );
};

const clearSessionCookie = (res) => {
  res.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; ${buildCookieAttributes({ clear: true }).join("; ")}`
  );
};

module.exports = {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  getSessionCookieToken,
  parseCookieHeader,
  setSessionCookie,
};
