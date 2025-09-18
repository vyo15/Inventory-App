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

import Categories from "./Pages/MasterData/Categories";
import Productions from "./Pages/Produksi/Productions";
import Orders from "./Pages/Pesanan/Orders";
import Customers from "./Pages/MasterData/Customers";
import Products from "./Pages/MasterData/Products";
import RawMaterials from "./Pages/MasterData/RawMaterials";
import SupplierPurchases from "./Pages/MasterData/SupplierPurchases";

// Inventory
import StockAdjustment from "./Pages/Inventory/StockAdjustment";
import StockIn from "./Pages/Inventory/StockIn";
import StockOut from "./Pages/Inventory/StockOut"; // Tambahan
import StockManagement from "./Pages/Inventory/StockManagement";

import "./App.css";
import StockReport from "./Pages/Laporan/StockReport";

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
              {/* Redirect to dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              {/* Dashboard */}
              <Route
                path="/dashboard"
                element={<Dashboard darkTheme={darkTheme} />}
              />
              {/* Master Data */}
              <Route path="/categories" element={<Categories />} />
              <Route path="/productions" element={<Productions />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/suppliers" element={<SupplierPurchases />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/products" element={<Products />} />
              <Route path="/raw-materials" element={<RawMaterials />} />
              {/* Inventory */}
              <Route path="/stock-in" element={<StockIn />} />
              <Route path="/stock-out" element={<StockOut />} />
              <Route path="/stock-adjustment" element={<StockAdjustment />} />
              <Route path="/stock-management" element={<StockManagement />} />
              <Route path="/report-stock" element={<StockReport />} />

              {/* Halaman Tidak Ditemukan */}
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
