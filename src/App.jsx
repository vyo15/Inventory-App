import React from "react";
import { Spin, Typography } from "antd";
import { Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import useAuth from "./hooks/useAuth";
import AppLayout from "./layouts/AppLayout";
import Login from "./pages/Auth/Login";

const { Text } = Typography;

// =========================
// SECTION: App Loading State — AKTIF
// Fungsi:
// - menampilkan state aman saat Firebase Auth dan profile user sedang diverifikasi.
// Hubungan flow aplikasi:
// - mencegah Dashboard/route bisnis tampil sebelum status login selesai dicek.
// Status:
// - AKTIF untuk Fase B Auth Foundation.
// =========================
const AppLoadingScreen = () => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 12,
    }}
  >
    <Spin size="large" />
    <Text type="secondary">Memuat session IMS Bunga Flanel...</Text>
  </div>
);

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
// - GUARDED: jangan gabungkan dengan User Management/Firestore Rules final pada fase ini.
// =========================
const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
