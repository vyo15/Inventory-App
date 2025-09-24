import React from "react";
import { Menu } from "antd";
import { Link } from "react-router-dom";
import {
  HomeOutlined,
  DatabaseOutlined,
  ShoppingCartOutlined,
  AppstoreOutlined,
  WalletOutlined,
  PrinterOutlined,
  BuildOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import "./MenuList.css";

const { SubMenu, Item } = Menu;

const MenuList = ({ darkTheme }) => {
  return (
    <Menu
      theme={darkTheme ? "dark" : "light"}
      mode="inline"
      className={`menu-bar ${darkTheme ? "dark" : "light"}`}
    >
      {/* Dashboard */}
      <Item key="Dashboard" icon={<HomeOutlined />}>
        <Link to="/dashboard">Dashboard</Link>
      </Item>

      {/* Master Data */}
      <SubMenu key="MasterData" icon={<DatabaseOutlined />} title="Data Utama">
        <Item key="Produk">
          <Link to="/products">Produk Jadi</Link>
        </Item>
        <Item key="RawMaterial">
          <Link to="/raw-materials">Bahan Baku</Link>
        </Item>
        <Item key="Kategori">
          <Link to="/categories">Kategori</Link>
        </Item>
        <Item key="Supplier">
          <Link to="/suppliers">Supplier</Link>
        </Item>
        <Item key="Customer">
          <Link to="/customers">Pelanggan</Link>
        </Item>
      </SubMenu>

      {/* Inventaris */}
      <SubMenu key="Inventory" icon={<AppstoreOutlined />} title="Inventaris">
        <Item key="StockManagement">
          <Link to="/stock-management">Manajemen Stok</Link>
        </Item>

        <Item key="StockAdjustment">
          <Link to="/stock-adjustment">Penyesuaian Stok</Link>
        </Item>
      </SubMenu>

      {/* Produksi */}
      <Item key="Produksi" icon={<BuildOutlined />}>
        <Link to="/productions">Produksi</Link>
      </Item>

      {/* Transaksi */}
      <SubMenu
        key="Transaksi"
        icon={<ShoppingCartOutlined />}
        title="Transaksi"
      >
        <Item key="Penjualan">
          <Link to="/sales">Penjualan</Link>
        </Item>
        <Item key="Pembelian">
          <Link to="/purchases">Pembelian</Link>
        </Item>
        <Item key="Retur">
          <Link to="/returns">Retur</Link>
        </Item>
      </SubMenu>

      {/* Keuangan */}
      <SubMenu key="Keuangan" icon={<WalletOutlined />} title="Kas & Biaya">
        <Item key="Pemasukan">
          <Link to="/cash-in">Pemasukan</Link>
        </Item>
        <Item key="Pengeluaran">
          <Link to="/cash-out">Pengeluaran</Link>
        </Item>
      </SubMenu>

      {/* Reports */}
      <SubMenu key="Reports" icon={<PrinterOutlined />} title="Laporan">
        <Item key="StokReport">
          <Link to="/report-stock">Laporan Stok</Link>
        </Item>
        <Item key="SalesReport">
          <Link to="/sales-report">Laporan Penjualan</Link>
        </Item>
        <Item key="PurchaseReport">
          <Link to="/purchases-report">Laporan Pembelian</Link>
        </Item>
        <Item key="ProfitReport">
          <Link to="/profit-loss">Laporan Laba Rugi</Link>
        </Item>
      </SubMenu>
    </Menu>
  );
};

export default MenuList;
