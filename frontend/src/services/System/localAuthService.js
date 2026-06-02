import { fetchSqliteJson } from "./sqliteBackendStatusService";

const LOCAL_AUTH_TOKEN_KEY = "ims.sqlite.authToken";
const LOCAL_AUTH_USER_KEY = "ims.sqlite.authUser";

const normalizeAuthMode = (value = "") => {
  const mode = String(value || "").trim().toLowerCase();
  return mode === "firebase" ? "firebase" : "sqlite";
};

export const AUTH_MODE = normalizeAuthMode(import.meta.env.VITE_AUTH_MODE);
export const isSqliteAuthMode = () => AUTH_MODE === "sqlite";

export const validateLocalPasswordPolicy = (password = "") => {
  const value = String(password || "");
  if (value.length < 8) return "Password minimal 8 karakter.";
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Password wajib memakai huruf dan angka.";
  return "";
};

export const getStoredLocalAuthToken = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(LOCAL_AUTH_TOKEN_KEY) || "";
};

const storeLocalAuth = ({ token, user }) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_AUTH_TOKEN_KEY, token || "");
  window.localStorage.setItem(LOCAL_AUTH_USER_KEY, JSON.stringify(user || null));
};

const clearLocalAuth = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LOCAL_AUTH_TOKEN_KEY);
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

const authHeaders = () => {
  const token = getStoredLocalAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const loginWithLocalUsername = async (username, password) => {
  const result = await fetchSqliteJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  const token = result?.data?.token || "";
  const user = result?.data?.user || null;

  if (!token || !user) {
    throw new Error("Login lokal tidak mengembalikan session yang valid.");
  }

  storeLocalAuth({ token, user });
  return { token, user, expiresAt: result?.data?.expiresAt || null };
};

export const getCurrentLocalAuthUser = async () => {
  const token = getStoredLocalAuthToken();
  if (!token) return null;

  try {
    const result = await fetchSqliteJson("/api/auth/me", {
      headers: authHeaders(),
    });
    const user = result?.data?.user || null;
    if (user) storeLocalAuth({ token, user });
    return user;
  } catch (error) {
    clearLocalAuth();
    throw error;
  }
};

export const logoutLocalAuth = async () => {
  const token = getStoredLocalAuthToken();
  try {
    if (token) {
      await fetchSqliteJson("/api/auth/logout", {
        method: "POST",
        headers: authHeaders(),
      });
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
