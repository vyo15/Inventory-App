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
export const isUsernameAlreadyUsedError = (error) => Boolean(error && (error.code === USERNAME_ALREADY_USED_ERROR_CODE || error.errorCode === USERNAME_ALREADY_USED_ERROR_CODE || error.isUsernameAlreadyUsed || error.message === USERNAME_ALREADY_USED_MESSAGE));
const normalizeLocalSystemUser = (user = {}) => {
  const role = user.role || ROLES.USER;
  const status = user.status || USER_STATUS.INACTIVE;
  const username = user.username || "";
  const authUid = user.authUid || `local-${user.id}`;
  return { id: user.id, authUid, username, usernameLower: user.usernameLower || user.username_lower || String(username).toLowerCase(), displayName: user.displayName || user.display_name || username || "User IMS", role, roleLabel: ROLE_LABELS[role] || role, status, statusLabel: USER_STATUS_LABELS[status] || status, authProvider: user.authProvider || "sqlite_local", createdAt: user.createdAt || user.created_at || null, updatedAt: user.updatedAt || user.updated_at || null, createdBy: user.createdBy || "sqlite_local", updatedBy: user.updatedBy || "sqlite_local", lastLoginAt: user.lastLoginAt || user.last_login_at || null };
};
const validateUsername = (username) => Boolean(username) && /^[a-z0-9._-]+$/i.test(username);
const normalizeLocalUserPayload = (values = {}) => ({ username: String(values.username || "").trim(), displayName: String(values.displayName || values.username || "").trim(), role: values.role || ROLES.USER, status: values.status || USER_STATUS.ACTIVE, password: String(values.password || "") });
const assertActorCanAccessUserManagement = (actorProfile = {}) => { if (!canAccessUserManagement(actorProfile.role)) throw new Error("Role ini tidak boleh membuka Manajemen User."); };
const assertActorCanCreate = (actorProfile = {}) => { if (!canCreateUserProfile(actorProfile.role)) throw new Error("Role ini tidak boleh membuat user."); };
const assertActorCanManage = (actorProfile = {}) => { if (!canManageUserProfile(actorProfile.role)) throw new Error("Role ini tidak boleh mengubah user."); };
export const normalizeSystemUser = (value = {}) => normalizeLocalSystemUser(typeof value.data === "function" ? { id: value.id, ...value.data() } : value);
export const listSystemUsers = async (actorProfile) => { assertActorCanAccessUserManagement(actorProfile); return (await listLocalUsers()).map(normalizeLocalSystemUser).filter((user) => canViewUserProfile(actorProfile.role, user.role)); };
export const createManualUserProfile = async (values, actorProfile) => {
  assertActorCanCreate(actorProfile);
  const payload = normalizeLocalUserPayload(values);
  if (!validateUsername(payload.username)) throw new Error("Username hanya boleh memakai huruf, angka, titik, underscore, atau strip.");
  const passwordError = validateLocalPasswordPolicy(payload.password);
  if (passwordError) throw new Error(passwordError);
  return normalizeLocalSystemUser(await createLocalUser(payload));
};
export const updateSystemUserProfile = async (userId, values, actorProfile) => { assertActorCanManage(actorProfile); return normalizeLocalSystemUser(await updateLocalUser(userId, normalizeLocalUserPayload({ ...values, password: values.password || undefined }))); };
export const deleteSystemUserProfile = async (userId, actorProfile) => { assertActorCanManage(actorProfile); return deleteLocalUser(userId); };
export const updateSystemUserStatus = async (userId, status, actorProfile) => updateSystemUserProfile(userId, { status }, actorProfile);
