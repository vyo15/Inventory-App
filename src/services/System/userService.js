import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  ROLE_LABELS,
  ROLES,
  USER_STATUS,
  USER_STATUS_LABELS,
  canAccessUserManagement,
  canCreateUserProfile,
  canManageUserProfile,
  canViewUserProfile,
  isKnownRole,
  isKnownUserStatus,
} from "../../utils/auth/roleAccess";

const SYSTEM_USERS_COLLECTION = "system_users";
export const USERNAME_ALREADY_USED_ERROR_CODE = "USERNAME_ALREADY_USED";
export const DELETE_PROFILE_PERMISSION_ERROR_CODE =
  "DELETE_PROFILE_PERMISSION_DENIED";
export const DELETE_PROFILE_NOT_FOUND_ERROR_CODE = "DELETE_PROFILE_NOT_FOUND";
export const DELETE_PROFILE_GUARD_ERROR_CODE = "DELETE_PROFILE_GUARD_REJECTED";
const USERNAME_ALREADY_USED_MESSAGE =
  "Username sudah dipakai profile user lain.";
const AUTH_UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

// =========================
// SECTION: User Management Error Helpers — AKTIF / GUARDED
// Fungsi:
// - memberi code error stabil agar UI Manajemen User bisa membedakan guard aplikasi, profile tidak ditemukan, dan permission Firestore Rules.
// Hubungan flow aplikasi:
// - UserManagement menampilkan pesan yang mudah dipahami saat create/update/delete profile gagal.
// Status:
// - AKTIF untuk User Management final setelah cleanup legacy.
// - GUARDED: error code hanya memperjelas failure state, bukan melonggarkan rules.
// =========================
const createUserManagementError = (message, code, originalError = null) => {
  const error = new Error(message);

  error.code = code;
  error.errorCode = code;
  error.originalError = originalError;

  return error;
};

const isFirestorePermissionError = (error = {}) => {
  const code = String(error.code || error.errorCode || "").toLowerCase();
  const errorMessage = String(error.message || "").toLowerCase();

  return (
    code.includes("permission-denied") ||
    code.includes("permission_denied") ||
    errorMessage.includes("permission") ||
    errorMessage.includes("missing or insufficient permissions")
  );
};

const validateAuthUid = (authUid) => {
  return Boolean(authUid) && AUTH_UID_PATTERN.test(authUid);
};

const validateUsername = (username) => {
  return Boolean(username) && /^[a-z0-9._-]+$/i.test(username);
};

const getActorUid = (actorProfile = {}) => {
  return actorProfile.authUid || actorProfile.id || "unknown_actor";
};

const assertActorCanAccessUserManagement = (actorProfile = {}) => {
  if (!canAccessUserManagement(actorProfile.role)) {
    throw new Error("Role ini tidak boleh membuka Manajemen User.");
  }
};

const getProfilesByUsernameLower = async (usernameLower) => {
  const usernameQuery = query(
    collection(db, SYSTEM_USERS_COLLECTION),
    where("usernameLower", "==", usernameLower),
  );
  const usernameSnapshot = await getDocs(usernameQuery);

  return usernameSnapshot.docs.map(normalizeSystemUser);
};

const toSafeDuplicateProfile = (duplicateProfile = {}) => {
  const authUid = duplicateProfile.authUid || duplicateProfile.id || "";
  const username = duplicateProfile.username || "";
  const usernameLower =
    duplicateProfile.usernameLower || String(username).toLowerCase();
  const role = duplicateProfile.role || "";
  const status = duplicateProfile.status || "";

  return {
    id: duplicateProfile.id || authUid,
    authUid,
    username,
    usernameLower,
    displayName: duplicateProfile.displayName || username || "Profile lama",
    role,
    roleLabel: ROLE_LABELS[role] || role,
    status,
    statusLabel: USER_STATUS_LABELS[status] || status,
  };
};

const createUsernameAlreadyUsedError = (duplicateProfile) => {
  // GUARDED:
  // Duplicate username tetap ditolak secara global agar tidak ada dua profile aktif memakai username login yang sama.
  // Setelah cleanup legacy, error ini hanya menjadi guard normal, bukan lagi trigger flow migrasi UID lama.
  const safeDuplicateProfile = toSafeDuplicateProfile(duplicateProfile);
  const error = new Error(USERNAME_ALREADY_USED_MESSAGE);

  error.name = "UsernameAlreadyUsedError";
  error.code = USERNAME_ALREADY_USED_ERROR_CODE;
  error.errorCode = USERNAME_ALREADY_USED_ERROR_CODE;
  error.isUsernameAlreadyUsed = true;
  error.duplicateProfile = safeDuplicateProfile;
  error.details = { duplicateProfile: safeDuplicateProfile };

  return error;
};

