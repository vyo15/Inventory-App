const crypto = require("crypto");
const { getDb, runInTransaction } = require("../../db/connection");
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
const USER_AVATAR_KEY_PREFIX = "user_avatar:";
const USER_AVATAR_MAX_BYTES = 200 * 1024;
const USER_AVATAR_DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

const getUserAvatarKey = (userId) => `${USER_AVATAR_KEY_PREFIX}${userId}`;

const hasValidImageSignature = (mimeType, buffer) => {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mimeType === "image/webp") {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }

  return false;
};

const normalizeAvatarDataUrl = (value) => {
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw createAuthError("Format foto profil tidak valid.", "USER_AVATAR_INVALID");
  }

  const match = value.match(USER_AVATAR_DATA_URL_PATTERN);
  if (!match) {
    throw createAuthError(
      "Foto profil hanya menerima JPG, PNG, atau WebP.",
      "USER_AVATAR_INVALID",
    );
  }

  const [, mimeType, base64Payload] = match;
  const imageBuffer = Buffer.from(base64Payload, "base64");
  if (!imageBuffer.length || imageBuffer.length > USER_AVATAR_MAX_BYTES) {
    throw createAuthError(
      "Ukuran foto profil setelah diproses maksimal 200 KB.",
      "USER_AVATAR_TOO_LARGE",
    );
  }

  if (!hasValidImageSignature(mimeType, imageBuffer)) {
    throw createAuthError("Isi file foto profil tidak valid.", "USER_AVATAR_INVALID");
  }

  return `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
};

const readUserWithAvatar = (db, userId) => db.get(
  `SELECT u.*, avatar.value AS avatar_data_url
   FROM users u
   LEFT JOIN app_settings avatar ON avatar.key = ?
   WHERE u.id = ?`,
  [getUserAvatarKey(userId), userId],
);

const writeUserAvatar = async (db, userId, avatarDataUrl) => {
  const key = getUserAvatarKey(userId);
  if (!avatarDataUrl) {
    await db.run("DELETE FROM app_settings WHERE key = ?", [key]);
    return;
  }

  await db.run(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = CURRENT_TIMESTAMP`,
    [key, avatarDataUrl],
  );
};

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
  avatarDataUrl: row.avatar_data_url || null,
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
  return runInTransaction(async (db) => {
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
  });
}

async function login(payload = {}, requestMeta = {}) {
  return runInTransaction(async (db) => {
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

  const refreshedUser = await readUserWithAvatar(db, user.id);

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      user: toSafeUser(refreshedUser || user),
    };
  });
}

async function getUserProfile(userId) {
  const db = await getDb();
  const user = await readUserWithAvatar(db, userId);
  if (!user) throw createAuthError("User lokal tidak ditemukan.", "NOT_FOUND", 404);
  return toSafeUser(user);
}

async function recordLegacyBearerMigration({
  sessionId,
  user = {},
  userAgent = "",
  ipAddress = "",
} = {}) {
  if (!sessionId || !user?.id) return null;

  return runInTransaction(async (db) => {
  const existingAudit = await db.get(
    `SELECT id
     FROM audit_logs
     WHERE module = 'auth'
       AND action = 'legacy_bearer_migrated'
       AND entity_type = 'local_user_session'
       AND entity_id = ?
     ORDER BY id ASC
     LIMIT 1`,
    [String(sessionId)],
  );
  if (existingAudit?.id) return existingAudit.id;

    return createAuditLog({
      module: "auth",
      action: "legacy_bearer_migrated",
      entityType: "local_user_session",
      entityId: sessionId,
      actor: user.username || "system",
      description: "Session Bearer legacy dimigrasikan ke cookie HttpOnly.",
      metadata: {
        userId: user.id,
        username: user.username || "",
        userAgent: normalizeText(userAgent),
        ipAddress: normalizeText(ipAddress),
      },
    });
  });
}

async function logout({ sessionId, user } = {}) {
  return runInTransaction(async (db) => {
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
  });
}

