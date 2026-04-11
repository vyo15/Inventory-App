import React from "react";
import { HiOutlineSparkles } from "react-icons/hi2";
import "./SidebarLogo.css";

// =========================
// SECTION: Sidebar Logo
// Logo dibuat clean dan satu tone.
// =========================
const SidebarLogo = ({ darkTheme, collapsed }) => {
  return (
    <div className={`sidebar-logo ${darkTheme ? "dark" : "light"}`}>
      <div className="sidebar-logo-icon">
        <HiOutlineSparkles />
      </div>

      {!collapsed && (
        <div className="sidebar-logo-text-group">
          <div className="sidebar-logo-title">IMS Bunga Flanel</div>
          <div className="sidebar-logo-subtitle">Inventory Management</div>
        </div>
      )}
    </div>
  );
};

export default SidebarLogo;