export const isUsernameAlreadyUsedError = (error) => {
  return Boolean(
    error &&
    (error.code === USERNAME_ALREADY_USED_ERROR_CODE ||
      error.errorCode === USERNAME_ALREADY_USED_ERROR_CODE ||
      error.isUsernameAlreadyUsed ||
      error.message === USERNAME_ALREADY_USED_MESSAGE),
  );
};

const ensureUsernameIsAvailable = async (usernameLower, authUid) => {
  const duplicateProfile = (
    await getProfilesByUsernameLower(usernameLower)
  ).find((userProfile) => userProfile.authUid !== authUid);

  if (duplicateProfile) {
    throw createUsernameAlreadyUsedError(duplicateProfile);
  }
};

// =========================
// SECTION: System User Normalizer — AKTIF / GUARDED
// Fungsi:
// - merapikan data profile user internal dari Firestore agar aman dipakai tabel/form.
// Hubungan flow aplikasi:
// - profile ini dibaca AuthProvider dan Manajemen User sebagai sumber role/status.
// Status:
// - AKTIF untuk User Management.
// - GUARDED: password tidak pernah disimpan/dibaca dari Firestore.
// Cleanup:
// - role lama/tidak dikenal tidak dianggap valid role aktif dan akan tertolak oleh guard akses.
// =========================
export const normalizeSystemUser = (docSnapshot) => {
  const data = docSnapshot.data() || {};
  const role = data.role || ROLES.USER;
  const status = data.status || USER_STATUS.INACTIVE;

  return {
    id: docSnapshot.id,
    authUid: data.authUid || docSnapshot.id,
    username: data.username || "",
    usernameLower:
      data.usernameLower || String(data.username || "").toLowerCase(),
    displayName: data.displayName || data.username || "User IMS",
    role,
    roleLabel: ROLE_LABELS[role] || role,
    status,
    statusLabel: USER_STATUS_LABELS[status] || status,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    createdBy: data.createdBy || "-",
    updatedBy: data.updatedBy || "-",
    lastLoginAt: data.lastLoginAt || null,
  };
};

// =========================
// SECTION: Last Active Administrator Guard — AKTIF / GUARDED
// Fungsi:
// - mencegah profile administrator aktif terakhir terhapus dari Firestore.
// Hubungan flow aplikasi:
// - AuthProvider butuh minimal satu profile administrator aktif agar Manajemen User tetap bisa memulihkan akses.
// Status:
// - AKTIF untuk delete profile manual.
// - GUARDED: guard ini membaca system_users langsung agar tidak bergantung pada disable button di UI.
// =========================
const assertTargetIsNotLastActiveAdministrator = async (targetProfile) => {
  if (
    targetProfile.role !== ROLES.ADMINISTRATOR ||
    targetProfile.status !== USER_STATUS.ACTIVE
  ) {
    return;
  }

  const snapshot = await getDocs(collection(db, SYSTEM_USERS_COLLECTION));
  const activeAdministratorCount = snapshot.docs
    .map(normalizeSystemUser)
    .filter(
      (userProfile) =>
        userProfile.role === ROLES.ADMINISTRATOR &&
        userProfile.status === USER_STATUS.ACTIVE,
    ).length;

  if (activeAdministratorCount <= 1) {
    throw createUserManagementError(
      "Profile administrator aktif terakhir tidak boleh dihapus.",
      DELETE_PROFILE_GUARD_ERROR_CODE,
    );
  }
};

// =========================
// SECTION: List System Users — AKTIF / GUARDED
// Fungsi:
// - mengambil profile `system_users` untuk halaman Manajemen User.
// Hubungan flow aplikasi:
// - hanya Administrator role aktif yang boleh melihat daftar profile user;
// - data dengan role lama/tidak dikenal tidak ditampilkan agar role nonaktif tidak hidup kembali dari UI.
// Status:
// - AKTIF untuk User Management final.
// - GUARDED: filtering UI/service ini wajib tetap diselaraskan dengan Firestore Rules.
// =========================
export const listSystemUsers = async (actorProfile) => {
  assertActorCanAccessUserManagement(actorProfile);

  const snapshot = await getDocs(collection(db, SYSTEM_USERS_COLLECTION));
  const normalizedUsers = snapshot.docs
    .map(normalizeSystemUser)
    .filter((userProfile) => isKnownRole(userProfile.role))
    .filter((userProfile) =>
      canViewUserProfile(actorProfile.role, userProfile.role),
    );

  return normalizedUsers.sort((a, b) => {
    const roleOrder = [ROLES.ADMINISTRATOR, ROLES.USER];
    const getRoleOrder = (role) => {
      const index = roleOrder.indexOf(role);
      return index === -1 ? roleOrder.length : index;
    };
    const roleDiff = getRoleOrder(a.role) - getRoleOrder(b.role);

    if (roleDiff !== 0) {
      return roleDiff;
    }

    return String(a.usernameLower).localeCompare(String(b.usernameLower));
  });
};

