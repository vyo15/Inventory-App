import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// =========================
// SECTION: Firebase Config — AKTIF / GUARDED
// Fungsi:
// - menyimpan konfigurasi public Firebase Web App untuk IMS Bunga Flanel.
// Hubungan flow aplikasi:
// - dipakai oleh Firestore dan Firebase Auth foundation.
// Status:
// - AKTIF dipakai di seluruh service/page yang mengakses Firestore.
// - GUARDED: jangan ubah projectId/authDomain tanpa memastikan database production/dev yang benar.
// Legacy / cleanup:
// - tidak ada legacy pada blok ini; config env-based bisa menjadi CLEANUP CANDIDATE terpisah nanti.
// =========================
const firebaseConfig = {
  apiKey: "AIzaSyAGB6rmd80Y-8IARwdv-fGbT6Jtcxww5ik",
  authDomain: "ziyocraft-inventory-app.firebaseapp.com",
  projectId: "ziyocraft-inventory-app",
  storageBucket: "ziyocraft-inventory-app.appspot.com",
  messagingSenderId: "15690184314",
  appId: "1:15690184314:web:78a7c31941da5023a1adc3",
};

// =========================
// SECTION: Firebase App Instance — AKTIF / GUARDED
// Fungsi:
// - membuat satu instance Firebase app yang dipakai bersama oleh Firestore dan Auth.
// Hubungan flow aplikasi:
// - menjadi dasar session login dan semua query database IMS.
// Status:
// - AKTIF dipakai.
// - GUARDED: jangan membuat initializeApp ganda karena bisa memicu error runtime.
// =========================
const app = initializeApp(firebaseConfig);

// =========================
// SECTION: Firestore Database — AKTIF
// Fungsi:
// - koneksi utama ke Cloud Firestore untuk master data, transaksi, stok, produksi, finance, dan laporan.
// Hubungan flow aplikasi:
// - tetap sama seperti flow existing; Fase B Auth tidak mengubah business rules Firestore writer/readers.
// Status:
// - AKTIF dipakai oleh service/page existing.
// =========================
const db = getFirestore(app);

// =========================
// SECTION: Firebase Auth — AKTIF / GUARDED
// Fungsi:
// - pondasi session login internal IMS Bunga Flanel.
// Hubungan flow aplikasi:
// - dipakai AuthProvider untuk login username/password internal melalui Firebase Auth Email/Password.
// Status:
// - AKTIF untuk Fase B Auth Foundation.
// - GUARDED: User Management dan Firestore Rules final belum dibuat pada fase ini.
// Legacy / cleanup:
// - tidak ada password yang disimpan di Firestore; jangan menambah validasi password manual di frontend.
// =========================
const auth = getAuth(app);

export { auth, db };
