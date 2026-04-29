import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
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

// =========================
// SECTION: Create System User HTTP Endpoint — AKTIF / GUARDED
// Fungsi:
// - menyiapkan URL Cloud Function HTTP `createSystemUser` di region us-central1;
// - memakai Firebase ID token dari user login sebagai Authorization Bearer.
// Hubungan flow aplikasi:
// - UserManagement memanggil service ini saat tambah user agar Auth UID dibuat oleh backend trusted;
// - frontend tidak lagi bergantung pada CORS otomatis callable karena environment terbaru masih memblokir preflight.
// Status:
// - AKTIF untuk bug fix createSystemUser CORS.
// - GUARDED: frontend tidak pernah memakai Admin SDK atau membuat Firebase Auth user langsung.
// Legacy / cleanup:
// - flow callable `httpsCallable` menjadi legacy teknis untuk task ini; endpoint HTTP tetap memakai backend trusted.
// =========================
const FUNCTIONS_REGION = "us-central1";

const getCreateSystemUserEndpoint = () => {
  const projectId = auth.app.options.projectId;

  if (!projectId) {
    throw new Error("Firebase projectId tidak ditemukan untuk memanggil createSystemUser.");
  }

  return `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net/createSystemUser`;
};

const getCurrentUserIdToken = async () => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error("Login diperlukan sebelum membuat user baru.");
  }

  // AKTIF/GUARDED: token ini diverifikasi ulang di Cloud Function; jangan ganti dengan role dari local state saja.
  return currentUser.getIdToken();
};

// =========================
// SECTION: HTTP Error Normalizer — AKTIF / GUARDED
// Fungsi:
// - membuat error create user lebih jelas ketika endpoint gagal karena CORS, deploy, region, atau validasi backend;
// - tetap meneruskan pesan validasi backend seperti invalid-argument/already-exists.
// Hubungan flow aplikasi:
// - UserManagement menampilkan error.message dari service ini saat tambah user gagal.
// Status:
// - AKTIF untuk bug fix createSystemUser.
// - GUARDED: helper ini tidak mengubah payload, role, password, atau penulisan Firestore.
// Legacy / cleanup:
// - kandidat cleanup jika nanti observability function sudah punya error mapping global.
// =========================
const normalizeCreateUserHttpError = (error) => {
  const message = error?.message || "";

  if (/cors|failed to fetch|networkerror|load failed|err_failed|unexpected token/i.test(message)) {
    return new Error(
      "Cloud Function createSystemUser gagal dipanggil. Cek deploy function HTTP, public invoker, region us-central1, CORS localhost/production, dan Firebase Functions logs.",
    );
  }

  return new Error(message || "Gagal membuat user Auth dan profile system_users.");
};

const parseCreateSystemUserResponse = async (response) => {
  const responseText = await response.text();
  let body = {};

  try {
    // AKTIF DIPAKAI: response normal dari createSystemUser berbentuk JSON { data } atau { error }.
    // Alasan perubahan: jika IAM/deploy/proxy mengembalikan HTML/non-JSON, error tetap dibuat jelas dan tidak berhenti di SyntaxError.
    // Status: aktif dipakai untuk debugging create user; kandidat cleanup hanya jika sudah ada error mapping global.
    body = responseText ? JSON.parse(responseText) : {};
  } catch (parseError) {
    body = {
      error: {
        message: `Cloud Function createSystemUser mengembalikan response non-JSON (HTTP ${response.status}). Cek deploy, public invoker, region, dan logs.`,
      },
    };
  }

  if (!response.ok) {
    const backendMessage = body?.error?.message || body?.message;
    throw new Error(backendMessage || "Cloud Function createSystemUser mengembalikan error.");
  }

  return body?.data || body;
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
  if (!canAccessUserManagement(actorProfile.role)) {
    throw new Error("Role ini tidak boleh membuka Manajemen User.");
  }
};

const validateUsername = (username) => {
  return Boolean(username) && /^[a-z0-9._-]+$/i.test(username);
};

// =========================
// SECTION: List System Users — AKTIF / GUARDED
// Fungsi:
// - mengambil profile `system_users` untuk halaman Manajemen User.
// Hubungan flow aplikasi:
// - Administrator melihat semua profile yang dikenal sesuai target akses penuh;
// - super_admin legacy dipetakan ke akses Administrator agar data lama tidak langsung terkunci.
// Status:
// - AKTIF untuk User Management.
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
    // AKTIF/GUARDED: role aktif ditampilkan lebih dulu; super_admin hanya legacy/kandidat migration.
    const roleOrder = [ROLES.ADMINISTRATOR, ROLES.USER, ROLES.SUPER_ADMIN];
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
// SECTION: Create System User With Auth — AKTIF / GUARDED
// Fungsi:
// - membuat Firebase Auth user dan profile `system_users/{uid}` lewat Cloud Function trusted.
// Hubungan flow aplikasi:
// - UserManagement mengirim username, displayName, role, status, dan password sementara;
// - Cloud Function memakai Admin SDK untuk membuat Auth UID otomatis;
// - AuthProvider tetap membaca profile `system_users/{uid}` saat user login.
// Status:
// - AKTIF untuk Auth User Creation Phase.
// - GUARDED: password hanya dikirim ke endpoint backend trusted dan tidak disimpan di Firestore.
// Legacy / cleanup:
// - flow lama input manual Auth UID saat create user sudah tidak dipakai oleh form create.
// =========================
export const createSystemUserWithAuth = async (values, actorProfile) => {
  assertActorCanAccessUserManagement(actorProfile);

  const username = String(values.username || "").trim();
  const displayName = String(values.displayName || username).trim();
  const role = values.role;
  const status = values.status || USER_STATUS.ACTIVE;
  const temporaryPassword = String(values.temporaryPassword || "");

  if (!validateUsername(username)) {
    throw new Error("Username wajib diisi dan hanya boleh huruf, angka, titik, underscore, atau strip.");
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

  if (temporaryPassword.length < 6) {
    throw new Error("Password sementara minimal 6 karakter sesuai standar Firebase Auth.");
  }

  try {
    const endpoint = getCreateSystemUserEndpoint();
    const idToken = await getCurrentUserIdToken();

    // AKTIF DIPAKAI: request HTTP eksplisit agar preflight OPTIONS dijawab oleh function. Password hanya lewat payload ini dan tidak disimpan di Firestore.
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        data: {
          username,
          displayName,
          role,
          status,
          temporaryPassword,
        },
      }),
    });

    return parseCreateSystemUserResponse(response);
  } catch (error) {
    throw normalizeCreateUserHttpError(error);
  }
};

// =========================
// SECTION: Update User Profile — AKTIF / GUARDED
// Fungsi:
// - mengubah display name, role aktif, dan status profile internal user;
// - membantu migrasi super_admin legacy ke administrator/user saat profile lama diedit.
// Hubungan flow aplikasi:
// - user inactive akan ditolak oleh AuthProvider saat login/refresh;
// - perubahan ini tidak membuat/menghapus Firebase Auth user.
// Status:
// - AKTIF untuk Manajemen User.
// - GUARDED: tidak ada user yang boleh mengubah role/status dirinya sendiri lewat halaman ini;
// - GUARDED: super_admin legacy tidak boleh ditetapkan ulang sebagai role aktif.
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
// - GUARDED: delete user tidak dibuat untuk mencegah kehilangan audit profile.
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