// =========================
// SECTION: Create System User Profile Manual UID — AKTIF / GUARDED
// Fungsi:
// - membuat profile `system_users/{authUid}` berdasarkan UID Firebase Auth yang ditempel manual dari Firebase Console;
// - menyimpan username internal, nama tampilan, role, status, dan audit ringan.
// Hubungan flow aplikasi:
// - Admin membuat Auth user dulu di Firebase Console dengan email `username@ziyocraft.com`;
// - halaman Manajemen User hanya membuat profile Firestore agar AuthProvider bisa membaca role/status saat user login.
// Status:
// - AKTIF untuk flow user management final.
// - GUARDED: frontend tidak membuat password/Auth user dan tidak mematikan duplicate username guard.
// =========================
export const createManualUserProfile = async (values, actorProfile) => {
  assertActorCanAccessUserManagement(actorProfile);

  const actorUid = getActorUid(actorProfile);
  const authUid = String(values.authUid || "").trim();
  const username = String(values.username || "").trim();
  const usernameLower = username.toLowerCase();
  const displayName = String(values.displayName || username).trim();
  const role = values.role;
  const status = values.status || USER_STATUS.ACTIVE;

  if (!validateAuthUid(authUid)) {
    throw new Error(
      "Auth UID wajib diisi dari Firebase Authentication dan hanya boleh huruf, angka, underscore, atau strip.",
    );
  }

  if (!validateUsername(username)) {
    throw new Error(
      "Username wajib diisi dan hanya boleh huruf, angka, titik, underscore, atau strip.",
    );
  }

  if (!displayName) {
    throw new Error("Nama tampilan wajib diisi.");
  }

  if (!isKnownRole(role) || !canCreateUserProfile(actorProfile.role, role)) {
    throw new Error("Role target tidak boleh dibuat oleh role aktif.");
  }

  if (!isKnownUserStatus(status)) {
    throw new Error("Status user tidak valid.");
  }

  const userRef = doc(db, SYSTEM_USERS_COLLECTION, authUid);
  const existingProfile = await getDoc(userRef);

  if (existingProfile.exists()) {
    throw new Error("Auth UID ini sudah punya profile system_users.");
  }

  await ensureUsernameIsAvailable(usernameLower, authUid);

  try {
    await setDoc(userRef, {
      authUid,
      username,
      usernameLower,
      displayName,
      role,
      status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actorUid,
      updatedBy: actorUid,
      lastLoginAt: null,
    });
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      throw createUserManagementError(
        "Permission Firestore menolak create profile. Cek rules system_users agar Administrator boleh membuat profile.",
        DELETE_PROFILE_PERMISSION_ERROR_CODE,
        error,
      );
    }

    throw error;
  }
};

// =========================
// SECTION: Update User Profile — AKTIF / GUARDED
// Fungsi:
// - mengubah display name, role aktif, dan status profile internal user.
// Hubungan flow aplikasi:
// - user inactive akan ditolak oleh AuthProvider saat login/refresh;
// - perubahan ini tidak membuat/menghapus Firebase Auth user.
// Status:
// - AKTIF untuk Manajemen User final.
// - GUARDED: tidak ada user yang boleh mengubah role/status dirinya sendiri lewat halaman ini.
// =========================
export const updateSystemUserProfile = async (userId, values, actorProfile) => {
  assertActorCanAccessUserManagement(actorProfile);

  const actorUid = getActorUid(actorProfile);
  const userRef = doc(db, SYSTEM_USERS_COLLECTION, userId);
  const currentSnapshot = await getDoc(userRef);

  if (!currentSnapshot.exists()) {
    throw createUserManagementError(
      "Profile user tidak ditemukan atau sudah terhapus. Refresh daftar user.",
      DELETE_PROFILE_NOT_FOUND_ERROR_CODE,
    );
  }

  const currentProfile = normalizeSystemUser(currentSnapshot);
  const nextRole = values.role || currentProfile.role;
  const nextStatus = values.status || currentProfile.status;

  if (
    !canManageUserProfile({
      actorRole: actorProfile.role,
      targetRole: currentProfile.role,
      targetUid: currentProfile.authUid,
      actorUid,
    })
  ) {
    throw createUserManagementError(
      "Role aktif tidak boleh mengelola profile user ini.",
      DELETE_PROFILE_GUARD_ERROR_CODE,
    );
  }

  if (!canCreateUserProfile(actorProfile.role, nextRole)) {
    throw new Error("Role aktif tidak boleh menetapkan role target tersebut.");
  }

  if (!isKnownUserStatus(nextStatus)) {
    throw new Error("Status user tidak valid.");
  }

  try {
    await updateDoc(userRef, {
      displayName: String(
        values.displayName || currentProfile.displayName,
      ).trim(),
      role: nextRole,
      status: nextStatus,
      updatedAt: serverTimestamp(),
      updatedBy: actorUid,
    });
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      throw createUserManagementError(
        "Permission Firestore menolak update profile. Cek rules system_users agar Administrator boleh update profile.",
        DELETE_PROFILE_PERMISSION_ERROR_CODE,
        error,
      );
    }

    throw error;
  }
};

