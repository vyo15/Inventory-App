const crypto = require("crypto");
const express = require("express");
const { getDb } = require("../../db/connection");
const { requireLocalAuth, requireLocalAdministrator, hashSessionToken } = require("../../middlewares/localAuth");
const { createAuditLog } = require("../../utils/auditLog");
const { createPasswordHash, validatePasswordStrength, verifyPasswordHash } = require("../../utils/passwordHash");
const { failure, success } = require("../../utils/response");

const router = express.Router();

const ROLES = ["administrator", "user"];
const USER_STATUSES = ["active", "inactive"];
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const BOOTSTRAP_CONFIRM_KEYWORD = "CREATE LOCAL ADMIN";
const SESSION_DURATION_HOURS = 12;

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
    const error = new Error("Username hanya boleh memakai huruf, angka, titik, underscore, atau strip.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
};

const assertValidRole = (role) => {
  if (!ROLES.includes(role)) {
    const error = new Error("Role lokal tidak valid.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
};

const assertValidStatus = (status) => {
  if (!USER_STATUSES.includes(status)) {
    const error = new Error("Status user lokal tidak valid.");
    error.code = "VALIDATION_ERROR";
    throw error;
  }
};

const assertUsernameAvailable = async (db, usernameLower, excludeId = null) => {
  const existing = await db.get(
    "SELECT id FROM users WHERE username_lower = ? AND id != ?",
    [usernameLower, excludeId || 0]
  );
  if (existing) {
    const error = new Error("Username lokal sudah dipakai.");
    error.code = "DUPLICATE_USERNAME";
    throw error;
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
    const error = new Error("Administrator lokal aktif terakhir tidak boleh dinonaktifkan atau diturunkan role-nya.");
    error.code = "LAST_ADMIN_GUARD";
    throw error;
  }
};

const createSession = async (db, user, req) => {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  await db.run(
    `
      INSERT INTO local_user_sessions (user_id, token_hash, user_agent, ip_address, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
    [user.id, tokenHash, req.get("user-agent") || "", req.ip || "", toIsoSqlDate(expiresAt)]
  );

  return { token, expiresAt: toIsoSqlDate(expiresAt) };
};

router.get("/status", async (req, res, next) => {
  try {
    const db = await getDb();
    const [userCount, activeAdminCount, roleCount, sessionCount] = await Promise.all([
      db.get("SELECT COUNT(*) AS count FROM users"),
      db.get("SELECT COUNT(*) AS count FROM users WHERE role = 'administrator' AND status = 'active'"),
      db.get("SELECT COUNT(*) AS count FROM roles"),
      db.get("SELECT COUNT(*) AS count FROM local_user_sessions WHERE revoked_at IS NULL"),
    ]);

    return success(res, "Status auth lokal berhasil dimuat", {
      authProvider: "sqlite_local",
      userCount: userCount?.count || 0,
      activeAdministratorCount: activeAdminCount?.count || 0,
      roleCount: roleCount?.count || 0,
      activeSessionCount: sessionCount?.count || 0,
      bootstrapRequired: (activeAdminCount?.count || 0) === 0,
      bootstrapConfirmKeyword: BOOTSTRAP_CONFIRM_KEYWORD,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/bootstrap-admin", async (req, res, next) => {
  try {
    const db = await getDb();
    const activeAdminCount = await countActiveAdministrators(db);
    if (activeAdminCount > 0) {
      return failure(res, "Bootstrap admin lokal ditolak karena administrator aktif sudah ada.", "BOOTSTRAP_LOCKED", 409);
    }

    const confirmKeyword = normalizeText(req.body?.confirmKeyword);
    if (confirmKeyword !== BOOTSTRAP_CONFIRM_KEYWORD) {
      return failure(res, `Ketik confirmKeyword: ${BOOTSTRAP_CONFIRM_KEYWORD}`, "CONFIRMATION_REQUIRED", 400);
    }

    const username = normalizeUsername(req.body?.username || "admin");
    const displayName = normalizeText(req.body?.displayName || "Administrator Lokal");
    const password = String(req.body?.password || "");
    const passwordError = validatePasswordStrength(password);

    assertValidUsername(username);
    if (passwordError) return failure(res, passwordError, "VALIDATION_ERROR", 400);
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

    return success(res, "Administrator lokal berhasil dibuat", toSafeUser(user), undefined, 201);
  } catch (error) {
    if (["VALIDATION_ERROR", "DUPLICATE_USERNAME"].includes(error?.code)) {
      return failure(res, error.message, error.code, error.code === "DUPLICATE_USERNAME" ? 409 : 400);
    }
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const db = await getDb();
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || "");

    assertValidUsername(username);

    const user = await db.get("SELECT * FROM users WHERE username_lower = ?", [username]);
    if (!user || !verifyPasswordHash(password, user.password_hash)) {
      return failure(res, "Username atau password lokal salah.", "INVALID_CREDENTIALS", 401);
    }

    if (user.status !== "active") {
      return failure(res, "User lokal tidak aktif.", "USER_INACTIVE", 403);
    }

    const session = await createSession(db, user, req);
    await db.run("UPDATE users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);

    await createAuditLog({
      module: "auth",
      action: "login",
      entityType: "user",
      entityId: user.id,
      actor: user.username,
      description: "Login lokal SQLite berhasil",
      metadata: { username: user.username, role: user.role },
    });

    return success(res, "Login lokal berhasil", {
      token: session.token,
      expiresAt: session.expiresAt,
      user: toSafeUser(user),
    });
  } catch (error) {
    if (error?.code === "VALIDATION_ERROR") {
      return failure(res, error.message, "VALIDATION_ERROR", 400);
    }
    return next(error);
  }
});

router.get("/me", requireLocalAuth, async (req, res) => {
  return success(res, "Session lokal aktif", { user: req.localAuth.user });
});

router.post("/logout", requireLocalAuth, async (req, res, next) => {
  try {
    const db = await getDb();
    await db.run(
      "UPDATE local_user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?",
      [req.localAuth.sessionId]
    );

    await createAuditLog({
      module: "auth",
      action: "logout",
      entityType: "user",
      entityId: req.localAuth.user.id,
      actor: req.localAuth.user.username,
      description: "Logout lokal SQLite berhasil",
      metadata: { username: req.localAuth.user.username },
    });

    return success(res, "Logout lokal berhasil", { loggedOut: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/users", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const rows = await db.all("SELECT * FROM users ORDER BY role ASC, username ASC LIMIT 200");
    return success(res, "Daftar user lokal berhasil dimuat", rows.map(toSafeUser));
  } catch (error) {
    return next(error);
  }
});

router.post("/users", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const username = normalizeUsername(req.body?.username);
    const displayName = normalizeText(req.body?.displayName || username);
    const role = normalizeText(req.body?.role || "user");
    const status = normalizeText(req.body?.status || "active");
    const password = String(req.body?.password || "");
    const passwordError = validatePasswordStrength(password);

    assertValidUsername(username);
    assertValidRole(role);
    assertValidStatus(status);
    if (passwordError) return failure(res, passwordError, "VALIDATION_ERROR", 400);
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
      actor: req.localAuth.user.username,
      description: `User lokal ${username} dibuat`,
      metadata: { username, role, status },
    });

    return success(res, "User lokal berhasil dibuat", toSafeUser(user), undefined, 201);
  } catch (error) {
    if (["VALIDATION_ERROR", "DUPLICATE_USERNAME"].includes(error?.code)) {
      return failure(res, error.message, error.code, error.code === "DUPLICATE_USERNAME" ? 409 : 400);
    }
    return next(error);
  }
});

router.put("/users/:id", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const current = await db.get("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (!current) return failure(res, "User lokal tidak ditemukan.", "NOT_FOUND", 404);

    const username = normalizeUsername(req.body?.username || current.username);
    const displayName = normalizeText(req.body?.displayName || current.display_name || username);
    const role = normalizeText(req.body?.role || current.role);
    const status = normalizeText(req.body?.status || current.status);
    const password = String(req.body?.password || "");

    assertValidUsername(username);
    assertValidRole(role);
    assertValidStatus(status);
    await assertUsernameAvailable(db, username, current.id);

    const isSelfUpdate = Number(req.localAuth.user.id) === Number(current.id);
    const roleOrStatusChanged = role !== current.role || status !== current.status;
    if (isSelfUpdate && roleOrStatusChanged) {
      return failure(res, "User aktif tidak boleh mengubah role/status akunnya sendiri.", "SELF_UPDATE_BLOCKED", 400);
    }

    await assertNotLastActiveAdministrator(db, current.id, role, status);

    let passwordHash = current.password_hash;
    if (password) {
      const passwordError = validatePasswordStrength(password);
      if (passwordError) return failure(res, passwordError, "VALIDATION_ERROR", 400);
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
      await db.run("UPDATE local_user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL", [current.id]);
    }

    const updated = await db.get("SELECT * FROM users WHERE id = ?", [current.id]);

    await createAuditLog({
      module: "auth",
      action: "user_update",
      entityType: "user",
      entityId: current.id,
      actor: req.localAuth.user.username,
      description: `User lokal ${username} diubah`,
      metadata: { username, role, status, passwordChanged: Boolean(password) },
    });

    return success(res, "User lokal berhasil diubah", toSafeUser(updated));
  } catch (error) {
    if (["VALIDATION_ERROR", "DUPLICATE_USERNAME", "LAST_ADMIN_GUARD"].includes(error?.code)) {
      return failure(res, error.message, error.code, error.code === "DUPLICATE_USERNAME" ? 409 : 400);
    }
    return next(error);
  }
});


router.delete("/users/:id", requireLocalAuth, requireLocalAdministrator, async (req, res, next) => {
  try {
    const db = await getDb();
    const current = await db.get("SELECT * FROM users WHERE id = ?", [req.params.id]);
    if (!current) return failure(res, "User lokal tidak ditemukan.", "NOT_FOUND", 404);

    await assertNotLastActiveAdministrator(db, current.id, "user", "inactive");

    if (Number(req.localAuth.user.id) === Number(current.id)) {
      return failure(res, "User aktif tidak boleh menghapus akunnya sendiri.", "SELF_DELETE_BLOCKED", 400);
    }

    await db.run("UPDATE local_user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL", [current.id]);
    await db.run("DELETE FROM users WHERE id = ?", [current.id]);

    await createAuditLog({
      module: "auth",
      action: "user_delete",
      entityType: "user",
      entityId: current.id,
      actor: req.localAuth.user.username,
      description: `User lokal ${current.username} dihapus`,
      metadata: { username: current.username, role: current.role, status: current.status },
    });

    return success(res, "User lokal berhasil dihapus", { id: current.id, deleted: true });
  } catch (error) {
    if (["LAST_ADMIN_GUARD"].includes(error?.code)) {
      return failure(res, error.message, error.code, 400);
    }
    return next(error);
  }
});


module.exports = router;
