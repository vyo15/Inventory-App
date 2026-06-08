import React, { useEffect, useMemo, useState } from "react";
import { MenuOutlined } from "@ant-design/icons";
import { App as AntdApp, Button, ConfigProvider, Drawer, Layout } from "antd";
import { useLocation } from "react-router-dom";
import SidebarMenu from "../components/Layout/Sidebar/SidebarMenu";
import SidebarLogo from "../components/Layout/Sidebar/SidebarLogo";
import AppErrorBoundary from "../components/Layout/Feedback/AppErrorBoundary";
import AppHeader from "../components/Layout/Header/AppHeader";
import ThemeToggleButton from "../components/Layout/Header/ThemeToggleButton";
import AppRoutes from "../router/AppRoutes";
import { getAntdTheme } from "../theme/antdTheme";
import { ActionResultModalHost } from "../utils/feedback/actionResultFeedback";
import "../App.css";

const { Header, Sider, Content } = Layout;

// =========================
// SECTION: Constants
// =========================
const THEME_STORAGE_KEY = "ims-bunga-flanel-theme";
const THEME_LIGHT_VALUE = "light";
const THEME_DARK_VALUE = "dark";

const normalizeThemeMode = (themeMode) => {
  return themeMode === THEME_DARK_VALUE ? THEME_DARK_VALUE : THEME_LIGHT_VALUE;
};

const readStoredThemeMode = () => {
  if (typeof window === "undefined") {
    return THEME_LIGHT_VALUE;
  }

  try {
    return normalizeThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return THEME_LIGHT_VALUE;
  }
};

const getInitialThemeMode = () => {
  if (typeof window !== "undefined") {
    const bootstrappedTheme = normalizeThemeMode(window.__IMS_INITIAL_THEME_MODE__);

    if (bootstrappedTheme === THEME_DARK_VALUE) {
      return THEME_DARK_VALUE;
    }
  }

  return readStoredThemeMode();
};

const applyDocumentThemeMode = (themeMode) => {
  if (typeof document === "undefined") {
    return;
  }

  const normalizedThemeMode = normalizeThemeMode(themeMode);
  const rootElement = document.documentElement;
  const bodyElement = document.body;
  const nextThemeClass = normalizedThemeMode === THEME_DARK_VALUE ? "app-theme-dark" : "app-theme-light";
  const staleThemeClass = normalizedThemeMode === THEME_DARK_VALUE ? "app-theme-light" : "app-theme-dark";

  rootElement.classList.remove(staleThemeClass);
  rootElement.classList.add(nextThemeClass);
  rootElement.setAttribute("data-app-theme", normalizedThemeMode);

  if (bodyElement) {
    bodyElement.classList.remove(staleThemeClass);
    bodyElement.classList.add(nextThemeClass);
    bodyElement.setAttribute("data-app-theme", normalizedThemeMode);
  }
};

