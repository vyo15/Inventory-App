import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import {
  getCurrentLocalAuthUser,
  getStoredLocalAuthUser,
  loginWithLocalUsername,
  logoutLocalAuth,
} from "../services/System/localAuthService";
import { ALL_ROLES, USER_STATUS } from "../utils/auth/roleAccess";

const ACTIVE_STATUS = USER_STATUS.ACTIVE;
const LOCAL_AUTH_PROVIDER = "sqlite_local";

export const AUTH_PROFILE_STATUS = {
  SIGNED_OUT: "signed_out",
  LOADING_PROFILE: "loading_profile",
  READY: "ready",
  MISSING_PROFILE: "missing_profile",
  INACTIVE: "inactive",
  MISSING_ROLE: "missing_role",
  ERROR: "error",
};

export const AuthContext = createContext(null);

export const normalizeInternalUsername = (username = "") => username.trim().toLowerCase();
export const buildInternalAuthEmail = (username = "") => `${normalizeInternalUsername(username)}@sqlite.local`;

export const AuthProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState(AUTH_PROFILE_STATUS.SIGNED_OUT);
  const [profileError, setProfileError] = useState(null);

  const applyLocalAuthUser = useCallback((localUser) => {
    if (!localUser) {
      setAuthUser(null);
      setProfile(null);
      setProfileStatus(AUTH_PROFILE_STATUS.SIGNED_OUT);
      return;
    }

    const nextAuthUser = {
      uid: localUser.authUid || `local-${localUser.id}`,
      email: `${localUser.username || "local"}@sqlite.local`,
      providerId: LOCAL_AUTH_PROVIDER,
    };

    setAuthUser(nextAuthUser);
    setProfile(localUser);

    if (localUser.status !== ACTIVE_STATUS) {
      setProfileStatus(AUTH_PROFILE_STATUS.INACTIVE);
      return;
    }

    if (!ALL_ROLES.includes(localUser.role)) {
      setProfileStatus(AUTH_PROFILE_STATUS.MISSING_ROLE);
      return;
    }

    setProfileStatus(AUTH_PROFILE_STATUS.READY);
  }, []);

  const loadLocalAuthProfile = useCallback(async () => {
    setAuthLoading(true);
    setProfileError(null);
    try {
      const cachedUser = getStoredLocalAuthUser();
      if (cachedUser) applyLocalAuthUser(cachedUser);
      const localUser = await getCurrentLocalAuthUser();
      applyLocalAuthUser(localUser);
    } catch (error) {
      setAuthUser(null);
      setProfile(null);
      setProfileError(error);
      setProfileStatus(AUTH_PROFILE_STATUS.SIGNED_OUT);
    } finally {
      setAuthLoading(false);
    }
  }, [applyLocalAuthUser]);

  useEffect(() => {
    loadLocalAuthProfile();
  }, [loadLocalAuthProfile]);

  const loginWithUsername = useCallback(async (username, password) => {
    const result = await loginWithLocalUsername(username, password);
    applyLocalAuthUser(result.user);
  }, [applyLocalAuthUser]);

  const logout = useCallback(async () => {
    await logoutLocalAuth();
    setAuthUser(null);
    setProfile(null);
    setProfileStatus(AUTH_PROFILE_STATUS.SIGNED_OUT);
  }, []);

  const isAuthenticated = Boolean(authUser || profile);
  const isAccessReady = isAuthenticated && profileStatus === AUTH_PROFILE_STATUS.READY;

  const value = useMemo(() => ({
    authUser,
    profile,
    authMode: "sqlite",
    activeRole: profile?.role || null,
    authLoading,
    profileStatus,
    profileError,
    isAuthenticated,
    isAccessReady,
    loginWithUsername,
    logout,
    reloadProfile: loadLocalAuthProfile,
  }), [authUser, profile, authLoading, profileStatus, profileError, isAuthenticated, isAccessReady, loginWithUsername, logout, loadLocalAuthProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
