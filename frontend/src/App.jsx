import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import useAuth from "./hooks/useAuth";
import AppLayout from "./layouts/AppLayout";
import Login from "./pages/Auth/Login";
import LogoLoadingScreen from "./components/Layout/Feedback/LogoLoadingScreen";

// =====================================================
// SECTION: App Loading State — AKTIF / GUARDED
// Fungsi:
// - Menampilkan state aman saat session SQLite lokal dan profile user sedang diverifikasi.
//
// Dipakai oleh:
// - AppContent ketika authLoading aktif sebelum Login/AppLayout dipilih.
//
// Alasan perubahan:
// - Visual loading diganti ke LogoLoadingScreen sebagai UI-only; auth guard, route guard, dan login flow tetap tidak berubah.
//
// Catatan cleanup:
// - belum ada.
//
// Risiko:
// - Jika kondisi authLoading diubah sembarangan, user bisa melihat route bisnis sebelum session siap.
// =====================================================
const AppLoadingScreen = () => <LogoLoadingScreen />;

// =========================
// SECTION: Auth Gate — AKTIF / GUARDED
// Fungsi:
// - menjadi pagar awal agar AppLayout dan semua route bisnis hanya tampil setelah login valid.
// Hubungan flow aplikasi:
// - Fase B hanya membuat proteksi login awal;
// - role/menu guard detail tetap fase berikutnya agar business page tidak ikut tersentuh.
// Status:
// - AKTIF.
// - GUARDED: salah guard bisa membuat seluruh app terkunci, jadi fallback Login tetap jelas.
// Legacy / cleanup:
// - belum ada legacy; ProtectedRoute detail akan menjadi fase C/D.
// =========================
const AppContent = () => {
  const { authLoading, isAccessReady } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return <AppLoadingScreen />;
  }

  if (!isAccessReady) {
    return <Login />;
  }

  if (location.pathname === "/login") {
    return <Navigate to="/dashboard" replace />;
  }

  return <AppLayout />;
};

// =========================
// SECTION: App Root — AKTIF / GUARDED
// Fungsi:
// - membungkus aplikasi dengan AuthProvider.
// Hubungan flow aplikasi:
// - tidak mengubah routing bisnis, hanya menambahkan pondasi session login sebelum layout utama.
// Status:
// - AKTIF untuk Fase B.
// - GUARDED: jangan gabungkan dengan perubahan User Management/role guard final pada fase ini.
// =========================
const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