// =========================
// SECTION: Main App Layout
// =========================
const AppLayout = () => {
  // =========================
  // SECTION: UI State
  // =========================
  const [isDarkTheme, setIsDarkTheme] = useState(() => getInitialThemeMode() === THEME_DARK_VALUE);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const location = useLocation();

  // =========================
  // SECTION: Persist Theme
  // =========================
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDarkTheme ? THEME_DARK_VALUE : THEME_LIGHT_VALUE);
    } catch {
      // Theme persistence is best-effort only. UI state still follows the active React state.
    }
  }, [isDarkTheme]);

  // =========================
  // SECTION: Sync Theme Class To html/body
  // Fungsi:
  // - memastikan portal Ant Design ikut membaca mode aktif
  // - membantu dark mode terlihat menyatu pada dropdown, modal, drawer, dan area global
  // Catatan:
  // - class ini masih dipakai aktif oleh CSS global di index.css dan App.css
  // - class disinkronkan tanpa cleanup unmount agar StrictMode dev tidak membuat flash light/dark palsu
  // =========================
  useEffect(() => {
    applyDocumentThemeMode(isDarkTheme ? THEME_DARK_VALUE : THEME_LIGHT_VALUE);
  }, [isDarkTheme]);

  // =========================
  // SECTION: Close Mobile Sidebar On Navigation
  // Fungsi:
  // - menutup drawer menu HP setelah route berubah agar layar langsung fokus ke halaman tujuan.
  // Catatan:
  // - hanya UI state, tidak mengubah route, role guard, atau config menu.
  // =========================
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  // =========================
  // SECTION: Theme Config
  // =========================
  const antdThemeConfig = useMemo(() => {
    return getAntdTheme(isDarkTheme);
  }, [isDarkTheme]);

  // =========================
  // SECTION: Action Handlers
  // =========================
  const handleToggleTheme = () => {
    setIsDarkTheme((previousTheme) => !previousTheme);
  };

  const handleSidebarCollapse = (nextCollapsedState) => {
    setIsSidebarCollapsed(nextCollapsedState);
  };

  const handleOpenMobileSidebar = () => {
    setIsMobileSidebarOpen(true);
  };

  const handleCloseMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <AntdApp component={false}>
      <div className={`app-shell ${isDarkTheme ? "dark" : "light"}`}>
        <Layout className="app-layout">
          <Sider
            collapsible
            collapsed={isSidebarCollapsed}
            onCollapse={handleSidebarCollapse}
            width={280}
            collapsedWidth={88}
            theme={isDarkTheme ? "dark" : "light"}
            className="app-sider"
            breakpoint="lg"
          >
            <div className="app-sider-inner">
              <div className="app-logo-wrap">
                <SidebarLogo
                  darkTheme={isDarkTheme}
                  collapsed={isSidebarCollapsed}
                />
              </div>

              <div className="app-menu-wrap">
                <SidebarMenu darkTheme={isDarkTheme} />
              </div>
            </div>
          </Sider>

          <Layout className="app-main-layout">
            <Header className="app-header">
              <div className="app-header-inner">
                <Button
                  type="text"
                  className="app-mobile-menu-button"
                  icon={<MenuOutlined />}
                  onClick={handleOpenMobileSidebar}
                  aria-label="Buka menu navigasi"
                />

                {/* AKTIF / CLEANUP CANDIDATE RESOLVED: AppHeader membaca token CSS global, jadi prop darkTheme yang tidak dipakai dihapus tanpa mengubah flow AppLayout. */}
                <AppHeader />
              </div>
            </Header>

            <Content className="app-main-content">
              <div className="app-content-scroll">
                <div className="app-content-card">
                  <AppErrorBoundary resetKey={`${location.pathname}${location.search}${location.hash}`}>
                    <AppRoutes darkTheme={isDarkTheme} />
                  </AppErrorBoundary>
                </div>
              </div>
            </Content>
          </Layout>
        </Layout>

        <Drawer
          open={isMobileSidebarOpen}
          onClose={handleCloseMobileSidebar}
          placement="left"
          width={304}
          title={null}
          closable={false}
          className="app-mobile-sidebar-drawer-content"
          rootClassName="app-mobile-sidebar-drawer"
        >
          <div className="app-mobile-sidebar-surface">
            <div className="app-logo-wrap app-logo-wrap--mobile">
              <SidebarLogo
                darkTheme={isDarkTheme}
                collapsed={false}
              />
            </div>

            <div className="app-menu-wrap app-menu-wrap--mobile">
              <SidebarMenu darkTheme={isDarkTheme} />
            </div>
          </div>
        </Drawer>

        <ThemeToggleButton
          darkTheme={isDarkTheme}
          toggleTheme={handleToggleTheme}
        />

        <ActionResultModalHost />
      </div>
      </AntdApp>
    </ConfigProvider>
  );
};

export default AppLayout;
