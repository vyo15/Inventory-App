import React from "react";
import flanelKarawangMark from "../../../assets/branding/flanel-karawang-mark.png";
import "./SidebarLogo.css";

// =========================
// SECTION: Sidebar Brand Logo — AKTIF / UI ONLY
// Fungsi:
// - memakai mark logo usaha dari upload Logoflanel.zip sebagai identitas utama sidebar.
// Hubungan flow aplikasi:
// - branding visual saja; tidak mengubah route, struktur menu, role access, guard, atau business rules.
// Status:
// - AKTIF untuk menggantikan icon/sidebar logo lama.
// - CLEANUP CANDIDATE: bisa diganti ke asset logo horizontal/resmi lain bila owner menyediakan varian khusus sidebar.
// =========================
const SidebarLogo = ({ darkTheme, collapsed }) => {
  return (
    <div
      className={`sidebar-logo ${darkTheme ? "dark" : "light"} ${
        collapsed ? "collapsed" : "expanded"
      }`}
    >
      <div className="sidebar-logo-icon" aria-hidden="true">
        <img src={flanelKarawangMark} alt="" className="sidebar-logo-mark" />
      </div>

      {!collapsed && (
        <div className="sidebar-logo-text-group">
          <div className="sidebar-logo-title">IMS Bunga Flanel</div>
          <div className="sidebar-logo-subtitle">
            Flanel Karawang Industries
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarLogo;
