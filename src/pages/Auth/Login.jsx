import React, { useEffect, useMemo, useState } from "react";
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
import flanelKarawangLogo from "../../assets/branding/flanel-karawang-logo.png";
import flanelKarawangMark from "../../assets/branding/flanel-karawang-mark.png";
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
// Alasan logic dipakai:
// - menjaga user yang profile internalnya belum valid tetap tertahan di halaman login.
// Status logic:
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
          "Akun sudah valid, tetapi akses aplikasi belum aktif. Hubungi Administrator untuk aktivasi profil.",
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
          "Profil user belum memiliki peran akses yang valid. Hubungi Administrator untuk perbaikan profil.",
      };
    case AUTH_PROFILE_STATUS.ERROR:
      return {
        status: "error",
        title: "Gagal membaca profile",
        description:
          "Aplikasi tidak bisa memverifikasi akses user. Cek koneksi atau hubungi Administrator.",
      };
    default:
      return null;
  }
};

// =========================
// SECTION: Browser Branding — AKTIF / UI ONLY
// Fungsi:
// - memasang title tab dan favicon Flanel pada halaman login.
// Hubungan flow aplikasi:
// - hanya menyentuh metadata browser saat Login dirender; tidak menyentuh AuthContext, route guard, role, atau Firestore.
// Alasan logic dipakai:
// - memenuhi kebutuhan logo tab tanpa mengubah index.html atau dependency baru.
// Status logic:
// - AKTIF untuk branding Login.
// - CLEANUP CANDIDATE: jika nanti ingin title/favicon global seluruh aplikasi, pindahkan ke level App/index.html.
// =========================
const useLoginBrowserBranding = () => {
  useEffect(() => {
    const previousTitle = document.title;
    const faviconSelector = "link[rel~='icon']";
    let faviconElement = document.querySelector(faviconSelector);
    const previousFaviconHref = faviconElement?.getAttribute("href") || "";
    const previousFaviconType = faviconElement?.getAttribute("type") || "";
    const isCreatedFavicon = !faviconElement;

    if (!faviconElement) {
      faviconElement = document.createElement("link");
      faviconElement.setAttribute("rel", "icon");
      document.head.appendChild(faviconElement);
    }

    document.title = "IMS Bunga Flanel | Inventory Management System";
    faviconElement.setAttribute("type", "image/png");
    faviconElement.setAttribute("href", flanelKarawangMark);

    return () => {
      document.title = previousTitle;

      if (isCreatedFavicon) {
        faviconElement?.remove();
        return;
      }

      if (previousFaviconHref) {
        faviconElement?.setAttribute("href", previousFaviconHref);
      }

      if (previousFaviconType) {
        faviconElement?.setAttribute("type", previousFaviconType);
      } else {
        faviconElement?.removeAttribute("type");
      }
    };
  }, []);
};

// =========================
// SECTION: Brand Logo Lockup — AKTIF / UI ONLY
// Fungsi:
// - menampilkan logo resmi Flanel Karawang Industries sebagai focal point utama panel kiri.
// Hubungan flow aplikasi:
// - visual non-interaktif; tidak terhubung ke auth, Firestore, role, route, stok, kas, atau modul bisnis.
// Alasan logic dipakai:
// - menjaga brand tampil clean tanpa membuat teks brand dobel di luar asset logo.
// Status logic:
// - AKTIF untuk branding utama Login.
// =========================
const BrandLogoShowcase = () => (
  <div
    className="ims-login-logo-showcase"
    aria-label="Logo Flanel Karawang Industries"
  >
    <img
      src={flanelKarawangLogo}
      alt="Flanel Karawang Industries"
      className="ims-login-brand-logo"
    />
  </div>
);

