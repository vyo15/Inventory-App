import React from "react";
import { Button, Result, Space, Tag, Typography } from "antd";
import { HomeOutlined, LogoutOutlined, SafetyOutlined } from "@ant-design/icons";
import { Link, useLocation } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

const { Text } = Typography;

// =========================
// SECTION: Unauthorized Page — AKTIF / GUARDED
// Fungsi:
// - memberi feedback jelas saat role user tidak boleh membuka route tertentu.
// Hubungan flow aplikasi:
// - dipakai oleh ProtectedRoute agar akses ditolak tidak berubah menjadi white screen.
// Status:
// - AKTIF untuk Fase C/D.
// - GUARDED: halaman ini hanya UX guard; Firestore Rules final tetap diperlukan untuk keamanan data.
// Legacy / cleanup:
// - tidak ada legacy.
// =========================
const Unauthorized = () => {
  const location = useLocation();
  const { logout, profile } = useAuth();

  const blockedPath = location.state?.from || "route yang diminta";
  const displayRole = profile?.role || "role tidak dikenal";

  return (
    <Result
      status="403"
      icon={<SafetyOutlined />}
      title="Akses tidak diizinkan"
      subTitle={
        <Space direction="vertical" size={8}>
          <Text>
            Role kamu tidak memiliki akses ke <b>{blockedPath}</b>.
          </Text>
          <Tag color="orange">Role aktif: {displayRole}</Tag>
          <Text type="secondary">
            Jika menu ini seharusnya bisa diakses, hubungi Administrator untuk
            mengecek access matrix dan profile user.
          </Text>
        </Space>
      }
      extra={[
        <Button key="dashboard" type="primary" icon={<HomeOutlined />}>
          <Link to="/dashboard">Kembali ke Dashboard</Link>
        </Button>,
        <Button key="logout" icon={<LogoutOutlined />} onClick={logout}>
          Logout
        </Button>,
      ]}
    />
  );
};

export default Unauthorized;