async function listUsers() {
  const db = await getDb();
  const rows = await db.all(
    `SELECT u.*, avatar.value AS avatar_data_url
     FROM users u
     LEFT JOIN app_settings avatar ON avatar.key = '${USER_AVATAR_KEY_PREFIX}' || u.id
     ORDER BY u.role ASC, u.username ASC
     LIMIT 200`,
  );
  return rows.map(toSafeUser);
}

async function createUser(payload = {}, actorUser = {}) {
  return runInTransaction(async (db) => {
  const username = normalizeUsername(payload.username);
  const displayName = normalizeText(payload.displayName || username);
  const role = normalizeText(payload.role || "user");
  const status = normalizeText(payload.status || "active");
  const password = String(payload.password || "");
  const avatarDataUrl = Object.prototype.hasOwnProperty.call(payload, "avatarDataUrl")
    ? normalizeAvatarDataUrl(payload.avatarDataUrl)
    : null;

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

  if (avatarDataUrl) await writeUserAvatar(db, result.lastID, avatarDataUrl);
  const user = await readUserWithAvatar(db, result.lastID);

  await createAuditLog({
    module: "auth",
    action: "user_create",
    entityType: "user",
    entityId: user.id,
    actor: actorUser.username,
    description: `User lokal ${username} dibuat`,
    metadata: { username, role, status, avatarAdded: Boolean(avatarDataUrl) },
  });

    return toSafeUser(user);
  });
}

async function updateUser(userId, payload = {}, actorUser = {}) {
  return runInTransaction(async (db) => {
  const current = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
  if (!current) throw createAuthError("User lokal tidak ditemukan.", "NOT_FOUND", 404);

  const username = normalizeUsername(payload.username || current.username);
  const displayName = normalizeText(payload.displayName || current.display_name || username);
  const role = normalizeText(payload.role || current.role);
  const status = normalizeText(payload.status || current.status);
  const password = String(payload.password || "");
  const avatarWasProvided = Object.prototype.hasOwnProperty.call(payload, "avatarDataUrl");
  const avatarDataUrl = avatarWasProvided
    ? normalizeAvatarDataUrl(payload.avatarDataUrl)
    : undefined;

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

  if (avatarWasProvided) {
    await writeUserAvatar(db, current.id, avatarDataUrl);
  }

  if (status !== "active") {
    await db.run(
      "UPDATE local_user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
      [current.id]
    );
  }

  const updated = await readUserWithAvatar(db, current.id);

  await createAuditLog({
    module: "auth",
    action: "user_update",
    entityType: "user",
    entityId: current.id,
    actor: actorUser.username,
    description: `User lokal ${username} diubah`,
    metadata: {
      username,
      role,
      status,
      passwordChanged: Boolean(password),
      avatarChanged: avatarWasProvided,
      avatarRemoved: avatarWasProvided && !avatarDataUrl,
    },
  });

  return toSafeUser(updated);
  });
}

async function deleteUser(userId, actorUser = {}) {
  return runInTransaction(async (db) => {
    const current = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
    if (!current) throw createAuthError("User lokal tidak ditemukan.", "NOT_FOUND", 404);

    await assertNotLastActiveAdministrator(db, current.id, current.role, "inactive");

    if (Number(actorUser.id) === Number(current.id)) {
      throw createAuthError("User aktif tidak boleh menonaktifkan akunnya sendiri.", "SELF_DELETE_BLOCKED");
    }

    await db.run(
      "UPDATE local_user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL",
      [current.id]
    );
    await db.run(
      "UPDATE users SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [current.id]
    );

    await createAuditLog({
      module: "auth",
      action: "user_deactivate",
      entityType: "user",
      entityId: current.id,
      actor: actorUser.username,
      description: `User lokal ${current.username} dinonaktifkan; record dipertahankan untuk histori`,
      metadata: { username: current.username, role: current.role, previousStatus: current.status, status: "inactive" },
    });

    return { id: current.id, deleted: false, softDeleted: true, status: "inactive" };
  });
}

module.exports = {
  bootstrapAdmin,
  deleteUser,
  getAuthStatus,
  getUserProfile,
  listUsers,
  login,
  logout,
  recordLegacyBearerMigration,
  createUser,
  toSafeUser,
  updateUser,
};
