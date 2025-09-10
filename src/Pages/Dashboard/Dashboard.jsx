import React from "react";
import { Row, Col, Card, Statistic, Typography } from "antd";
import {
  AlertFilled,
  ShoppingOutlined,
  WalletOutlined,
} from "@ant-design/icons";

import "./Dashboard.css";

const Dashboard = ({ darkTheme }) => {
  return (
    <div className={`dashboard ${darkTheme ? "dark" : "light"}`}>
      <Typography.Title level={3} style={{ marginBottom: 24 }}>
        Dashboard
      </Typography.Title>
      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card className="dashboard-card">
            <Statistic
              title="Low Stock Alert"
              value={9}
              prefix={<AlertFilled />}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="dashboard-card">
            <Statistic
              title="Transactions"
              value={999}
              prefix={<ShoppingOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="dashboard-card">
            <Statistic
              title="Revenue"
              value={99999999}
              prefix={<WalletOutlined />}
              suffix="IDR"
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 32 }} className="dashboard-card">
        <Typography.Title level={5}>Activity Overview</Typography.Title>
        <div className="chart-placeholder">[Chart Placeholder]</div>
      </Card>
    </div>
  );
};

export default Dashboard;
