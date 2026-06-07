const crypto = require("crypto");
const { getDb } = require("../db/connection");
const { failure } = require("../utils/response");

const hashSessionToken = (token = "") =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

const getBearerToken = (req) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (!/^Bearer$/i.test(scheme || "") || !token) return "";
  return token.trim();
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

const requireLocalAuth = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return failure(res, "Session lokal tidak ditemukan. Login ulang.", "UNAUTHENTICATED", 401);
    }

    const db = await getDb();
    const tokenHash = hashSessionToken(token);
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

    const now = new Date();
    const expiresAt = session?.expires_at ? new Date(session.expires_at) : null;

    if (!session || session.revoked_at || !expiresAt || expiresAt <= now) {
      return failure(res, "Session lokal sudah tidak aktif. Login ulang.", "SESSION_EXPIRED", 401);
    }

    if (session.status !== "active") {
      return failure(res, "User lokal tidak aktif.", "USER_INACTIVE", 403);
    }

    req.localAuth = {
      sessionId: session.session_id,
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
  hashSessionToken,
  requireLocalAuth,
  requireLocalRole,
  requireLocalAdministrator,
  requireLocalOperationalUser,
};