// =========================
// SECTION: Brand Motif — AKTIF / UI ONLY
// Fungsi:
// - menambah pemanis pill/dot biru-kuning yang ditempatkan di pinggir panel brand.
// Hubungan flow aplikasi:
// - dekorasi murni; tidak menyentuh input, submit, Firebase Auth, role, route, atau data bisnis.
// Alasan logic dipakai:
// - membuat halaman tidak terlalu polos tanpa memakai garis keras/shape besar yang terlihat seperti bug.
// Status logic:
// - AKTIF untuk visual Login.
// =========================
const BrandMotif = () => (
  <div className="ims-login-brand-motif" aria-hidden="true">
    <span className="ims-login-motif-pill ims-login-motif-pill--blue-one" />
    <span className="ims-login-motif-pill ims-login-motif-pill--yellow-one" />
    <span className="ims-login-motif-pill ims-login-motif-pill--blue-two" />
    <span className="ims-login-motif-pill ims-login-motif-pill--yellow-two" />
    <span className="ims-login-motif-dot ims-login-motif-dot--one" />
    <span className="ims-login-motif-dot ims-login-motif-dot--two" />
    <span className="ims-login-motif-dot ims-login-motif-dot--three" />
    <span className="ims-login-motif-dot ims-login-motif-dot--four" />
    <span className="ims-login-motif-pill ims-login-motif-pill--blue-three" />
    <span className="ims-login-motif-pill ims-login-motif-pill--yellow-three" />
    <span className="ims-login-motif-dot ims-login-motif-dot--five" />
    <span className="ims-login-motif-dot ims-login-motif-dot--six" />
  </div>
);

// =========================
// SECTION: Brand Panel — AKTIF / UI ONLY
// Fungsi:
// - menampilkan badge IMS, logo resmi, motif ringan, dan note internal dalam area kiri.
// Hubungan flow aplikasi:
// - mendampingi form login tanpa mengubah input, submit, Firebase Auth, profile validation, role, atau route.
// Alasan logic dipakai:
// - desain final menekankan logo sebagai focal point dan menghapus headline/deskripsi lama agar lebih clean.
// Status logic:
// - AKTIF untuk halaman Login.
// =========================
const BrandPanel = () => (
  <section className="ims-login-brand-panel">
    <div className="ims-login-badge">Inventory Management System</div>

    <div className="ims-login-brand-stage">
      <BrandMotif />
      <BrandLogoShowcase />
    </div>

    <div className="ims-login-brand-note">
      <span className="ims-login-note-dot" aria-hidden="true" />
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
// Alasan logic dipakai:
// - menjaga redesign tetap scoped di halaman Login tanpa menyentuh AppLayout, Sidebar, Dashboard, atau modul bisnis.
// Status logic:
// - AKTIF untuk login internal IMS.
// =========================
const LoginShell = ({ children, variant = "default" }) => (
  <main className={`ims-login-page ims-login-page--${variant}`}>
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
// Alasan logic dipakai:
// - frontend hanya mengirim credential ke flow auth existing, bukan membuat auth baru.
// Status logic:
// - AKTIF untuk login internal IMS.
// - GUARDED: jangan ubah handleLogin/loginWithUsername/profileStatus/logout tanpa task auth khusus.
// =========================
const Login = () => {
  useLoginBrowserBranding();

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
  // Alasan logic dipakai:
  // - menjaga flow login existing tetap menjadi satu-satunya entry submit credential.
  // Status logic:
  // - AKTIF dan GUARDED.
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
  // Alasan logic dipakai:
  // - blocked state harus bisa dikembalikan ke form login normal tanpa bypass role/profile guard.
  // Status logic:
  // - AKTIF dan GUARDED.
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
        {/* AKTIF / UI ONLY:
            Header form hanya mengubah copy dan hierarchy visual login.
            Tidak terkait submit login, AuthContext, role, route, atau profile gate. */}
        <Space direction="vertical" size={6} className="ims-login-heading">
          <Text className="ims-login-eyebrow">Akses Internal</Text>
          <Title level={3} className="ims-login-title">
            Masuk ke Sistem
          </Title>
          <Text className="ims-login-muted-text">
            Gunakan akun internal yang sudah dibuat di sistem.
          </Text>
        </Space>

        {/* AKTIF / GUARDED:
            Login normal hanya menampilkan copy user-facing, form, dan error login.
            Info teknis internal tidak ditampilkan di DOM tanpa mengubah handleLogin, AuthContext, atau profile gate. */}
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
