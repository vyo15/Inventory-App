import React from "react";
import { SmileFilled } from "@ant-design/icons";
import "./Logo.css";


const Logo = ({ darkTheme }) => {
  return (
    <div className={`logo ${darkTheme ? "dark" : "light"}`}>
      <div className="logo-icon">
        <SmileFilled />
      </div>
    </div>
  );
};

export default Logo;
