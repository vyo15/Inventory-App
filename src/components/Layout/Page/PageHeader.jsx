import React from "react";
import { Button, Space, Typography } from "antd";
import "./PageHeader.css";

const { Title, Text } = Typography;

const PageHeader = ({ title, subtitle, extra, actions = [] }) => {
  return (
    <div className="page-header">
      <div className="page-header-content">
        <Title level={3} className="page-header-title">
          {title}
        </Title>

        {subtitle ? (
          <Text className="page-header-subtitle">{subtitle}</Text>
        ) : null}
      </div>

      <div className="page-header-actions">
        {extra}

        {actions.length > 0 ? (
          <Space wrap>
            {actions.map((actionItem) => (
              <Button
                key={actionItem.key}
                type={actionItem.type || "default"}
                icon={actionItem.icon}
                onClick={actionItem.onClick}
                danger={actionItem.danger}
              >
                {actionItem.label}
              </Button>
            ))}
          </Space>
        ) : null}
      </div>
    </div>
  );
};

export default PageHeader;
