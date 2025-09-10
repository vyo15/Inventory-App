import React from "react";
import { Menu } from "antd";
import { Link } from "react-router-dom";
import {
  DatabaseOutlined,
  HomeOutlined,
  PrinterOutlined,
  ShoppingOutlined,
  WalletOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import "./MenuList.css";

/**
 * Sidebar Menu Navigasi
 * Props:
 * - darkTheme (boolean)
 */
const { SubMenu, Item } = Menu;

const MenuList = ({ darkTheme }) => {
  return (
    <Menu
      theme={darkTheme ? "dark" : "light"}
      mode="inline"
      className="menu-bar"
    >
      <Item key="Dashboard" icon={<HomeOutlined />}>
        <Link to="/dashboard">Dashboard</Link>
      </Item>

      <Item key="Inventory" icon={<DatabaseOutlined />}>
        <Link to="/inventory">Inventory</Link>
      </Item>

      <Item key="Transaksi" icon={<ShoppingOutlined />}>
        <Link to="/transaksi">Transaksi</Link>
      </Item>

      {/* Submenu untuk Product */}
      <SubMenu key="Product" icon={<AppstoreOutlined />} title="Product">
        <Item key="ProductIN">
          <Link to="/product-in">Product IN</Link>
        </Item>
        <Item key="ProductOUT">
          <Link to="/product-out">Product OUT</Link>
        </Item>
      </SubMenu>

      <Item key="Keuangan" icon={<WalletOutlined />}>
        <Link to="/keuangan">Keuangan</Link>
      </Item>

      <Item key="Reports" icon={<PrinterOutlined />}>
        <Link to="/reports">Reports</Link>
      </Item>
    </Menu>
  );
};

export default MenuList;
