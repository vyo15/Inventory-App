import React from "react";
import { FloatButton } from "antd";
import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi2";

// =========================
// SECTION: Theme Toggle Button - AKTIF
// Fungsi:
// - menyediakan kontrol cepat untuk mengganti light/dark theme workspace.
// Hubungan flow aplikasi:
// - menerima state dari AppLayout; tidak menyimpan theme sendiri dan tidak menyentuh route/auth/module bisnis.
// Status:
// - AKTIF sebagai UI control ringan.
// - GUARDED: posisi visual dipindah ke CSS agar tidak ada inline style yang drift dari token theme.
// =========================
const ThemeToggleButton = ({ darkTheme, toggleTheme }) => {
  return (
    <FloatButton
      onClick={toggleTheme}
      tooltip={darkTheme ? "Mode terang" : "Mode gelap"}
      icon={
        darkTheme ? <HiOutlineSun size={18} /> : <HiOutlineMoon size={18} />
      }
      className={`theme-toggle-button ${darkTheme ? "dark" : "light"}`}
      aria-label={darkTheme ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
    />
  );
};

export default ThemeToggleButton;
