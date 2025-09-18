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
        <Item key="StockIn">
          <Link to="/stock-in">Stok Masuk</Link>
        </Item>
        <Item key="StockOut">
          <Link to="/stock-out">Stok Keluar</Link>
        </Item>
        <Item key="StockAdjustment">
          <Link to="/stock-adjustment">Penyesuaian Stok</Link>
        </Item>
      </SubMenu>

      {/* Produksi */}
      <Item key="Produksi" icon={<BuildOutlined />}>
        <Link to="/productions">Produksi</Link>
      </Item>

      {/* Pesanan */}
      <SubMenu key="Pesanan" icon={<UnorderedListOutlined />} title="Pesanan">
        <Item key="SemuaPesanan">
          <Link to="/orders">Semua Pesanan</Link>
        </Item>
        <Item key="Diproses">
          <Link to="/orders/processing">Diproses</Link>
        </Item>
        <Item key="Dikirim">
          <Link to="/orders/shipped">Dikirim</Link>
        </Item>
        <Item key="Selesai">
          <Link to="/orders/completed">Selesai</Link>
        </Item>
      </SubMenu>

      {/* Transaksi */}
      <SubMenu
        key="Transaksi"
        icon={<ShoppingCartOutlined />}
        title="Transaksi Keuangan"
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
          <Link to="/income">Pemasukan</Link>
        </Item>
        <Item key="Pengeluaran">
          <Link to="/expenses">Pengeluaran</Link>
        </Item>
      </SubMenu>

      {/* Reports */}
      <SubMenu key="Reports" icon={<PrinterOutlined />} title="Laporan">
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
