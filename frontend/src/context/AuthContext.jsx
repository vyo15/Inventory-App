import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ALL_ROLES, USER_STATUS } from "../utils/auth/roleAccess";

// =========================
// SECTION: Auth Constants — AKTIF / GUARDED
// Fungsi:
// - menyimpan aturan dasar login internal IMS.
// Hubungan flow aplikasi:
// - username user diubah menjadi email internal Firebase Auth agar user tidak perlu memakai email asli.
// Status:
// - AKTIF dipakai oleh login internal IMS.
// - GUARDED: domain internal harus konsisten dengan akun Auth yang dibuat manual di Firebase Console.
// Legacy / cleanup:
// - tidak ada legacy; jika nanti memakai strategi custom token/offline auth, blok ini bisa menjadi CLEANUP CANDIDATE.
// =========================
const INTERNAL_AUTH_DOMAIN = "ziyocraft.com";
const SYSTEM_USERS_COLLECTION = "system_users";
const ACTIVE_STATUS = USER_STATUS.ACTIVE;

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

// =========================
// SECTION: Username Normalizer — AKTIF / GUARDED
// Fungsi:
// - memastikan input username aman dikonversi menjadi identifier email internal Firebase Auth.
// Hubungan flow aplikasi:
// - Login.jsx tetap menampilkan label Username, sedangkan Auth memakai email internal di belakang layar.
// Status:
// - AKTIF dipakai saat login.
// - GUARDED: jangan mengizinkan spasi/karakter bebas karena bisa membuat email internal tidak valid.
// Legacy / cleanup:
// - bukan legacy; bisa diganti saat strategi custom token/offline auth dipilih.
// =========================
export const normalizeInternalUsername = (username = "") => {
  return username.trim().toLowerCase();
};

export const buildInternalAuthEmail = (username = "") => {
  const normalizedUsername = normalizeInternalUsername(username);
  const isValidUsername = /^[a-z0-9._-]+$/.test(normalizedUsername);

  if (!normalizedUsername || !isValidUsername) {
    throw new Error(
      "Username hanya boleh memakai huruf, angka, titik, underscore, atau strip.",
    );
  }

  return `${normalizedUsername}@${INTERNAL_AUTH_DOMAIN}`;
};

