import React from "react";
import { Typography } from "antd";
import "./AppHeader.css";

const { Title, Text } = Typography;

const AppHeader = () => {
  return (
    <div className="app-header-content">
      <div className="app-header-left">
        <Title level={3} className="app-header-title">
          IMS Bunga Flanel
        </Title>

        <Text className="app-header-subtitle">
          Kelola stok, transaksi, produksi, dan laporan dalam satu workspace
          yang rapi dan efisien.
        </Text>
      </div>
    </div>
  );
};

export default AppHeader;
