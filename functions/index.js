const admin = require("firebase-admin");
const { onRequest, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

// =========================
// SECTION: Firebase Admin Bootstrap - AKTIF / GUARDED
// Fungsi:
// - menginisialisasi Admin SDK hanya di backend trusted Cloud Functions.
// Hubungan flow aplikasi:
// - frontend tidak pernah membawa credential Admin SDK;
// - function ini memakai service account bawaan Firebase saat deploy.
// Status:
// - AKTIF untuk Auth User Creation Phase.
// - GUARDED: jangan pindahkan Admin SDK ke src/frontend.
// Legacy / cleanup:
// - file ini hanya berisi endpoint createSystemUser, tidak mengaktifkan trigger stok legacy.
// =========================
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

const INTERNAL_AUTH_DOMAIN = "ims-bunga-flanel.local";
const SYSTEM_USERS_COLLECTION = "system_users";

const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMINISTRATOR: "administrator",
  USER: "user",
};

const USER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
};

// =========================
// SECTION: HTTP Runtime + CORS Options - AKTIF / GUARDED
// Fungsi:
// - mengunci region dan origin CORS untuk endpoint createSystemUser;
// - menjawab preflight OPTIONS secara manual agar browser localhost tidak diblokir.
// Hubungan flow aplikasi:
// - frontend memanggil endpoint HTTPS ini dengan fetch + Firebase ID token;
// - backend tetap memverifikasi token sebelum membuat Firebase Auth user.
// Status:
// - AKTIF untuk bug fix CORS createSystemUser.
// - GUARDED: endpoint boleh diakses browser, tetapi operasi create tetap wajib lolos Authorization Bearer + profile system_users.
// Legacy / cleanup:
// - sebelumnya memakai callable onCall; endpoint HTTP ini dipakai karena preflight callable masih gagal di environment terbaru.
// =========================
const FUNCTION_REGION = "us-central1";
const HTTP_CORS_ORIGINS = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  "https://ziyocraft-inventory-app.web.app",
  "https://ziyocraft-inventory-app.firebaseapp.com",
  "https://vyo15.github.io",
];
const CORS_ALLOWED_METHODS = "POST, OPTIONS";
const CORS_ALLOWED_HEADERS = "Content-Type, Authorization";
const CORS_MAX_AGE_SECONDS = "3600";

const ACTIVE_CREATABLE_ROLES = [ROLES.ADMINISTRATOR, ROLES.USER];
const LEGACY_COMPATIBLE_ACTOR_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMINISTRATOR];
const ALL_USER_STATUSES = [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE];
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;

const normalizeUsername = (username = "") => String(username).trim().toLowerCase();

const buildInternalAuthEmail = (username) => `${username}@${INTERNAL_AUTH_DOMAIN}`;

const isOriginAllowed = (origin = "") => {
  if (!origin) {
    // AKTIF/GUARDED: request server-to-server/curl tanpa Origin tetap boleh lanjut ke auth guard.
    return true;
  }

  return HTTP_CORS_ORIGINS.some((allowedOrigin) => {
    if (allowedOrigin instanceof RegExp) {
      return allowedOrigin.test(origin);
    }

    return allowedOrigin === origin;
  });
};

const applyCorsHeaders = (req, res) => {
  const origin = req.get("origin") || "";

  // AKTIF DIPAKAI: CORS header untuk localhost dan production. Jangan hapus karena browser butuh preflight OPTIONS.
  if (origin && isOriginAllowed(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
    res.set("Vary", "Origin");
  }

  res.set("Access-Control-Allow-Methods", CORS_ALLOWED_METHODS);
  res.set("Access-Control-Allow-Headers", CORS_ALLOWED_HEADERS);
  res.set("Access-Control-Max-Age", CORS_MAX_AGE_SECONDS);
};

const handleCorsPreflight = (req, res) => {
  const origin = req.get("origin") || "";

  applyCorsHeaders(req, res);

  if (!isOriginAllowed(origin)) {
    // AKTIF/GUARDED: origin tidak dikenal ditolak sebelum masuk business logic.
    res.status(403).json({
      error: {
        code: "origin-not-allowed",
        message: "Origin tidak diizinkan memanggil createSystemUser.",
      },
    });
    return true;
  }

  res.status(204).send("");
  return true;
};

const assertCreatableRole = (role) => {
  if (!ACTIVE_CREATABLE_ROLES.includes(role)) {
    throw new HttpsError(
      "invalid-argument",
      "Role target tidak valid. Role aktif baru hanya administrator atau user.",
    );
  }
};

const assertKnownStatus = (status) => {
  if (!ALL_USER_STATUSES.includes(status)) {
    throw new HttpsError("invalid-argument", "Status user tidak valid.");
  }
};

const canCreateTargetRole = (actorRole, targetRole) => {
  // AKTIF/GUARDED: Administrator adalah role admin utama; super_admin hanya compatibility actor legacy.
  // Legacy / cleanup: super_admin lama boleh menjalankan flow ini agar tidak terkunci, tetapi tidak boleh membuat role super_admin baru.
  if (LEGACY_COMPATIBLE_ACTOR_ROLES.includes(actorRole)) {
    return ACTIVE_CREATABLE_ROLES.includes(targetRole);
  }

  return false;
};

const getBearerTokenFromRequest = (req) => {
  const authorizationHeader = req.get("authorization") || "";
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);

  return match?.[1] || "";
};

