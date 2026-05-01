import React, { useState } from "react";
import { Button, Space, Tag, Typography } from "antd";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import useAuth from "../../../hooks/useAuth";
import { ROLE_LABELS } from "../../../utils/auth/roleAccess";
import "./AppHeader.css";

const { Title, Text } = Typography;

// =========================
// SECTION: App Header - AKTIF / GUARDED
// Fungsi:
// - menampilkan identitas workspace, user aktif, role, dan tombol logout.
// Hubungan flow aplikasi:
// - header hanya tampil setelah Auth Gate mengizinkan AppLayout terbuka.
// Status:
// - AKTIF untuk layout utama.
// - GUARDED: logout hanya menghapus session, tidak menyentuh stok/kas/transaksi/produksi/laporan.
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
      <div className="app-header-left">
        <Title level={3} className="app-header-title">
          IMS Bunga Flanel
        </Title>

        <Text className="app-header-subtitle">
          Kelola stok, transaksi, produksi, dan laporan dalam satu workspace
          yang rapi dan efisien.
        </Text>
      </div>

      <div style={styles.userArea}>
        <Space size={10} wrap>
          <Tag icon={<UserOutlined />} color="blue">
            {displayName}
          </Tag>
          <Tag>{displayRole}</Tag>
          <Button
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

const styles = {
  userArea: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
};

export default AppHeader;
