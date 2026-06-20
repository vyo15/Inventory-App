const crypto = require("crypto");
const { getDb } = require("../db/connection");
const env = require("../config/env");
const { failure } = require("../utils/response");
const { clearSessionCookie, getSessionCookieToken } = require("../utils/authSessionCookie");

const hashSessionToken = (token = "") =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

const getBearerToken = (req) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (!/^Bearer$/i.test(scheme || "") || !token) return "";
  return token.trim();
};

const getSessionTokenCandidates = (req) => {
  const candidates = [
    { source: "cookie", token: getSessionCookieToken(req) },
    ...(env.authAllowLegacyBearer
      ? [{ source: "bearer", token: getBearerToken(req) }]
      : []),
  ].filter((candidate) => candidate.token);

  return candidates.filter(
    (candidate, index) => candidates.findIndex((item) => item.token === candidate.token) === index
  );
};

const toAuthUser = (row = {}) => ({
  id: row.user_id,
  authUid: `local-${row.user_id}`,
  username: row.username,
  usernameLower: row.username_lower,
  displayName: row.display_name || row.username,
  role: row.role,
  status: row.status,
  authProvider: "sqlite_local",
});

const findActiveSession = async (db, candidates = []) => {
  for (const candidate of candidates) {
    const tokenHash = hashSessionToken(candidate.token);
    const session = await db.get(
      `
        SELECT
          s.id AS session_id,
          s.expires_at,
          s.revoked_at,
          u.id AS user_id,
          u.username,
          u.username_lower,
          u.display_name,
          u.role,
          u.status
        FROM local_user_sessions s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ?
        LIMIT 1
      `,
      [tokenHash]
    );

    const expiresAt = session?.expires_at ? new Date(session.expires_at) : null;
    const isActive = session && !session.revoked_at && expiresAt && expiresAt > new Date();
    if (isActive) return { candidate, expiresAt, session, tokenHash };
  }

  return null;
};

const requireLocalAuth = async (req, res, next) => {
  try {
    const candidates = getSessionTokenCandidates(req);
    if (candidates.length === 0) {
      clearSessionCookie(res);
      return failure(res, "Session lokal tidak ditemukan. Login ulang.", "UNAUTHENTICATED", 401);
    }

    const db = await getDb();
    const activeSession = await findActiveSession(db, candidates);
    if (!activeSession) {
      clearSessionCookie(res);
      return failure(res, "Session lokal sudah tidak aktif. Login ulang.", "SESSION_EXPIRED", 401);
    }

    const { candidate, expiresAt, session, tokenHash } = activeSession;
    if (session.status !== "active") {
      clearSessionCookie(res);
      return failure(res, "User lokal tidak aktif.", "USER_INACTIVE", 403);
    }

    req.localAuth = {
      authSource: candidate.source,
      expiresAt: expiresAt.toISOString(),
      sessionId: session.session_id,
      sessionToken: candidate.token,
      tokenHash,
      user: toAuthUser(session),
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

const requireLocalRole = (allowedRoles = []) => (req, res, next) => {
  const role = req.localAuth?.user?.role;
  if (!allowedRoles.includes(role)) {
    return failure(res, "Role lokal tidak memiliki akses ke aksi ini.", "FORBIDDEN", 403, {
      allowedRoles,
      currentRole: role || null,
    });
  }
  return next();
};

const requireLocalAdministrator = requireLocalRole(["administrator"]);
const requireLocalOperationalUser = requireLocalRole(["administrator", "user"]);

module.exports = {
  getBearerToken,
  getSessionTokenCandidates,
  hashSessionToken,
  requireLocalAuth,
  requireLocalRole,
  requireLocalAdministrator,
  requireLocalOperationalUser,
};
