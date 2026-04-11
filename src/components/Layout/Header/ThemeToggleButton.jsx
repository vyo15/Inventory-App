import React from "react";
import { FloatButton } from "antd";
import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi2";

// =========================
// SECTION: Theme Toggle Button
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
      style={{
        insetInlineEnd: 24,
        bottom: 24,
      }}
    />
  );
};

export default ThemeToggleButton;
