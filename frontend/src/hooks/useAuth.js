import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

// =========================
// SECTION: useAuth Hook — AKTIF / GUARDED
// Fungsi:
// - menyediakan akses terpusat ke session Firebase Auth dan profile role user.
// Hubungan flow aplikasi:
// - dipakai Login, App, dan Header agar tidak ada logic auth duplikat di halaman bisnis.
// Status:
// - AKTIF untuk Fase B Auth Foundation.
// - GUARDED: jangan membaca password/user credential dari Firestore melalui hook ini.
// Legacy / cleanup:
// - tidak ada legacy; hook ini menjadi single entry point auth client.
// =========================
const useAuth = () => {
  const contextValue = useContext(AuthContext);

  if (!contextValue) {
    throw new Error("useAuth harus dipakai di dalam AuthProvider.");
  }

  return contextValue;
};

export default useAuth;
