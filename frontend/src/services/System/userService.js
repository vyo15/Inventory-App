import {
  createLocalUser,
  deleteLocalUser,
  listLocalUsers,
  updateLocalUser,
  validateLocalPasswordPolicy,
} from "./localAuthService";
import {
  ROLE_LABELS,
  ROLES,
  USER_STATUS,
  USER_STATUS_LABELS,
  canAccessUserManagement,
  canCreateUserProfile,
  canManageUserProfile,
  canViewUserProfile,
} from "../../utils/auth/roleAccess";

export const USERNAME_ALREADY_USED_ERROR_CODE = "USERNAME_ALREADY_USED";
export const DELETE_PROFILE_PERMISSION_ERROR_CODE = "DELETE_PROFILE_PERMISSION_DENIED";
export const DELETE_PROFILE_NOT_FOUND_ERROR_CODE = "DELETE_PROFILE_NOT_FOUND";
export const DELETE_PROFILE_GUARD_ERROR_CODE = "DELETE_PROFILE_GUARD_REJECTED";

const USERNAME_ALREADY_USED_MESSAGE = "Username sudah dipakai profile user lain.";

export const isUsernameAlreadyUsedError = (error) => Boolean(
  error && (
    error.code === USERNAME_ALREADY_USED_ERROR_CODE ||
    error.errorCode === USERNAME_ALREADY_USED_ERROR_CODE ||
    error.isUsernameAlreadyUsed ||
    error.message === USERNAME_ALREADY_USED_MESSAGE
  )
);

const createGuardError = (message, code = DELETE_PROFILE_PERMISSION_ERROR_CODE) => {
  const error = new Error(message);
  error.code = code;
  error.errorCode = code;
  return error;
};

const normalizeLocalSystemUser = (user = {}) => {
  const role = user.role || ROLES.USER;
  const status = user.status || USER_STATUS.INACTIVE;
  const username = user.username || "";
  const authUid = user.authUid || `local-${user.id}`;

  return {
    id: user.id,
    authUid,
    username,
    usernameLower: user.usernameLower || user.username_lower || String(username).toLowerCase(),
    displayName: user.displayName || user.display_name || username || "User IMS",
    role,
    roleLabel: ROLE_LABELS[role] || role,
    status,
    statusLabel: USER_STATUS_LABELS[status] || status,
    authProvider: user.authProvider || "sqlite_local",
    createdAt: user.createdAt || user.created_at || null,
    updatedAt: user.updatedAt || user.updated_at || null,
    createdBy: user.createdBy || "sqlite_local",
    updatedBy: user.updatedBy || "sqlite_local",
    lastLoginAt: user.lastLoginAt || user.last_login_at || null,
  };
};

const validateUsername = (username) => Boolean(username) && /^[a-z0-9._-]+$/i.test(username);

const normalizeLocalUserPayload = (values = {}) => ({
  username: String(values.username || "").trim(),
  displayName: String(values.displayName || values.username || "").trim(),
  role: values.role || ROLES.USER,
  status: values.status || USER_STATUS.ACTIVE,
  password: values.password ? String(values.password) : undefined,
});

const normalizeLocalUserPatch = (values = {}) => {
  const payload = {};

  if (Object.prototype.hasOwnProperty.call(values, "username")) {
    payload.username = String(values.username || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(values, "displayName")) {
    payload.displayName = String(values.displayName || values.username || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(values, "role")) {
    payload.role = values.role || ROLES.USER;
  }

  if (Object.prototype.hasOwnProperty.call(values, "status")) {
    payload.status = values.status || USER_STATUS.ACTIVE;
  }

  if (values.password) {
    payload.password = String(values.password);
  }

  return payload;
};

const resolveUserId = (userOrId = {}) => {
  if (typeof userOrId === "object" && userOrId !== null) {
    return userOrId.id || userOrId.authUid || "";
  }

  return userOrId;
};

const resolveActorUid = (actorProfile = {}) => (
  actorProfile.authUid || actorProfile.uid || actorProfile.id || ""
);

const assertActorCanAccessUserManagement = (actorProfile = {}) => {
  if (!canAccessUserManagement(actorProfile.role)) {
    throw createGuardError("Role ini tidak boleh membuka Manajemen User.");
  }
};

const assertActorCanCreate = (actorProfile = {}, targetRole = ROLES.USER) => {
  if (!canCreateUserProfile(actorProfile.role, targetRole)) {
    throw createGuardError("Role ini tidak boleh membuat user dengan role tersebut.");
  }
};

const assertActorCanManageTarget = (actorProfile = {}, targetUser = {}) => {
  const targetRole = targetUser.role || ROLES.USER;
  const targetUid = targetUser.authUid || targetUser.id || "";
  const canManage = canManageUserProfile({
    actorRole: actorProfile.role,
    targetRole,
    targetUid,
    actorUid: resolveActorUid(actorProfile),
  });

  if (!canManage) {
    throw createGuardError("Role ini tidak boleh mengubah user target.");
  }
};

const assertUserExists = (userId) => {
  if (!userId) {
    throw createGuardError("User lokal tidak ditemukan.", DELETE_PROFILE_NOT_FOUND_ERROR_CODE);
  }
};

export const normalizeSystemUser = (value = {}) => normalizeLocalSystemUser(
  typeof value.data === "function" ? { id: value.id, ...value.data() } : value
);

export const listSystemUsers = async (actorProfile) => {
  assertActorCanAccessUserManagement(actorProfile);
  return (await listLocalUsers())
    .map(normalizeLocalSystemUser)
    .filter((user) => canViewUserProfile(actorProfile.role, user.role));
};

export const createManualUserProfile = async (values, actorProfile) => {
  const payload = normalizeLocalUserPayload(values);

  assertActorCanCreate(actorProfile, payload.role);

  if (!validateUsername(payload.username)) {
    throw new Error("Username hanya boleh memakai huruf, angka, titik, underscore, atau strip.");
  }

  const passwordError = validateLocalPasswordPolicy(payload.password || "");
  if (passwordError) throw new Error(passwordError);

  return normalizeLocalSystemUser(await createLocalUser(payload));
};

export const updateSystemUserProfile = async (userOrId, values, actorProfile) => {
  const userId = resolveUserId(userOrId);
  assertUserExists(userId);

  const payload = normalizeLocalUserPatch(values);
  const targetUser = typeof userOrId === "object" && userOrId !== null
    ? userOrId
    : { id: userId, role: payload.role || ROLES.USER };

  assertActorCanManageTarget(actorProfile, targetUser);

  if (payload.password) {
    const passwordError = validateLocalPasswordPolicy(payload.password);
    if (passwordError) throw new Error(passwordError);
  } else {
    delete payload.password;
  }

  return normalizeLocalSystemUser(await updateLocalUser(userId, payload));
};

export const deleteSystemUserProfile = async (userOrId, actorProfile) => {
  const userId = resolveUserId(userOrId);
  assertUserExists(userId);

  const targetUser = typeof userOrId === "object" && userOrId !== null
    ? userOrId
    : { id: userId, role: ROLES.USER };

  assertActorCanManageTarget(actorProfile, targetUser);
  return deleteLocalUser(userId);
};

export const updateSystemUserStatus = async (userOrId, status, actorProfile) => (
  updateSystemUserProfile(userOrId, { status }, actorProfile)
);
