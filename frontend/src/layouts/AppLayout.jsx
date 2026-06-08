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
import {
  applyDocumentThemeMode,
  getInitialThemeMode,
  persistThemeMode,
  THEME_DARK_VALUE,
  THEME_LIGHT_VALUE,
} from "../theme/themeMode";
import { ActionResultModalHost } from "../utils/feedback/actionResultFeedback";
import "../App.css";

const { Header, Sider, Content } = Layout;

const AppLayout = () => {
  const [isDarkTheme, setIsDarkTheme] = useState(() => getInitialThemeMode() === THEME_DARK_VALUE);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const location = useLocation();

  // Persist theme agar refresh tidak kembali ke mode default.
  useEffect(() => {
    persistThemeMode(isDarkTheme ? THEME_DARK_VALUE : THEME_LIGHT_VALUE);
  }, [isDarkTheme]);

  // Sinkronkan class global supaya portal AntD ikut mode aktif.
  useEffect(() => {
    applyDocumentThemeMode(isDarkTheme ? THEME_DARK_VALUE : THEME_LIGHT_VALUE);
  }, [isDarkTheme]);

  // Tutup drawer mobile setelah pindah halaman.
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  const antdThemeConfig = useMemo(() => {
    return getAntdTheme(isDarkTheme);
  }, [isDarkTheme]);

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
