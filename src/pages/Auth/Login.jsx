import React, { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Result,
  Space,
  Spin,
  Typography,
} from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import useAuth from "../../hooks/useAuth";
import { AUTH_PROFILE_STATUS } from "../../context/AuthContext";

const { Text, Title } = Typography;

// =========================
// SECTION: Status Message Mapper — AKTIF / GUARDED
// Fungsi:
// - menerjemahkan status profile auth menjadi pesan yang mudah dipahami user.
// Hubungan flow aplikasi:
// - dipakai ketika user valid Firebase Auth tetapi belum boleh masuk karena profile/role/status belum valid.
// Status:
// - AKTIF untuk login internal IMS.
// - GUARDED: jangan melewatkan user missing profile/inactive ke AppLayout.
// =========================
const getBlockedAccessMessage = (profileStatus) => {
  switch (profileStatus) {
    case AUTH_PROFILE_STATUS.MISSING_PROFILE:
      return {
        status: "warning",
        title: "Akses belum aktif",
        description:
          "Akun Auth sudah valid, tetapi profile internal belum dibuat di system_users. Hubungi super_admin untuk aktivasi manual sementara.",
      };
    case AUTH_PROFILE_STATUS.INACTIVE:
      return {
        status: "error",
        title: "Akun nonaktif",
        description:
          "Akun ini berstatus inactive sehingga tidak boleh masuk ke aplikasi utama.",
      };
    case AUTH_PROFILE_STATUS.MISSING_ROLE:
      return {
        status: "warning",
        title: "Role belum valid",
        description:
          "Profile user belum memiliki role valid: super_admin, administrator, atau user.",
      };
    case AUTH_PROFILE_STATUS.ERROR:
      return {
        status: "error",
        title: "Gagal membaca profile",
        description:
          "Aplikasi tidak bisa memverifikasi profile/role user. Cek koneksi dan Firestore permission.",
      };
    default:
      return null;
  }
};

// =========================
// SECTION: Login Page — AKTIF / GUARDED
// Fungsi:
// - halaman login internal IMS memakai Username + Password.
// Hubungan flow aplikasi:
// - username dikonversi menjadi email internal Firebase Auth di AuthProvider;
// - password tetap divalidasi Firebase Auth, bukan Firestore/frontend manual.
// Status:
// - AKTIF untuk login internal IMS.
// - GUARDED: create Auth user/password masih manual sampai Cloud Functions/Admin SDK dibuat aman.
// Legacy / cleanup:
// - tidak ada legacy; jika nanti custom token dipilih, login action bisa menjadi CLEANUP CANDIDATE.
// =========================
const Login = () => {
  const {
    authLoading,
    firebaseUser,
    loginWithUsername,
    logout,
    profileStatus,
  } = useAuth();
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  const blockedAccessMessage = useMemo(
    () => getBlockedAccessMessage(profileStatus),
    [profileStatus],
  );

  const handleLogin = async (values) => {
    setIsSubmitting(true);
    setLoginError("");

    try {
      await loginWithUsername(values.username, values.password);
    } catch (error) {
      console.error("[Login] Gagal login.", error);
      setLoginError(
        "Username atau password tidak sesuai. Pastikan akun internal sudah dibuat oleh super_admin/administrator.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoutBlockedUser = async () => {
    setLoginError("");
    await logout();
  };

  if (authLoading || profileStatus === AUTH_PROFILE_STATUS.LOADING_PROFILE) {
    return (
      <div style={styles.pageWrap}>
        <Card style={styles.loadingCard}>
          <Space direction="vertical" align="center" size={16} style={{ width: "100%" }}>
            <Spin size="large" />
            <Text>Memeriksa session dan profile user...</Text>
          </Space>
        </Card>
      </div>
    );
  }

  if (firebaseUser && blockedAccessMessage) {
    return (
      <div style={styles.pageWrap}>
        <Card style={styles.card}>
          <Result
            status={blockedAccessMessage.status}
            title={blockedAccessMessage.title}
            subTitle={blockedAccessMessage.description}
            extra={
              <Button type="primary" onClick={handleLogoutBlockedUser}>
                Keluar dari akun ini
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={styles.pageWrap}>
      <Card style={styles.card}>
        <Space direction="vertical" size={4} style={{ width: "100%" }}>
          <Title level={3} style={styles.title}>
            IMS Bunga Flanel
          </Title>
          <Text type="secondary">
            Masuk dengan username internal yang dibuat dari sistem.
          </Text>
        </Space>

        <Alert
          style={styles.infoBox}
          type="info"
          showIcon
          message="Login internal IMS"
          description="Akun Auth tetap dikelola Firebase Authentication. Manajemen User mengelola profile, role, dan status di Firestore system_users; password tidak disimpan di Firestore."
        />

        {loginError ? (
          <Alert
            style={styles.errorBox}
            type="error"
            showIcon
            message={loginError}
          />
        ) : null}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleLogin}
          requiredMark={false}
        >
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: "Username wajib diisi." }]}
          >
            <Input
              autoComplete="username"
              prefix={<UserOutlined />}
              placeholder="contoh: admin"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: "Password wajib diisi." }]}
          >
            <Input.Password
              autoComplete="current-password"
              prefix={<LockOutlined />}
              placeholder="Masukkan password"
              size="large"
            />
          </Form.Item>

          <Button
            block
            htmlType="submit"
            loading={isSubmitting}
            size="large"
            type="primary"
          >
            Masuk
          </Button>
        </Form>
      </Card>
    </div>
  );
};

const styles = {
  pageWrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background:
      "linear-gradient(135deg, rgba(250, 219, 226, 0.36), rgba(245, 245, 245, 0.98))",
  },
  card: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 18,
    boxShadow: "0 18px 48px rgba(15, 23, 42, 0.12)",
  },
  loadingCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    textAlign: "center",
  },
  title: {
    marginBottom: 0,
  },
  infoBox: {
    marginTop: 24,
    marginBottom: 16,
  },
  errorBox: {
    marginBottom: 16,
  },
};

export default Login;
