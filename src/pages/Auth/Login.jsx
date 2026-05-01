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
import "./Login.css";

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
          "Akun Auth sudah valid, tetapi profile internal belum dibuat di system_users. Hubungi Administrator untuk aktivasi profile internal.",
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
          "Profile user belum memiliki role valid: administrator atau user. Hubungi Administrator untuk perbaikan profile internal.",
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
// SECTION: Floral Illustration — AKTIF / UI ONLY
// Fungsi:
// - membuat dekorasi bunga ringan dengan CSS murni tanpa asset dan tanpa library baru.
// Hubungan flow aplikasi:
// - hanya visual halaman login; tidak terhubung ke auth, Firestore, role, stok, kas, atau modul bisnis.
// Status:
// - AKTIF untuk identitas visual login IMS Bunga Flanel.
// - SAFE: seluruh class memakai prefix ims-login agar tidak bocor ke halaman lain.
// Legacy / cleanup:
// - bukan legacy; jika kelak ada asset brand resmi, blok ini bisa menjadi kandidat cleanup visual saja.
// =========================
const FloralIllustration = () => (
  <div className="ims-login-flower-stage" aria-hidden="true">
    <div className="ims-login-orbit ims-login-orbit-a" />
    <div className="ims-login-orbit ims-login-orbit-b" />

    <div className="ims-login-flower ims-login-flower-main">
      <span className="ims-login-petal ims-login-petal-top" />
      <span className="ims-login-petal ims-login-petal-right" />
      <span className="ims-login-petal ims-login-petal-bottom" />
      <span className="ims-login-petal ims-login-petal-left" />
      <span className="ims-login-flower-core" />
    </div>

    <div className="ims-login-flower ims-login-flower-small">
      <span className="ims-login-petal ims-login-petal-top" />
      <span className="ims-login-petal ims-login-petal-right" />
      <span className="ims-login-petal ims-login-petal-bottom" />
      <span className="ims-login-petal ims-login-petal-left" />
      <span className="ims-login-flower-core" />
    </div>

    <span className="ims-login-leaf ims-login-leaf-left" />
    <span className="ims-login-leaf ims-login-leaf-right" />
  </div>
);

// =========================
// SECTION: Brand Panel — AKTIF / UI ONLY
// Fungsi:
// - menampilkan identitas IMS Bunga Flanel dan konteks aplikasi internal.
// Hubungan flow aplikasi:
// - mendampingi form login tanpa mengubah input, submit, Firebase Auth, atau profile validation.
// Status:
// - AKTIF untuk halaman login.
// - SAFE: copywriting bersifat branding dan tidak mengubah business rule.
// =========================
const BrandPanel = () => (
  <section className="ims-login-brand-panel">
    <div className="ims-login-badge">Internal Management System</div>

    <Space direction="vertical" size={12} className="ims-login-brand-copy">
      <Title level={1} className="ims-login-brand-title">
        IMS Bunga Flanel
      </Title>
      <Text className="ims-login-brand-description">
        Kelola produksi, stok, pembelian, dan penjualan bunga flanel dalam satu
        ruang kerja yang rapi, hangat, dan terkontrol.
      </Text>
    </Space>

    <FloralIllustration />

    <div className="ims-login-brand-note">
      <span className="ims-login-note-dot" />
      <Text>Login khusus user internal yang sudah dibuat di sistem.</Text>
    </div>
  </section>
);

// =========================
// SECTION: Login Shell — AKTIF / UI ONLY
// Fungsi:
// - wrapper visual halaman login untuk state loading, blocked access, dan form normal.
// Hubungan flow aplikasi:
// - tidak menjalankan logic auth; hanya menyediakan layout agar semua state login konsisten.
// Status:
// - AKTIF untuk login internal IMS.
// - SAFE: wrapper lokal, tidak menyentuh AppLayout/dashboard/sidebar.
// =========================
const LoginShell = ({ children, variant = "default" }) => (
  <main className={`ims-login-page ims-login-page--${variant}`}>
    <div className="ims-login-background-glow ims-login-background-glow-one" />
    <div className="ims-login-background-glow ims-login-background-glow-two" />

    <div className="ims-login-layout">
      <BrandPanel />
      <section className="ims-login-form-panel">{children}</section>
    </div>
  </main>
);

