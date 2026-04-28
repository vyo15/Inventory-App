import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  ROLE_LABELS,
  ROLES,
  USER_STATUS,
  USER_STATUS_LABELS,
  canCreateUserProfile,
  canManageUserProfile,
  canViewUserProfile,
  isKnownRole,
  isKnownUserStatus,
} from "../../utils/auth/roleAccess";

const SYSTEM_USERS_COLLECTION = "system_users";

// =========================
// SECTION: System User Normalizer — AKTIF / GUARDED
// Fungsi:
// - merapikan data profile user internal dari Firestore agar aman dipakai tabel/form.
// Hubungan flow aplikasi:
// - profile ini dibaca AuthProvider dan Manajemen User sebagai sumber role/status.
// Status:
// - AKTIF untuk Fase E User Management.
// - GUARDED: password tidak pernah disimpan/dibaca dari Firestore.
// Legacy / cleanup:
// - tidak ada legacy; jika nanti memakai custom claims, profile ini tetap bisa dipakai sebagai data tampilan.
// =========================
export const normalizeSystemUser = (docSnapshot) => {
  const data = docSnapshot.data() || {};
  const role = data.role || ROLES.USER;
  const status = data.status || USER_STATUS.INACTIVE;

  return {
    id: docSnapshot.id,
    authUid: data.authUid || docSnapshot.id,
    username: data.username || "",
    usernameLower: data.usernameLower || String(data.username || "").toLowerCase(),
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

const getActorUid = (actorProfile = {}) => {
  return actorProfile.authUid || actorProfile.id || "unknown_actor";
};

const assertActorCanAccessUserManagement = (actorProfile = {}) => {
  if (![ROLES.SUPER_ADMIN, ROLES.ADMINISTRATOR].includes(actorProfile.role)) {
    throw new Error("Role ini tidak boleh membuka Manajemen User.");
  }
};

// =========================
// SECTION: List System Users — AKTIF / GUARDED
// Fungsi:
// - mengambil profile `system_users` untuk halaman Manajemen User.
// Hubungan flow aplikasi:
// - super_admin melihat semua role;
// - administrator hanya melihat user biasa agar tidak bisa mengubah super_admin/administrator.
// Status:
// - AKTIF untuk Fase E.
// - GUARDED: filtering UI/service ini wajib tetap diselaraskan dengan Firestore Rules.
// =========================
export const listSystemUsers = async (actorProfile) => {
  assertActorCanAccessUserManagement(actorProfile);

  const snapshot = await getDocs(collection(db, SYSTEM_USERS_COLLECTION));
  const normalizedUsers = snapshot.docs
    .map(normalizeSystemUser)
    .filter((userProfile) =>
      canViewUserProfile(actorProfile.role, userProfile.role),
    );

  return normalizedUsers.sort((a, b) => {
    const roleOrder = [ROLES.SUPER_ADMIN, ROLES.ADMINISTRATOR, ROLES.USER];
    const roleDiff = roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);

    if (roleDiff !== 0) {
      return roleDiff;
    }

    return String(a.usernameLower).localeCompare(String(b.usernameLower));
  });
};

// =========================
// SECTION: Create User Profile — AKTIF / GUARDED
// Fungsi:
// - membuat profile internal `system_users/{authUid}` untuk akun Auth yang sudah dibuat/di-seed.
// Hubungan flow aplikasi:
// - Fase E tidak membuat Firebase Auth user dari frontend karena butuh Admin SDK/Cloud Functions;
// - form ini hanya membuat profile role/status agar AuthProvider bisa mengenali akun.
// Status:
// - AKTIF sebagai solusi aman sementara.
// - GUARDED: jangan menambahkan field password di sini.
// Legacy / cleanup:
// - CLEANUP CANDIDATE: saat Cloud Functions create-user sudah tersedia, input manual authUid bisa diganti otomatis.
// =========================
export const createSystemUserProfile = async (values, actorProfile) => {
  assertActorCanAccessUserManagement(actorProfile);

  const authUid = String(values.authUid || "").trim();
  const username = String(values.username || "").trim();
  const usernameLower = username.toLowerCase();
  const displayName = String(values.displayName || username).trim();
  const role = values.role;
  const status = values.status || USER_STATUS.ACTIVE;
  const actorUid = getActorUid(actorProfile);

  if (!authUid) {
    throw new Error("Auth UID wajib diisi sesuai UID dari Firebase Authentication.");
  }

  if (!username || !/^[a-z0-9._-]+$/i.test(username)) {
    throw new Error("Username wajib diisi dan hanya boleh huruf, angka, titik, underscore, atau strip.");
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
    throw new Error("Profile untuk Auth UID ini sudah ada.");
  }

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
  });

  return authUid;
};

// =========================
// SECTION: Update User Profile — AKTIF / GUARDED
// Fungsi:
// - mengubah display name, role, dan status profile internal user.
// Hubungan flow aplikasi:
// - user inactive akan ditolak oleh AuthProvider saat login/refresh;
// - perubahan ini tidak membuat/menghapus Firebase Auth user.
// Status:
// - AKTIF untuk Manajemen User.
// - GUARDED: tidak ada user yang boleh mengubah role/status dirinya sendiri lewat halaman ini.
// =========================
export const updateSystemUserProfile = async (userId, values, actorProfile) => {
  assertActorCanAccessUserManagement(actorProfile);

  const actorUid = getActorUid(actorProfile);
  const userRef = doc(db, SYSTEM_USERS_COLLECTION, userId);
  const currentSnapshot = await getDoc(userRef);

  if (!currentSnapshot.exists()) {
    throw new Error("Profile user tidak ditemukan.");
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
    throw new Error("Role aktif tidak boleh mengelola profile user ini.");
  }

  if (!canCreateUserProfile(actorProfile.role, nextRole)) {
    throw new Error("Role aktif tidak boleh menetapkan role target tersebut.");
  }

  if (!isKnownUserStatus(nextStatus)) {
    throw new Error("Status user tidak valid.");
  }

  await updateDoc(userRef, {
    displayName: String(values.displayName || currentProfile.displayName).trim(),
    role: nextRole,
    status: nextStatus,
    updatedAt: serverTimestamp(),
    updatedBy: actorUid,
  });
};

// =========================
// SECTION: Toggle User Status — AKTIF / GUARDED
// Fungsi:
// - mengaktifkan/nonaktifkan user tanpa menghapus dokumen profile.
// Hubungan flow aplikasi:
// - status inactive akan memblokir akses app utama dari AuthProvider.
// Status:
// - AKTIF.
// - GUARDED: delete user tidak dibuat pada Fase E untuk mencegah kehilangan audit.
// =========================
export const updateSystemUserStatus = async (userProfile, nextStatus, actorProfile) => {
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
