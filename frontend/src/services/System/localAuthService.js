import { getPasswordPolicyHint, validatePasswordStrength } from "../../../../shared/passwordPolicy.js";
import {
  clearStoredSqliteAuthToken,
  fetchSqliteJson,
  getStoredSqliteAuthHeaders,
  getStoredSqliteAuthToken,
} from "./sqliteBackendStatusService";

const LOCAL_AUTH_USER_KEY = "ims.sqlite.authUser";

const normalizeAuthMode = () => "sqlite";

export const AUTH_MODE = normalizeAuthMode(import.meta.env.VITE_AUTH_MODE);
export const isSqliteAuthMode = () => AUTH_MODE === "sqlite";

export const validateLocalPasswordPolicy = validatePasswordStrength;
export const getLocalPasswordPolicyHint = getPasswordPolicyHint;
export const getStoredLocalAuthToken = getStoredSqliteAuthToken;

const storeLocalAuthUser = (user) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(user || null));
  clearStoredSqliteAuthToken();
};

const clearLocalAuth = () => {
  if (typeof window === "undefined") return;
  clearStoredSqliteAuthToken();
  window.localStorage.removeItem(LOCAL_AUTH_USER_KEY);
};

export const getStoredLocalAuthUser = () => {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_AUTH_USER_KEY) || "null");
  } catch {
    return null;
  }
};

const authHeaders = () => getStoredSqliteAuthHeaders();

export const loginWithLocalUsername = async (username, password) => {
  const result = await fetchSqliteJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  const user = result?.data?.user || null;
  if (!user) {
    throw new Error("Login lokal tidak mengembalikan session yang valid.");
  }

  storeLocalAuthUser(user);
  return { user, expiresAt: result?.data?.expiresAt || null };
};

export const getCurrentLocalAuthUser = async () => {
  try {
    const result = await fetchSqliteJson("/api/auth/me", {
      headers: authHeaders(),
    });
    const user = result?.data?.user || null;
    if (user) storeLocalAuthUser(user);
    return user;
  } catch (error) {
    clearLocalAuth();
    throw error;
  }
};

export const logoutLocalAuth = async () => {
  try {
    await fetchSqliteJson("/api/auth/logout", {
      method: "POST",
      headers: authHeaders(),
    });
  } catch (error) {
    if (!["UNAUTHENTICATED", "SESSION_EXPIRED"].includes(error?.errorCode)) {
      throw error;
    }
  } finally {
    clearLocalAuth();
  }
};

export const createLocalBootstrapAdmin = async (values = {}) => {
  const result = await fetchSqliteJson("/api/auth/bootstrap-admin", {
    method: "POST",
    body: JSON.stringify(values),
  });
  return result?.data || null;
};

export const getLocalAuthStatus = async () => {
  const result = await fetchSqliteJson("/api/auth/status");
  return result?.data || null;
};

export const listLocalUsers = async () => {
  const result = await fetchSqliteJson("/api/auth/users", {
    headers: authHeaders(),
  });
  return result?.data || [];
};

export const createLocalUser = async (values = {}) => {
  const result = await fetchSqliteJson("/api/auth/users", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(values),
  });
  return result?.data || null;
};

export const updateLocalUser = async (userId, values = {}) => {
  const result = await fetchSqliteJson(`/api/auth/users/${userId}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(values),
  });
  return result?.data || null;
};

export const deleteLocalUser = async (userId) => {
  const result = await fetchSqliteJson(`/api/auth/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return result?.data || null;
};