// =========================
// SECTION: Auth Provider — AKTIF / GUARDED
// Fungsi:
// - membaca Firebase Auth session;
// - membaca profile user dari Firestore `system_users/{uid}`;
// - menolak akses app utama untuk user tanpa profile, tanpa role valid, atau inactive.
// Hubungan flow aplikasi:
// - App.jsx memakai status dari provider ini untuk menentukan apakah AppLayout boleh tampil.
// Status:
// - AKTIF untuk Auth Foundation dan User Management profile gate.
// - GUARDED: Firestore Rules final wajib selaras dengan role/status di collection ini.
// Legacy / cleanup:
// - tidak menyimpan password di Firestore dan tidak validasi password dari Firestore.
// =========================
export const AuthProvider = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileStatus, setProfileStatus] = useState(
    AUTH_PROFILE_STATUS.SIGNED_OUT,
  );
  const [profileError, setProfileError] = useState(null);

  // =========================
  // SECTION: Load User Profile — AKTIF / GUARDED
  // Fungsi:
  // - mengambil profile role/status user setelah Firebase Auth mengenali session.
  // Hubungan flow aplikasi:
  // - profile wajib ada sebelum app utama dibuka agar user tanpa role tidak langsung masuk.
  // Status:
  // - AKTIF dipakai oleh onAuthStateChanged.
  // - GUARDED: collection `system_users` menjadi sumber profile/role/status untuk AuthProvider dan Manajemen User.
  // =========================
  const loadUserProfile = useCallback(async (currentUser) => {
    if (!currentUser?.uid) {
      setProfile(null);
      setProfileStatus(AUTH_PROFILE_STATUS.SIGNED_OUT);
      return;
    }

    setProfileStatus(AUTH_PROFILE_STATUS.LOADING_PROFILE);
    setProfileError(null);

    try {
      const profileRef = doc(db, SYSTEM_USERS_COLLECTION, currentUser.uid);
      const profileSnapshot = await getDoc(profileRef);

      if (!profileSnapshot.exists()) {
        setProfile(null);
        setProfileStatus(AUTH_PROFILE_STATUS.MISSING_PROFILE);
        return;
      }

      const profileData = {
        id: profileSnapshot.id,
        ...profileSnapshot.data(),
      };

      if (profileData.status !== ACTIVE_STATUS) {
        setProfile(profileData);
        setProfileStatus(AUTH_PROFILE_STATUS.INACTIVE);
        return;
      }

      if (!ALL_ROLES.includes(profileData.role)) {
        setProfile(profileData);
        setProfileStatus(AUTH_PROFILE_STATUS.MISSING_ROLE);
        return;
      }

      setProfile(profileData);
      setProfileStatus(AUTH_PROFILE_STATUS.READY);

      // =========================
      // SECTION: Last Login Audit — AKTIF / BEST EFFORT
      // Fungsi:
      // - mencatat waktu login terakhir untuk audit ringan.
      // Hubungan flow aplikasi:
      // - tidak memengaruhi akses utama; jika update gagal karena rules sementara, login tetap jalan.
      // Status:
      // - AKTIF tetapi best-effort.
      // - GUARDED: jangan jadikan kegagalan lastLoginAt sebagai alasan menolak user valid.
      // =========================
      try {
        await updateDoc(profileRef, {
          lastLoginAt: serverTimestamp(),
        });
      } catch (auditError) {
        console.warn(
          "[Auth] lastLoginAt gagal diperbarui, login tetap dilanjutkan.",
          auditError,
        );
      }
    } catch (error) {
      console.error("[Auth] Gagal membaca profile user.", error);
      setProfile(null);
      setProfileError(error);
      setProfileStatus(AUTH_PROFILE_STATUS.ERROR);
    }
  }, []);

  // =========================
  // SECTION: Firebase Auth Listener — AKTIF / GUARDED
  // Fungsi:
  // - menjaga session tetap terbaca setelah refresh halaman.
  // Hubungan flow aplikasi:
  // - App.jsx menunggu authLoading selesai agar tidak menampilkan Dashboard palsu saat session sedang dicek.
  // Status:
  // - AKTIF dipakai sebagai auth state utama.
  // =========================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setAuthLoading(true);
      setFirebaseUser(currentUser);

      if (!currentUser) {
        setProfile(null);
        setProfileError(null);
        setProfileStatus(AUTH_PROFILE_STATUS.SIGNED_OUT);
        setAuthLoading(false);
        return;
      }

      await loadUserProfile(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [loadUserProfile]);

  // =========================
  // SECTION: Login Action — AKTIF / GUARDED
  // Fungsi:
  // - login memakai username internal + password Firebase Auth.
  // Hubungan flow aplikasi:
  // - user tetap melihat field Username, bukan email asli.
  // Status:
  // - AKTIF untuk login internal IMS.
  // - GUARDED: user Auth dibuat manual di Firebase Console, lalu profile dibuat di Manajemen User memakai Auth UID.
  // =========================
  const loginWithUsername = useCallback(async (username, password) => {
    const internalEmail = buildInternalAuthEmail(username);
    await signInWithEmailAndPassword(auth, internalEmail, password);
  }, []);

  // =========================
  // SECTION: Logout Action — AKTIF
  // Fungsi:
  // - keluar dari session Firebase Auth.
  // Hubungan flow aplikasi:
  // - AppHeader memakai action ini untuk mengembalikan user ke Login.
  // Status:
  // - AKTIF dipakai di header dan halaman Login saat user inactive/no-profile.
  // =========================
  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const isAuthenticated = Boolean(firebaseUser);
  const isAccessReady = isAuthenticated && profileStatus === AUTH_PROFILE_STATUS.READY;

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      activeRole: profile?.role || null,
      authLoading,
      profileStatus,
      profileError,
      isAuthenticated,
      isAccessReady,
      loginWithUsername,
      logout,
      reloadProfile: () => loadUserProfile(auth.currentUser),
    }),
    [
      firebaseUser,
      profile,
      authLoading,
      profileStatus,
      profileError,
      isAuthenticated,
      isAccessReady,
      loginWithUsername,
      logout,
      loadUserProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
