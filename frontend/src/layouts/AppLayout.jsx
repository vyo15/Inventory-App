import { useEffect, useMemo, useRef, useState } from "react";
import { MenuOutlined } from "@ant-design/icons";
import { App as AntdApp, Button, ConfigProvider, Drawer, Layout } from "antd";
import { useLocation } from "react-router-dom";
import DesktopModuleDock from "../components/Layout/Navigation/DesktopModuleDock";
import MobileBottomNavigation from "../components/Layout/Navigation/MobileBottomNavigation";
import SidebarMenu from "../components/Layout/Sidebar/SidebarMenu";
import SidebarLogo from "../components/Layout/Sidebar/SidebarLogo";
import AppErrorBoundary from "../components/Layout/Feedback/AppErrorBoundary";
import AppHeader from "../components/Layout/Header/AppHeader";
import ThemeToggleButton from "../components/Layout/Header/ThemeToggleButton";
import AppRoutes from "../router/AppRoutes";
import { getAntdTheme } from "../theme/antdTheme";
import {
  applyDocumentThemeMode,
  getInitialThemeMode,
  persistThemeMode,
  THEME_DARK_VALUE,
  THEME_LIGHT_VALUE,
} from "../theme/themeMode";
import { ActionResultModalHost } from "../utils/feedback/actionResultFeedback";
import { SqliteRealtimeProvider } from "../context/SqliteRealtimeContext.jsx";
import useAuth from "../hooks/useAuth";
import useSqliteRealtime from "../hooks/useSqliteRealtime";
import { isAuthProfileRealtimeEvent } from "../config/realtimeRouteScopes";
import { restartSqliteRealtime } from "../services/System/sqliteRealtimeService";
import "../App.css";

const { Header, Content } = Layout;

export const AuthRealtimeSync = () => {
  const { lastEvent } = useSqliteRealtime();
  const { reloadProfile } = useAuth();
  const handledEventRef = useRef(null);

  useEffect(() => {
    if (!isAuthProfileRealtimeEvent(lastEvent)) return undefined;
    const eventKey = `${lastEvent.type}:${lastEvent.revision ?? lastEvent.occurredAt ?? "auth"}`;
    if (handledEventRef.current === eventKey) return undefined;
    handledEventRef.current = eventKey;

    let cancelled = false;
    const synchronizeProfile = async () => {
      await reloadProfile();
      if (!cancelled) restartSqliteRealtime();
    };
    synchronizeProfile();

    return () => {
      cancelled = true;
    };
  }, [lastEvent, reloadProfile]);

  return null;
};

// =========================
// SECTION: Responsive Application Shell — AKTIF / GUARDED
// Fungsi:
// - desktop memakai floating module dock;
// - tablet memakai Drawer kiri existing;
// - telepon memakai bottom navigation + bottom sheet role-aware.
// Guardrail:
// - route bisnis, ProtectedRoute, role guard, dan business pages tidak dipindahkan ke layout.
// =========================
const AppLayout = () => {
  const [isDarkTheme, setIsDarkTheme] = useState(
    () => getInitialThemeMode() === THEME_DARK_VALUE,
  );
  const [isTabletSidebarOpen, setIsTabletSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    persistThemeMode(isDarkTheme ? THEME_DARK_VALUE : THEME_LIGHT_VALUE);
  }, [isDarkTheme]);

  useEffect(() => {
    applyDocumentThemeMode(
      isDarkTheme ? THEME_DARK_VALUE : THEME_LIGHT_VALUE,
    );
  }, [isDarkTheme]);

  useEffect(() => {
    setIsTabletSidebarOpen(false);
  }, [location.pathname]);

  const antdThemeConfig = useMemo(() => {
    return getAntdTheme(isDarkTheme);
  }, [isDarkTheme]);

  const handleToggleTheme = () => {
    setIsDarkTheme((previousTheme) => !previousTheme);
  };

  return (
    <ConfigProvider theme={antdThemeConfig}>
      <AntdApp component={false}>
        <SqliteRealtimeProvider>
          <AuthRealtimeSync />
          <div className={`app-shell ${isDarkTheme ? "dark" : "light"}`}>
          <DesktopModuleDock darkTheme={isDarkTheme} />

          <Layout className="app-layout">
            <Layout className="app-main-layout">
              <Header className="app-header">
                <div className="app-header-inner">
                  <Button
                    type="text"
                    className="app-mobile-menu-button"
                    icon={<MenuOutlined />}
                    onClick={() => setIsTabletSidebarOpen(true)}
                    aria-label="Buka menu navigasi"
                  />

                  <div className="app-header-brand-lockup app-header-brand--desktop">
                    <SidebarLogo darkTheme={isDarkTheme} collapsed={false} />
                  </div>

                  <div className="app-header-brand app-header-brand--phone">
                    <SidebarLogo darkTheme={isDarkTheme} collapsed />
                  </div>

                  <AppHeader />
                </div>
              </Header>

              <Content className="app-main-content">
                <div className="app-content-scroll">
                  <div className="app-content-card">
                    <AppErrorBoundary
                      resetKey={`${location.pathname}${location.search}${location.hash}`}
                    >
                      <AppRoutes darkTheme={isDarkTheme} />
                    </AppErrorBoundary>
                  </div>
                </div>
              </Content>
            </Layout>
          </Layout>

          <Drawer
            open={isTabletSidebarOpen}
            onClose={() => setIsTabletSidebarOpen(false)}
            placement="left"
            width={304}
            title={null}
            closable={false}
            className="app-mobile-sidebar-drawer-content"
            rootClassName="app-mobile-sidebar-drawer"
          >
            <div className="app-mobile-sidebar-surface">
              <div className="app-logo-wrap app-logo-wrap--mobile">
                <SidebarLogo darkTheme={isDarkTheme} collapsed={false} />
              </div>

              <div className="app-menu-wrap app-menu-wrap--mobile">
                <SidebarMenu darkTheme={isDarkTheme} />
              </div>
            </div>
          </Drawer>

          <MobileBottomNavigation
            darkTheme={isDarkTheme}
            toggleTheme={handleToggleTheme}
          />

          <ThemeToggleButton
            darkTheme={isDarkTheme}
            toggleTheme={handleToggleTheme}
          />

            <ActionResultModalHost />
          </div>
        </SqliteRealtimeProvider>
      </AntdApp>
    </ConfigProvider>
  );
};

export default AppLayout;