// =========================
// SECTION: Login Page — AKTIF / GUARDED
// Fungsi:
// - halaman login internal IMS memakai Username + Password.
// Hubungan flow aplikasi:
// - username dikonversi menjadi email internal Firebase Auth di AuthProvider;
// - password tetap divalidasi Firebase Auth, bukan Firestore/frontend manual.
// Status:
// - AKTIF untuk login internal IMS.
// - GUARDED: create Auth user/password dikelola manual di Firebase Console; frontend login hanya memakai Firebase Auth.
// Legacy / cleanup:
// - inline style lama sudah dipindah ke Login.css agar styling login lebih mudah dirawat.
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

  // =========================
  // SECTION: Submit Login — AKTIF / GUARDED
  // Fungsi:
  // - meneruskan username dan password ke AuthProvider tanpa mengubah format input.
  // Hubungan flow aplikasi:
  // - AuthProvider tetap bertanggung jawab mengubah username menjadi email internal Firebase Auth.
  // Status:
  // - AKTIF dan tidak diubah business logic-nya pada redesign UI ini.
  // =========================
  const handleLogin = async (values) => {
    setIsSubmitting(true);
    setLoginError("");

    try {
      await loginWithUsername(values.username, values.password);
    } catch (error) {
      console.error("[Login] Gagal login.", error);
      setLoginError(
        "Username atau password tidak sesuai. Pastikan akun internal sudah dibuat oleh Administrator.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================
  // SECTION: Logout Blocked User — AKTIF / GUARDED
  // Fungsi:
  // - mengeluarkan akun Firebase Auth yang valid tetapi profile internalnya belum boleh masuk.
  // Hubungan flow aplikasi:
  // - menjaga user blocked tidak tersangkut di state login dan tidak masuk AppLayout.
  // Status:
  // - AKTIF dan tidak mengubah permission/role/status.
  // =========================
  const handleLogoutBlockedUser = async () => {
    setLoginError("");
    await logout();
  };

  if (authLoading || profileStatus === AUTH_PROFILE_STATUS.LOADING_PROFILE) {
    return (
      <LoginShell variant="loading">
        <Card className="ims-login-card ims-login-card--compact">
          <Space
            direction="vertical"
            align="center"
            size={16}
            className="ims-login-loading-content"
          >
            <Spin size="large" />
            <Text className="ims-login-muted-text">
              Memeriksa session dan profile user...
            </Text>
          </Space>
        </Card>
      </LoginShell>
    );
  }

  if (firebaseUser && blockedAccessMessage) {
    return (
      <LoginShell variant="blocked">
        <Card className="ims-login-card ims-login-card--blocked">
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
      </LoginShell>
    );
  }

  return (
    <LoginShell>
      <Card className="ims-login-card">
        <Space direction="vertical" size={6} className="ims-login-heading">
          <Text className="ims-login-eyebrow">Selamat datang kembali</Text>
          <Title level={3} className="ims-login-title">
            Masuk ke IMS Bunga Flanel
          </Title>
          <Text className="ims-login-muted-text">
            Gunakan username internal yang sudah dibuat dari sistem.
          </Text>
        </Space>

        <Alert
          className="ims-login-info-box"
          type="info"
          showIcon
          message="Login internal IMS"
          description="Akun Auth tetap dikelola Firebase Authentication. Manajemen User mengelola profile, role, dan status di Firestore system_users; password tidak disimpan di Firestore."
        />

        {loginError ? (
          <Alert
            className="ims-login-error-box"
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
          className="ims-login-form"
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
            className="ims-login-submit"
          >
            Masuk
          </Button>
        </Form>
      </Card>
    </LoginShell>
  );
};

export default Login;
