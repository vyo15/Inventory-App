import React, { useState } from "react";
import { Layout, ConfigProvider, theme } from "antd";
import { Routes, Route, Navigate } from "react-router-dom";

// Komponen
import MenuList from "./Components/Sidebar/MenuList";
import Logo from "./Components/Logo/Logo";
import CostumHeader from "./Components/Header/CostumHeader";
import FloatButtonTheme from "./Components/FloatButton/FloatButtonTheme";

// Halaman
import Dashboard from "./Pages/Dashboard/Dashboard";
import Inventory from "./Pages/Inventory";
import Transaksi from "./Pages/Transaksi";
import ProductIN from "./Pages/ProductIN";
import ProductOUT from "./Pages/ProductOUT";
import Keuangan from "./Pages/Keuangan";
import Reports from "./Pages/Reports";
import WeLost from "./Pages/ErrorPage/WeLost";

import "./App.css";

const { Header, Sider, Content } = Layout;

const App = () => {
  const [darkTheme, setDarkTheme] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const toggleTheme = () => setDarkTheme(!darkTheme);

  return (
    <ConfigProvider
      theme={{
        algorithm: darkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: "#1677ff",
          fontFamily: "Inter, Segoe UI, sans-serif",
          borderRadius: 8,
        },
      }}
    >
      <Layout className={`main-layout ${darkTheme ? "dark" : "light"}`}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          theme={darkTheme ? "dark" : "light"}
        >
          <Logo darkTheme={darkTheme} />
          <MenuList darkTheme={darkTheme} />
        </Sider>

        <Layout>
          <Header className="header">
            <CostumHeader />
          </Header>

          <Content className="content">
            <Routes>
              <Route
                path="/dashboard"
                element={<Dashboard darkTheme={darkTheme} />}
              />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/transaksi" element={<Transaksi />} />
              <Route path="/product-in" element={<ProductIN />} />
              <Route path="/product-out" element={<ProductOUT />} />
              <Route path="/keuangan" element={<Keuangan />} />
              <Route path="/reports" element={<Reports />} />
              {/* <Route path="/welost" element={<WeLost />} /> */}

              <Route path="*" element={<WeLost />} />
            </Routes>
          </Content>
        </Layout>

        <FloatButtonTheme darkTheme={darkTheme} toggleTheme={toggleTheme} />
      </Layout>
    </ConfigProvider>
  );
};

export default App;
