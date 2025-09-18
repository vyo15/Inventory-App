import React from "react";
import { Flex, Typography } from "antd";
import "./CostumHeader.css";

/**
 * Header bagian atas aplikasi
 */
const CostumHeader = ({ darkTheme }) => {
  return (
    <Flex justify="space-between" align="center">
      <Typography.Title
        level={3}
        type="secondary"
        className={`costum-header ${darkTheme ? "dark" : "light"}`}
      >
        Welcome Back Vio!
      </Typography.Title>
    </Flex>
  );
};

export default CostumHeader;
