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
import WeLost from "./Pages/ErrorPage/WeLost";

import "./App.css";
import Categories from "./Pages/MasterData/Categories";
import Productions from "./Pages/Produksi/Productions";
import Orders from "./Pages/Pesanan/Orders";
import Supplier from "./Pages/MasterData/Supplier";
import Customers from "./Pages/MasterData/Customers";
import Products from "./Pages/MasterData/Products";
import RawMaterials from "./Pages/MasterData/RawMaterials";

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
              <Route path="/categories" element={<Categories />} />
              <Route path="/productions" element={<Productions />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/suppliers" element={<Supplier />} />
              <Route path="customers" element={<Customers />} />
              <Route path="products" element={<Products />} />
              <Route path="/raw-materials" element={<RawMaterials />} />
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
