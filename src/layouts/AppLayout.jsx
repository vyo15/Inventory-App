import React, { useEffect, useMemo, useState } from "react";
import { ConfigProvider, Layout } from "antd";
import SidebarMenu from "../components/Layout/Sidebar/SidebarMenu";
import SidebarLogo from "../components/Layout/Sidebar/SidebarLogo";
import AppHeader from "../components/Layout/Header/AppHeader";
import ThemeToggleButton from "../components/Layout/Header/ThemeToggleButton";
import AppRoutes from "../router/AppRoutes";
import { getAntdTheme } from "../theme/antdTheme";
import "../App.css";

const { Header, Sider, Content } = Layout;

// =========================
// SECTION: Constants
// =========================
const THEME_STORAGE_KEY = "ims-bunga-flanel-theme";
const DEFAULT_DARK_THEME = false;

// =========================
// SECTION: Main App Layout
// =========================
const AppLayout = () => {
  // =========================
  // SECTION: UI State
  // =========================
  const [isDarkTheme, setIsDarkTheme] = useState(DEFAULT_DARK_THEME);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // =========================
  // SECTION: Load Saved Theme
  // =========================
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme === "dark") {
      setIsDarkTheme(true);
      return;
    }

    if (savedTheme === "light") {
      setIsDarkTheme(false);
    }
  }, []);

  // =========================
  // SECTION: Persist Theme
  // =========================
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, isDarkTheme ? "dark" : "light");
  }, [isDarkTheme]);

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

  return (
    <ConfigProvider theme={antdThemeConfig}>
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
              <AppHeader darkTheme={isDarkTheme} />
            </Header>

            <Content className="app-main-content">
              <div className="app-content-scroll">
                <div className="app-content-card">
                  <AppRoutes darkTheme={isDarkTheme} />
                </div>
              </div>
            </Content>
          </Layout>
        </Layout>

        <ThemeToggleButton
          darkTheme={isDarkTheme}
          toggleTheme={handleToggleTheme}
        />
      </div>
    </ConfigProvider>
  );
};

export default AppLayout;
