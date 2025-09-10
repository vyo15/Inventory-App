import React from "react";
import { FloatButton } from "antd";
import { HiOutlineSun, HiOutlineMoon } from "react-icons/hi2";

const FloatButtonTheme = ({ darkTheme, toggleTheme }) => {
  return (
    <FloatButton
      shape="square"
      onClick={toggleTheme}
      icon={
        darkTheme ? <HiOutlineSun size={22} /> : <HiOutlineMoon size={22} />
      }
      tooltip={darkTheme ? "Light Mode" : "Dark Mode"}
    />
  );
};

export default FloatButtonTheme;
