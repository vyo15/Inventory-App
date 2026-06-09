import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Result,
  Space,
  Typography,
} from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import flanelKarawangLogo from "../../assets/branding/flanel-karawang-logo.png";
import flanelKarawangLogoWebp from "../../assets/branding/flanel-karawang-logo.webp";
import flanelKarawangMark from "../../assets/branding/flanel-karawang-mark.png";
import useAuth from "../../hooks/useAuth";
import LogoLoadingScreen from "../../components/Layout/Feedback/LogoLoadingScreen";
import { AUTH_PROFILE_STATUS } from "../../context/AuthContext";
import {
  createLocalBootstrapAdmin,
  getLocalAuthStatus,
} from "../../services/System/localAuthService";
import "./Login.css";

const { Text, Title } = Typography;

// Guarded: blocked profile statuses must not enter AppLayout.
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

const BrandLogoShowcase = () => (
  <div
    className="ims-login-logo-showcase"
    aria-label="Logo Flanel Karawang Industries"
  >
    <picture className="ims-login-logo-picture">
      <source srcSet={flanelKarawangLogoWebp} type="image/webp" />
      <img
        src={flanelKarawangLogo}
        alt="Flanel Karawang Industries"
        className="ims-login-brand-logo"
        width="1092"
        height="946"
        decoding="async"
        fetchPriority="high"
      />
    </picture>
  </div>
);

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

const LoginShell = ({ children, variant = "default" }) => (
  <main className={`ims-login-page ims-login-page--${variant}`}>
    <div className="ims-login-layout">
      <BrandPanel />
      <section className="ims-login-form-panel">{children}</section>
    </div>
  </main>
);

// UI-only page shell; submit still delegates to AuthContext/local auth service.
const Login = () => {
  useLoginBrowserBranding();

  const {
    authLoading,
    authMode,
    authUser,
    loginWithUsername,
    logout,
    profileStatus,
  } = useAuth();
  const [form] = Form.useForm();
  const [bootstrapForm] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapStatus, setBootstrapStatus] = useState(null);
  const [bootstrapError, setBootstrapError] = useState("");
  const [loginError, setLoginError] = useState("");

  const blockedAccessMessage = useMemo(
    () => getBlockedAccessMessage(profileStatus),
    [profileStatus],
  );
  const isSqliteAuth = authMode === "sqlite";

  useEffect(() => {
    let disposed = false;

    const loadBootstrapStatus = async () => {
      if (!isSqliteAuth) {
        setBootstrapStatus(null);
        setBootstrapError("");
        return;
      }

      try {
        const status = await getLocalAuthStatus();
        if (!disposed) {
          setBootstrapStatus(status);
          setBootstrapError("");
        }
      } catch (error) {
        console.error("[Login] Gagal membaca status auth lokal.", error);
        if (!disposed) {
          setBootstrapStatus(null);
          setBootstrapError(
            "Layanan lokal belum bisa dibaca. Pastikan layanan aplikasi berjalan sebelum membuat admin pertama.",
          );
        }
      }
    };

    loadBootstrapStatus();

    return () => {
      disposed = true;
    };
  }, [isSqliteAuth]);

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

  const handleBootstrapAdmin = async (values) => {
    setIsBootstrapping(true);
    setBootstrapError("");

    try {
      const payload = {
        username: values.username,
        displayName: values.displayName,
        password: values.password,
        confirmKeyword:
          bootstrapStatus?.bootstrapConfirmKeyword || "CREATE LOCAL ADMIN",
      };

      await createLocalBootstrapAdmin(payload);
      await loginWithUsername(values.username, values.password);
    } catch (error) {
      console.error("[Login] Gagal membuat admin lokal.", error);
      setBootstrapError(error.message || "Gagal membuat administrator pertama.");
    } finally {
      setIsBootstrapping(false);
    }
  };

  const handleLogoutBlockedUser = async () => {
    setLoginError("");
    await logout();
  };

  if (authLoading || profileStatus === AUTH_PROFILE_STATUS.LOADING_PROFILE) {
    return <LogoLoadingScreen message="Memeriksa session dan profile user..." />;
  }

  if (authUser && blockedAccessMessage) {
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

  if (isSqliteAuth && bootstrapStatus?.bootstrapRequired) {
    return (
      <LoginShell>
        <Card className="ims-login-card">
          <Space direction="vertical" size={6} className="ims-login-heading">
            <Text className="ims-login-eyebrow">Setup Database Lokal</Text>
            <Title level={3} className="ims-login-title">
              Buat Administrator Pertama
            </Title>
            <Text className="ims-login-muted-text">
              Database lokal belum punya administrator aktif. Buat akun pertama untuk membuka IMS.
            </Text>
          </Space>

          {bootstrapError ? (
            <Alert
              className="ims-login-error-box"
              type="error"
              showIcon
              message={bootstrapError}
            />
          ) : null}

          <Form
            form={bootstrapForm}
            layout="vertical"
            onFinish={handleBootstrapAdmin}
            requiredMark={false}
            className="ims-login-form"
          >
            <Form.Item
              label="Username Admin"
              name="username"
              initialValue="admin"
              rules={[{ required: true, message: "Username admin wajib diisi." }]}
            >
              <Input
                autoComplete="username"
                prefix={<UserOutlined />}
                placeholder="contoh: admin"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Nama Tampilan"
              name="displayName"
              initialValue="Administrator Lokal"
              rules={[{ required: true, message: "Nama tampilan wajib diisi." }]}
            >
              <Input placeholder="contoh: Administrator Lokal" size="large" />
            </Form.Item>

            <Form.Item
              label="Password Admin"
              name="password"
              rules={[{ required: true, message: "Password admin wajib diisi." }]}
            >
              <Input.Password
                autoComplete="new-password"
                prefix={<LockOutlined />}
                placeholder="Buat password admin"
                size="large"
              />
            </Form.Item>

            <Button
              block
              htmlType="submit"
              loading={isBootstrapping}
              size="large"
              type="primary"
              className="ims-login-submit"
            >
              Buat Admin dan Masuk
            </Button>
          </Form>
        </Card>
      </LoginShell>
    );
  }

  return (
    <LoginShell>
      <Card className="ims-login-card">
        <Space direction="vertical" size={6} className="ims-login-heading">
          <Text className="ims-login-eyebrow">Akses Internal</Text>
          <Title level={3} className="ims-login-title">
            Masuk ke Sistem
          </Title>
          <Text className="ims-login-muted-text">
            Gunakan akun internal yang sudah dibuat di sistem.
          </Text>
        </Space>

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
