import React, { useMemo, useState } from "react";
import { Button, Space, Tag } from "antd";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import useAuth from "../../../hooks/useAuth";
import { ROLE_LABELS } from "../../../utils/auth/roleAccess";
import "./AppHeader.css";

/* =====================================================
SECTION: Header Greeting + Role Presentation — AKTIF / GUARDED
Fungsi:
- Menyusun sapaan personal dari profile aktif tanpa mengubah source user/session.
- Menyederhanakan identitas kanan header menjadi satu role badge agar tidak dobel dengan nama user.

Dipakai oleh:
- src/components/Layout/Header/AppHeader.jsx di dalam AppLayout.

Alasan perubahan:
- Icon smile pada sapaan diganti icon user yang lebih netral dan profesional; chip user redundant di kanan tetap disederhanakan menjadi role badge.

Catatan cleanup:
- belum ada.

Risiko:
- Jika fallback nama/role diubah sembarangan, header bisa menampilkan identitas kosong atau role mentah yang membingungkan user.
===================================================== */
const normalizeAccountName = (value = "") => {
  return String(value)
    .trim()
    .replace(/@.*$/, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
};

const toTitleCaseName = (value = "") => {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
};

const resolveGreetingName = (profile) => {
  const rawName =
    profile?.displayName || profile?.username || profile?.email || "";
  const normalizedName = normalizeAccountName(rawName);

  if (!normalizedName) {
    return "";
  }

  return toTitleCaseName(normalizedName);
};

const resolveDisplayRole = (profile) => {
  return ROLE_LABELS[profile?.role] || profile?.role || "User";
};

// =========================
// SECTION: App Header Toolbar - AKTIF / GUARDED
// Fungsi:
// - menampilkan sapaan personal, role aktif, dan tombol logout.
// - nama menu/page title tetap berada di content PageHeader agar header global tidak menjadi redundant.
// Hubungan flow aplikasi:
// - header hanya tampil setelah Auth Gate mengizinkan AppLayout terbuka.
// Status:
// - AKTIF untuk layout utama.
// - GUARDED: logout hanya menghapus session, tidak menyentuh stok/kas/transaksi/produksi/laporan.
// =========================
const AppHeader = () => {
  const { logout, profile } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const greetingName = useMemo(() => resolveGreetingName(profile), [profile]);
  const displayRole = useMemo(() => resolveDisplayRole(profile), [profile]);
  const greetingTitle = greetingName ? `Halo, ${greetingName}!` : "Halo!";

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="app-header-content">
      <div className="app-header-left" aria-label="Sapaan pengguna aktif">
        <div className="app-header-greeting">
          <span className="app-header-greeting-icon" aria-hidden="true">
            <UserOutlined />
          </span>

          <div className="app-header-greeting-copy">
            <span className="app-header-greeting-title">{greetingTitle}</span>
            <span className="app-header-greeting-subtitle">
              Pantau operasional hari ini.
            </span>
          </div>
        </div>
      </div>

      <div className="app-header-user-area">
        <Space size={10} className="app-header-user-actions">
          <Tag icon={<UserOutlined />} className="app-header-role-tag">
            <span className="app-header-chip-text">{displayRole}</span>
          </Tag>
          <Button
            className="app-header-logout-button"
            icon={<LogoutOutlined />}
            loading={isLoggingOut}
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default AppHeader;
