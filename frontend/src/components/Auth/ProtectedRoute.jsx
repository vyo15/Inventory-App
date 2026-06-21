import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { canAccessRoute } from "../../utils/auth/roleAccess";
import LogoLoadingScreen from "../Layout/Feedback/LogoLoadingScreen";

// =====================================================
// SECTION: ProtectedRoute Loader — AKTIF / GUARDED
// Fungsi:
// - Menampilkan state aman saat AuthProvider masih mengecek session/profile atau route guard belum siap.
//
// Dipakai oleh:
// - ProtectedRoute sebelum route bisnis dirender.
//
// Alasan perubahan:
// - Visual loader disatukan ke LogoLoadingScreen sebagai UI-only; logic auth, redirect login, unauthorized, dan role access tidak berubah.
//
// Catatan cleanup:
// - belum ada.
//
// Risiko:
// - Jika kondisi pemanggil loader diubah sembarangan, route bisnis bisa tampil sebelum role user valid.
// =====================================================
const ProtectedRouteLoader = () => (
  <LogoLoadingScreen message="Memeriksa akses halaman..." />
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
// Compatibility / cleanup:
// - tidak ada data historis aktif; auth/RBAC layanan lokal tetap menjadi guard data, route guard ini untuk UX dan URL langsung.
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
