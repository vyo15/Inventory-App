import React, { useState } from "react";
import { Layout } from "antd";
import { Routes, Route } from "react-router";

// Komponen Sidebar, Header, dan Theme Button
import MenuList from "./Components/Sidebar/MenuList";
import Logo from "./Components/Logo/Logo";
import CostumHeader from "./Components/Header/CostumHeader";
import FloatButtonTheme from "./Components/FloatButton/FloatButtonTheme";

// Halaman (Pages)
import Dashboard from "./Pages/Dashboard/Dashboard";
import Inventory from "./Pages/Inventory";
import Transaksi from "./Pages/Transaksi";
import ProductIN from "./Pages/ProductIN";
import ProductOUT from "./Pages/ProductOUT";
import Keuangan from "./Pages/Keuangan";
import Reports from "./Pages/Reports";
import WeLost from "./Pages/WeLost";

import "./App.css";

const { Header, Sider, Content } = Layout;

const App = () => {
  // State untuk dark mode
  const [darkTheme, setDarkTheme] = useState(false);

  // State untuk sidebar collapse
  const [collapsed, setCollapsed] = useState(false);

  // Toggle Dark/Light Mode
  const toggleTheme = () => setDarkTheme(!darkTheme);

  return (
    <Layout className={`main-layout ${darkTheme ? "dark" : "light"}`}>
      {/* SIDEBAR */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme={darkTheme ? "dark" : "light"}
      >
        <Logo darkTheme={darkTheme} />
        <MenuList darkTheme={darkTheme} />
      </Sider>

      {/* MAIN CONTENT */}
      <Layout>
        {/* Header */}
        <Header className="header">
          <CostumHeader />
        </Header>

        {/* Content / Halaman */}
        <Content className="content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/transaksi" element={<Transaksi />} />
            <Route path="/product-in" element={<ProductIN />} />
            <Route path="/product-out" element={<ProductOUT />} />
            <Route path="/keuangan" element={<Keuangan />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/we-lost" element={<WeLost />} />
            <Route path="*" element={<h1>404 NOT FOUND</h1>} />
          </Routes>
        </Content>
      </Layout>

      {/* Floating Button untuk Theme */}
      <FloatButtonTheme darkTheme={darkTheme} toggleTheme={toggleTheme} />
    </Layout>
  );
};

export default App;
