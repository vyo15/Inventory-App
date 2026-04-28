import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin, Typography } from "antd";
import useAuth from "../../hooks/useAuth";
import { canAccessRoute } from "../../utils/auth/roleAccess";

const { Text } = Typography;

// =========================
// SECTION: ProtectedRoute Loader — AKTIF / GUARDED
// Fungsi:
// - menampilkan state aman saat AuthProvider masih mengecek session/profile.
// Hubungan flow aplikasi:
// - mencegah halaman bisnis tampil sebelum role user valid.
// Status:
// - AKTIF untuk route guard dasar.
// - GUARDED: jangan mengganti loader ini dengan data kosong palsu di halaman bisnis.
// =========================
const ProtectedRouteLoader = () => (
  <div
    style={{
      minHeight: "40vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      gap: 12,
    }}
  >
    <Spin size="large" />
    <Text type="secondary">Memeriksa akses halaman...</Text>
  </div>
);

// =========================
// SECTION: Protected Route — AKTIF / GUARDED
// Fungsi:
// - memastikan route app hanya dibuka oleh user login yang punya role sesuai matrix.
// Hubungan flow aplikasi:
// - App.jsx tetap menjadi login gate utama;
// - ProtectedRoute menjadi guard tambahan agar route sensitif tidak bisa dibuka lewat URL langsung.
// Status:
// - AKTIF untuk Fase C/D.
// - GUARDED: hide menu bukan security; route tetap wajib dicek di sini.
// Legacy / cleanup:
// - tidak ada legacy; jika Firestore Rules final sudah aktif, guard ini tetap dipakai untuk UX.
// =========================
const ProtectedRoute = ({ routeKey, children }) => {
  const location = useLocation();
  const { authLoading, isAuthenticated, isAccessReady, profile } = useAuth();

  if (authLoading) {
    return <ProtectedRouteLoader />;
  }

  if (!isAuthenticated || !isAccessReady) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccessRoute(routeKey, profile?.role)) {
    return (
      <Navigate
        to="/unauthorized"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
};

export default ProtectedRoute;
