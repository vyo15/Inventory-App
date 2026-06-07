import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

// =========================
// SECTION: useAuth Hook — AKTIF / GUARDED
// Fungsi:
// - menyediakan akses terpusat ke session database lokal dan profil role user.
// Hubungan flow aplikasi:
// - dipakai Login, App, dan Header agar tidak ada logic auth duplikat di halaman bisnis.
// Status:
// - AKTIF untuk Fase B Auth Foundation.
// - GUARDED: jangan membaca password/user credential langsung dari UI melalui hook ini.
// Compatibility / cleanup:
// - tidak ada data historis; hook ini menjadi single entry point auth client.
// =========================
const useAuth = () => {
  const contextValue = useContext(AuthContext);

  if (!contextValue) {
    throw new Error("useAuth harus dipakai di dalam AuthProvider.");
  }

  return contextValue;
};

export default useAuth;
