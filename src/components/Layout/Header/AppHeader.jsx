import React, { useState } from "react";
import { Button, Space, Tag } from "antd";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import useAuth from "../../../hooks/useAuth";
import { ROLE_LABELS } from "../../../utils/auth/roleAccess";
import "./AppHeader.css";

// =========================
// SECTION: App Header Toolbar - AKTIF / GUARDED
// Fungsi:
// - menampilkan toolbar atas yang ringan: workspace label, user aktif, role, dan tombol logout.
// - nama menu/page title tidak ditampilkan di top header; title halaman tetap berada di content PageHeader agar tidak terasa mengambang.
// Hubungan flow aplikasi:
// - header hanya tampil setelah Auth Gate mengizinkan AppLayout terbuka.
// Status:
// - AKTIF untuk layout utama.
// - GUARDED: logout hanya menghapus session, tidak menyentuh stok/kas/transaksi/produksi/laporan.
// Alasan logic dipakai:
// - identitas user dan role tetap dihitung dari profile/useAuth; top header fokus sebagai toolbar global, bukan page title.
// IMS NOTE [AKTIF / BEHAVIOR-PRESERVING]: role label mengikuti ROLE_LABELS final administrator/user; role tidak dikenal tetap tampil mentah hanya untuk troubleshooting profile.
// =========================
const AppHeader = () => {
  const { logout, profile } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName = profile?.displayName || profile?.username || "User IMS";
  const displayRole = ROLE_LABELS[profile?.role] || profile?.role || "User";

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
      <div className="app-header-left" aria-label="Workspace operasional">
        <span className="app-header-toolbar-label">Workspace operasional</span>
      </div>

      <div className="app-header-user-area">
        <Space size={10} className="app-header-user-actions">
          <Tag icon={<UserOutlined />} className="app-header-user-tag">
            <span className="app-header-chip-text">{displayName}</span>
          </Tag>
          <Tag className="app-header-role-tag">
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
