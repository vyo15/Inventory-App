const crypto = require("crypto");
const { getDb } = require("../../db/connection");
const { hashSessionToken } = require("../../middlewares/localAuth");
const { isBootstrapCodeValid } = require("./authBootstrapGuard");
const { createAuditLog } = require("../../utils/auditLog");
const { createPasswordHash, validatePasswordStrength, verifyPasswordHash } = require("../../utils/passwordHash");
const {
  ROLES,
  SESSION_DURATION_HOURS,
  USERNAME_PATTERN,
  USER_STATUSES,
} = require("./auth.constants");

const createAuthError = (message, code = "ERROR", statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const normalizeText = (value = "") => String(value || "").trim();
const normalizeUsername = (value = "") => normalizeText(value).toLowerCase();
const toIsoSqlDate = (date = new Date()) => date.toISOString();

const toSafeUser = (row = {}) => ({
  id: row.id,
  authUid: `local-${row.id}`,
  username: row.username,
  usernameLower: row.username_lower || row.username,
  displayName: row.display_name || row.username,
  role: row.role,
  status: row.status,
  authProvider: "sqlite_local",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastLoginAt: row.last_login_at,
});

const assertValidUsername = (username) => {
  if (!username || !USERNAME_PATTERN.test(username)) {
    throw createAuthError(
      "Username hanya boleh memakai huruf, angka, titik, underscore, atau strip.",
      "VALIDATION_ERROR"
    );
  }
};

const assertValidRole = (role) => {
  if (!ROLES.includes(role)) {
    throw createAuthError("Role lokal tidak valid.", "VALIDATION_ERROR");
  }
};

const assertValidStatus = (status) => {
  if (!USER_STATUSES.includes(status)) {
    throw createAuthError("Status user lokal tidak valid.", "VALIDATION_ERROR");
  }
};

const assertPasswordStrength = (password) => {
  const passwordError = validatePasswordStrength(password);
  if (passwordError) throw createAuthError(passwordError, "VALIDATION_ERROR");
};

const assertUsernameAvailable = async (db, usernameLower, excludeId = null) => {
  const existing = await db.get(
    "SELECT id FROM users WHERE username_lower = ? AND id != ?",
    [usernameLower, excludeId || 0]
  );
  if (existing) {
    throw createAuthError("Username lokal sudah dipakai.", "DUPLICATE_USERNAME", 409);
  }
};

const countActiveAdministrators = async (db) => {
  const row = await db.get(
    "SELECT COUNT(*) AS count FROM users WHERE role = 'administrator' AND status = 'active'"
  );
  return row?.count || 0;
};

const assertNotLastActiveAdministrator = async (db, targetUserId, nextRole, nextStatus) => {
  const current = await db.get("SELECT * FROM users WHERE id = ?", [targetUserId]);
  if (!current) return;

  const currentlyActiveAdmin = current.role === "administrator" && current.status === "active";
  const remainsActiveAdmin = nextRole === "administrator" && nextStatus === "active";

  if (!currentlyActiveAdmin || remainsActiveAdmin) return;

  const activeAdminCount = await countActiveAdministrators(db);
  if (activeAdminCount <= 1) {
    throw createAuthError(
      "Administrator lokal aktif terakhir tidak boleh dinonaktifkan atau diturunkan role-nya.",
      "LAST_ADMIN_GUARD"
    );
  }
};

const createSession = async (db, user, { userAgent = "", ipAddress = "" } = {}) => {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  await db.run(
    `
      INSERT INTO local_user_sessions (user_id, token_hash, user_agent, ip_address, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    [user.id, tokenHash, userAgent, ipAddress, toIsoSqlDate(expiresAt)]
  );

  return { token, expiresAt: toIsoSqlDate(expiresAt) };
};

async function getAuthStatus() {
  const db = await getDb();
  const activeAdminCount = await countActiveAdministrators(db);
  const bootstrapRequired = activeAdminCount === 0;

  return {
    authProvider: "local",
    bootstrapRequired,
    bootstrapCodeRequired: bootstrapRequired,
  };
}

async function bootstrapAdmin(payload = {}) {
  const db = await getDb();
  const activeAdminCount = await countActiveAdministrators(db);
  if (activeAdminCount > 0) {
    throw createAuthError(
      "Bootstrap admin lokal ditolak karena administrator aktif sudah ada.",
      "BOOTSTRAP_LOCKED",
      409
    );
  }

  const bootstrapCode = normalizeText(payload.bootstrapCode || payload.setupCode);
  if (!isBootstrapCodeValid(bootstrapCode)) {
    throw createAuthError(
      "Kode setup administrator tidak valid. Gunakan kode yang tampil di terminal backend.",
      "BOOTSTRAP_CODE_INVALID",
      403
    );
  }

  const username = normalizeUsername(payload.username || "admin");
  const displayName = normalizeText(payload.displayName || "Administrator Lokal");
  const password = String(payload.password || "");

  assertValidUsername(username);
  assertPasswordStrength(password);
  await assertUsernameAvailable(db, username);

  const result = await db.run(
    `
      INSERT INTO users (username, username_lower, display_name, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'administrator', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [username, username, displayName, createPasswordHash(password)]
  );

  const user = await db.get("SELECT * FROM users WHERE id = ?", [result.lastID]);

  await createAuditLog({
    module: "auth",
    action: "bootstrap_admin_create",
    entityType: "user",
    entityId: result.lastID,
    description: "Administrator lokal pertama dibuat",
    metadata: { username, role: "administrator" },
  });

  return toSafeUser(user);
}

async function login(payload = {}, requestMeta = {}) {
  const db = await getDb();
  const username = normalizeUsername(payload.username);
  const password = String(payload.password || "");

  assertValidUsername(username);

  const user = await db.get("SELECT * FROM users WHERE username_lower = ?", [username]);
  if (!user || !verifyPasswordHash(password, user.password_hash)) {
    throw createAuthError("Username atau password lokal salah.", "INVALID_CREDENTIALS", 401);
  }

  if (user.status !== "active") {
    throw createAuthError("User lokal tidak aktif.", "USER_INACTIVE", 403);
  }

  const session = await createSession(db, user, requestMeta);
  await db.run(
    "UPDATE users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [user.id]
  );

  await createAuditLog({
    module: "auth",
    action: "login",
    entityType: "user",
    entityId: user.id,
    actor: user.username,
    description: "Login lokal berhasil",
    metadata: { username: user.username, role: user.role },
  });

  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: toSafeUser(user),
  };
}

async function logout({ sessionId, user } = {}) {
  const db = await getDb();
  await db.run(
    "UPDATE local_user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?",
    [sessionId]
  );

  await createAuditLog({
    module: "auth",
    action: "logout",
    entityType: "user",
    entityId: user.id,
    actor: user.username,
    description: "Logout lokal berhasil",
    metadata: { username: user.username },
  });

  return { loggedOut: true };
}

async function listUsers() {
  const db = await getDb();
  const rows = await db.all("SELECT * FROM users ORDER BY role ASC, username ASC LIMIT 200");
  return rows.map(toSafeUser);
}

async function createUser(payload = {}, actorUser = {}) {
  const db = await getDb();
  const username = normalizeUsername(payload.username);
  const displayName = normalizeText(payload.displayName || username);
  const role = normalizeText(payload.role || "user");
  const status = normalizeText(payload.status || "active");
  const password = String(payload.password || "");

  assertValidUsername(username);
  assertValidRole(role);
  assertValidStatus(status);
  assertPasswordStrength(password);
  await assertUsernameAvailable(db, username);

  const result = await db.run(
    `
      INSERT INTO users (username, username_lower, display_name, password_hash, role, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [username, username, displayName, createPasswordHash(password), role, status]
  );

  const user = await db.get("SELECT * FROM users WHERE id = ?", [result.lastID]);

  await createAuditLog({
    module: "auth",
    action: "user_create",
    entityType: "user",
    entityId: user.id,
    actor: actorUser.username,
    description: `User lokal ${username} dibuat`,
    metadata: { username, role, status },
  });

  return toSafeUser(user);
}

async function updateUser(userId, payload = {}, actorUser = {}) {
  const db = await getDb();
  const current = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
  if (!current) throw createAuthError("User lokal tidak ditemukan.", "NOT_FOUND", 404);

  const username = normalizeUsername(payload.username || current.username);
  const displayName = normalizeText(payload.displayName || current.display_name || username);
  const role = normalizeText(payload.role || current.role);
  const status = normalizeText(payload.status || current.status);
  const password = String(payload.password || "");

  assertValidUsername(username);
  assertValidRole(role);
  assertValidStatus(status);
  await assertUsernameAvailable(db, username, current.id);

  const isSelfUpdate = Number(actorUser.id) === Number(current.id);
  const roleOrStatusChanged = role !== current.role || status !== current.status;
  if (isSelfUpdate && roleOrStatusChanged) {
    throw createAuthError(
      "User aktif tidak boleh mengubah role/status akunnya sendiri.",
      "SELF_UPDATE_BLOCKED"
    );
  }

  await assertNotLastActiveAdministrator(db, current.id, role, status);

  let passwordHash = current.password_hash;
  if (password) {
    assertPasswordStrength(password);
    passwordHash = createPasswordHash(password);
  }

  await db.run(
    `
      UPDATE users
      SET username = ?, username_lower = ?, display_name = ?, password_hash = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [username, username, displayName, passwordHash, role, status, current.id]
  );

  if (status !== "active") {
    await db.run(
      "UPDATE local_user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
      [current.id]
    );
  }

  const updated = await db.get("SELECT * FROM users WHERE id = ?", [current.id]);

  await createAuditLog({
    module: "auth",
    action: "user_update",
    entityType: "user",
    entityId: current.id,
    actor: actorUser.username,
    description: `User lokal ${username} diubah`,
    metadata: { username, role, status, passwordChanged: Boolean(password) },
  });

  return toSafeUser(updated);
}

async function deleteUser(userId, actorUser = {}) {
  const db = await getDb();
  const current = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
  if (!current) throw createAuthError("User lokal tidak ditemukan.", "NOT_FOUND", 404);

  await assertNotLastActiveAdministrator(db, current.id, "user", "inactive");

  if (Number(actorUser.id) === Number(current.id)) {
    throw createAuthError("User aktif tidak boleh menghapus akunnya sendiri.", "SELF_DELETE_BLOCKED");
  }

  await db.run(
    "UPDATE local_user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
    [current.id]
  );
  await db.run("DELETE FROM users WHERE id = ?", [current.id]);

  await createAuditLog({
    module: "auth",
    action: "user_delete",
    entityType: "user",
    entityId: current.id,
    actor: actorUser.username,
    description: `User lokal ${current.username} dihapus`,
    metadata: { username: current.username, role: current.role, status: current.status },
  });

  return { id: current.id, deleted: true };
}

module.exports = {
  bootstrapAdmin,
  deleteUser,
  getAuthStatus,
  listUsers,
  login,
  logout,
  createUser,
  toSafeUser,
  updateUser,
};
