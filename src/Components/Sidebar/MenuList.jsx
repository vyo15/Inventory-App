import React from "react";
import { Menu } from "antd";
import { Link } from "react-router-dom";
import {
  HomeOutlined,
  DatabaseOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  AppstoreOutlined,
  WalletOutlined,
  PrinterOutlined,
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

      {/* Inventory */}
      <SubMenu key="Inventory" icon={<AppstoreOutlined />} title="Inventory">
        <Item key="StokMasuk">
          <Link to="/stock-in">Stok Masuk</Link>
        </Item>
        <Item key="StokKeluar">
          <Link to="/stock-out">Stok Keluar</Link>
        </Item>
        <Item key="Penyesuaian">
          <Link to="/stock-adjustment">Penyesuaian Stok</Link>
        </Item>
      </SubMenu>

      {/* Master Data */}
      <SubMenu key="MasterData" icon={<DatabaseOutlined />} title="Master Data">
        <Item key="Produk">
          <Link to="/products">Produk</Link>
        </Item>
        <Item key="Kategori">
          <Link to="/categories">Kategori</Link>
        </Item>
        <Item key="Supplier">
          <Link to="/suppliers">Supplier</Link>
        </Item>
        <Item key="Customer">
          <Link to="/customers">Customer</Link>
        </Item>
      </SubMenu>

      {/* Keuangan */}
      <SubMenu key="Keuangan" icon={<WalletOutlined />} title="Keuangan">
        <Item key="Pemasukan">
          <Link to="/income">Pemasukan</Link>
        </Item>
        <Item key="Pengeluaran">
          <Link to="/expenses">Pengeluaran</Link>
        </Item>
      </SubMenu>

      {/* Reports */}
      <SubMenu key="Reports" icon={<PrinterOutlined />} title="Reports">
        <Item key="StokReport">
          <Link to="/report-stock">Laporan Stok</Link>
        </Item>
        <Item key="SalesReport">
          <Link to="/report-sales">Laporan Penjualan</Link>
        </Item>
        <Item key="PurchaseReport">
          <Link to="/report-purchases">Laporan Pembelian</Link>
        </Item>
        <Item key="ProfitReport">
          <Link to="/report-profit">Laporan Laba Rugi</Link>
        </Item>
      </SubMenu>
    </Menu>
  );
};

export default MenuList;