// =========================
// SECTION: Delete User Profile — AKTIF / GUARDED
// Fungsi:
// - menghapus hanya dokumen profile Firestore `system_users/{uid}`.
// Hubungan flow aplikasi:
// - Firebase Auth user/password tidak ikut dihapus dan tetap harus dikelola dari Firebase Console/backend trusted;
// - jika Auth user masih ada tetapi profile dihapus, AuthProvider akan menolak login karena profile hilang.
// Status:
// - AKTIF untuk cleanup manual profile target aman.
// - GUARDED: ada validasi role actor, target exists, self-delete, role target, dan administrator aktif terakhir.
// =========================
export const deleteSystemUserProfile = async (userId, actorProfile) => {
  if (!canAccessUserManagement(actorProfile?.role)) {
    throw createUserManagementError(
      "Role ini tidak boleh menghapus profile user.",
      DELETE_PROFILE_GUARD_ERROR_CODE,
    );
  }

  const actorUid = getActorUid(actorProfile);
  const targetUid = String(userId || "").trim();

  if (!validateAuthUid(targetUid)) {
    throw createUserManagementError(
      "Auth UID target tidak valid.",
      DELETE_PROFILE_GUARD_ERROR_CODE,
    );
  }

  const userRef = doc(db, SYSTEM_USERS_COLLECTION, targetUid);
  const currentSnapshot = await getDoc(userRef);

  if (!currentSnapshot.exists()) {
    throw createUserManagementError(
      "Profile user tidak ditemukan atau sudah terhapus. Refresh daftar user sebelum cleanup ulang.",
      DELETE_PROFILE_NOT_FOUND_ERROR_CODE,
    );
  }

  const currentProfile = normalizeSystemUser(currentSnapshot);

  if (currentProfile.authUid === actorUid) {
    throw createUserManagementError(
      "Anda tidak boleh menghapus profile yang sedang dipakai login.",
      DELETE_PROFILE_GUARD_ERROR_CODE,
    );
  }

  if (
    !canManageUserProfile({
      actorRole: actorProfile.role,
      targetRole: currentProfile.role,
      targetUid: currentProfile.authUid,
      actorUid,
    })
  ) {
    throw createUserManagementError(
      "Role aktif tidak boleh menghapus profile user ini.",
      DELETE_PROFILE_GUARD_ERROR_CODE,
    );
  }

  await assertTargetIsNotLastActiveAdministrator(currentProfile);

  try {
    await deleteDoc(userRef);

    return {
      deletedAuthUid: targetUid,
      deletedUsername: currentProfile.username,
    };
  } catch (error) {
    if (isFirestorePermissionError(error)) {
      throw createUserManagementError(
        "Permission Firestore menolak delete profile. Cek rules system_users agar Administrator boleh menghapus profile lain yang aman.",
        DELETE_PROFILE_PERMISSION_ERROR_CODE,
        error,
      );
    }

    throw error;
  }
};

// =========================
// SECTION: Toggle User Status — AKTIF / GUARDED
// Fungsi:
// - mengaktifkan/nonaktifkan user tanpa menghapus dokumen profile.
// Hubungan flow aplikasi:
// - status inactive akan memblokir akses app utama dari AuthProvider.
// Status:
// - AKTIF.
// - GUARDED: delete profile dipisah dari toggle status dan tetap tidak menghapus Firebase Auth user.
// =========================
export const updateSystemUserStatus = async (
  userProfile,
  nextStatus,
  actorProfile,
) => {
  return updateSystemUserProfile(
    userProfile.authUid || userProfile.id,
    {
      displayName: userProfile.displayName,
      role: userProfile.role,
      status: nextStatus,
    },
    actorProfile,
  );
};