// =========================
// SECTION: Actor Guard - AKTIF / GUARDED
// Fungsi:
// - memverifikasi caller sudah login via Firebase ID token;
// - memastikan caller punya profile system_users, status active, dan role yang boleh membuat user;
// - memetakan actor super_admin lama sebagai Administrator legacy agar akun lama tidak terkunci.
// Hubungan flow aplikasi:
// - UI guard di UserManagement bukan security utama;
// - backend tetap mengecek actor dari ID token dan Firestore profile.
// Status:
// - AKTIF sebagai guard utama endpoint createSystemUser.
// =========================
const getAuthorizedActorProfile = async (req) => {
  const idToken = getBearerTokenFromRequest(req);

  if (!idToken) {
    throw new HttpsError("unauthenticated", "Login diperlukan untuk membuat user.");
  }

  let decodedToken;

  try {
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (error) {
    logger.warn("ID token createSystemUser tidak valid.", { error });
    throw new HttpsError("unauthenticated", "Sesi login tidak valid. Silakan login ulang.");
  }

  const actorUid = decodedToken.uid;
  const actorRef = db.collection(SYSTEM_USERS_COLLECTION).doc(actorUid);
  const actorSnapshot = await actorRef.get();

  if (!actorSnapshot.exists) {
    throw new HttpsError("permission-denied", "Profile actor tidak ditemukan di system_users.");
  }

  const actorProfile = {
    authUid: actorSnapshot.id,
    ...actorSnapshot.data(),
  };

  if (actorProfile.status !== USER_STATUS.ACTIVE) {
    throw new HttpsError("permission-denied", "User inactive tidak boleh membuat user baru.");
  }

  if (!LEGACY_COMPATIBLE_ACTOR_ROLES.includes(actorProfile.role)) {
    throw new HttpsError("permission-denied", "Role ini tidak boleh membuat user baru.");
  }

  return actorProfile;
};

// =========================
// SECTION: Payload Parser - AKTIF / GUARDED
// Fungsi:
// - membersihkan dan memvalidasi input create user dari frontend;
// - membatasi role target baru hanya administrator dan user.
// Hubungan flow aplikasi:
// - password sementara hanya diteruskan ke Firebase Auth;
// - field profile yang disimpan tetap terbatas pada system_users.
// Status:
// - AKTIF.
// - GUARDED: jangan menambahkan password/plain secret ke payload profile Firestore.
// =========================
const parseCreateUserPayload = (data = {}) => {
  const rawPayload = data?.data || data || {};
  const username = normalizeUsername(rawPayload.username);
  const displayName = String(rawPayload.displayName || username).trim();
  const role = rawPayload.role;
  const status = rawPayload.status || USER_STATUS.ACTIVE;
  const temporaryPassword = String(rawPayload.temporaryPassword || "");

  if (!username || !USERNAME_PATTERN.test(username)) {
    throw new HttpsError(
      "invalid-argument",
      "Username wajib diisi dan hanya boleh huruf, angka, titik, underscore, atau strip.",
    );
  }

  if (!displayName) {
    throw new HttpsError("invalid-argument", "Nama tampilan wajib diisi.");
  }

  assertCreatableRole(role);
  assertKnownStatus(status);

  if (temporaryPassword.length < 6) {
    throw new HttpsError("invalid-argument", "Password sementara minimal 6 karakter.");
  }

  return {
    username,
    usernameLower: username,
    displayName,
    role,
    status,
    temporaryPassword,
    email: buildInternalAuthEmail(username),
  };
};

const assertUsernameIsAvailable = async (usernameLower) => {
  const existingProfiles = await db
    .collection(SYSTEM_USERS_COLLECTION)
    .where("usernameLower", "==", usernameLower)
    .limit(1)
    .get();

  if (!existingProfiles.empty) {
    throw new HttpsError("already-exists", "Username ini sudah dipakai oleh profile lain.");
  }
};

const mapHttpsErrorToHttpStatus = (code = "internal") => {
  const statusMap = {
    "invalid-argument": 400,
    unauthenticated: 401,
    "permission-denied": 403,
    "not-found": 404,
    "already-exists": 409,
    "failed-precondition": 412,
    unavailable: 503,
    internal: 500,
  };

  return statusMap[code] || 500;
};

const sendJsonError = (res, error) => {
  if (error instanceof HttpsError) {
    res.status(mapHttpsErrorToHttpStatus(error.code)).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  logger.error("createSystemUser gagal tanpa HttpsError.", { error });
  res.status(500).json({
    error: {
      code: "internal",
      message: "Gagal membuat user Auth dan profile.",
    },
  });
};

// =========================
// SECTION: Create System User Core - AKTIF / GUARDED
// Fungsi:
// - membuat Firebase Auth user melalui Admin SDK;
// - memakai UID hasil Auth untuk membuat dokumen system_users/{uid};
// - rollback Auth user jika penulisan profile gagal.
// Hubungan flow aplikasi:
// - dipanggil oleh endpoint HTTP createSystemUser setelah CORS + auth guard lolos;
// - AuthProvider tetap membaca system_users/{uid} saat login.
// Status:
// - AKTIF untuk Auth User Creation Phase.
// - GUARDED: function ini tidak menyentuh stok, sales, purchases, production, payroll, HPP, reports, atau dashboard.
// Legacy / cleanup:
// - tidak membawa trigger stok legacy; jika repo lama punya functions/index.js lain, audit dulu sebelum merge/deploy;
// - super_admin hanya compatibility actor legacy, bukan role target baru.
// =========================
const createSystemUserCore = async (actorProfile, payload) => {
  if (!canCreateTargetRole(actorProfile.role, payload.role)) {
    throw new HttpsError("permission-denied", "Role aktif tidak boleh membuat role target tersebut.");
  }

  await assertUsernameIsAvailable(payload.usernameLower);

  let createdAuthUser = null;

  try {
    createdAuthUser = await auth.createUser({
      email: payload.email,
      password: payload.temporaryPassword,
      displayName: payload.displayName,
      emailVerified: true,
    });

    const authUid = createdAuthUser.uid;
    const profileRef = db.collection(SYSTEM_USERS_COLLECTION).doc(authUid);
    const now = admin.firestore.FieldValue.serverTimestamp();

    await profileRef.create({
      authUid,
      username: payload.username,
      usernameLower: payload.usernameLower,
      displayName: payload.displayName,
      role: payload.role,
      status: payload.status,
      createdAt: now,
      updatedAt: now,
      createdBy: actorProfile.authUid,
      updatedBy: actorProfile.authUid,
      lastLoginAt: null,
    });

    return {
      authUid,
      profile: {
        authUid,
        username: payload.username,
        usernameLower: payload.usernameLower,
        displayName: payload.displayName,
        role: payload.role,
        status: payload.status,
        createdBy: actorProfile.authUid,
        updatedBy: actorProfile.authUid,
      },
    };
  } catch (error) {
    if (createdAuthUser?.uid) {
      try {
        await auth.deleteUser(createdAuthUser.uid);
      } catch (rollbackError) {
        logger.error("Rollback Auth user gagal setelah profile create gagal.", {
          uid: createdAuthUser.uid,
          rollbackError,
        });
      }
    }

    if (error instanceof HttpsError) {
      throw error;
    }

    if (error?.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Username ini sudah punya akun Auth.");
    }

    if (error?.code === 6 || error?.code === "already-exists") {
      throw new HttpsError("already-exists", "Profile user sudah ada.");
    }

    logger.error("createSystemUser gagal.", { error });
    throw new HttpsError("internal", "Gagal membuat user Auth dan profile.");
  }
};

// =========================
// SECTION: Create System User HTTP Endpoint - AKTIF / GUARDED
// Fungsi:
// - endpoint HTTPS bernama createSystemUser dengan CORS runtime option + CORS manual untuk localhost/production;
// - menerima POST JSON dan Authorization Bearer Firebase ID token.
// Hubungan flow aplikasi:
// - UserManagement -> userService.createSystemUserWithAuth() -> fetch endpoint ini;
// - backend tetap membuat Auth UID otomatis dan profile system_users/{uid}.
// Status:
// - AKTIF untuk bug fix tambah user gagal karena preflight CORS.
// - GUARDED: method selain POST/OPTIONS ditolak; password tidak pernah disimpan ke Firestore.
// =========================
exports.createSystemUser = onRequest(
  {
    region: FUNCTION_REGION,
    // AKTIF DIPAKAI: Cloud Functions v2 HTTP default-nya tidak otomatis mengaktifkan CORS.
    // Alasan perubahan: runtime option ini menjadi guard tambahan selain header manual agar preflight localhost/production tidak ditolak sebelum handler berjalan.
    // Status: aktif dipakai; jangan hapus selama frontend memanggil endpoint dari Vite/GitHub Pages/Firebase Hosting.
    cors: HTTP_CORS_ORIGINS,
    invoker: "public",
  },
  async (req, res) => {
    applyCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      handleCorsPreflight(req, res);
      return;
    }

    if (!isOriginAllowed(req.get("origin") || "")) {
      res.status(403).json({
        error: {
          code: "origin-not-allowed",
          message: "Origin tidak diizinkan memanggil createSystemUser.",
        },
      });
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({
        error: {
          code: "method-not-allowed",
          message: "createSystemUser hanya menerima POST.",
        },
      });
      return;
    }

    try {
      const actorProfile = await getAuthorizedActorProfile(req);
      const payload = parseCreateUserPayload(req.body);
      const result = await createSystemUserCore(actorProfile, payload);

      res.status(200).json({ data: result });
    } catch (error) {
      sendJsonError(res, error);
    }
  },
);
