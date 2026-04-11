import React from "react";
import { Card, Typography } from "antd";
import "./SummaryStatCard.css";

const { Text, Title } = Typography;

const SummaryStatCard = ({ title, value, subtitle, accent = "primary" }) => {
  return (
    <Card className={`summary-stat-card ${accent}`}>
      <div className="summary-stat-card-content">
        <Text className="summary-stat-card-title">{title}</Text>
        <Title level={3} className="summary-stat-card-value">
          {value}
        </Title>
        {subtitle ? (
          <Text className="summary-stat-card-subtitle">{subtitle}</Text>
        ) : null}
      </div>
    </Card>
  );
};

export default SummaryStatCard;
