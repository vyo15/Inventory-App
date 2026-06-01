import React from "react";
import { Empty, Typography } from "antd";
import "./EmptyStateBlock.css";

const { Text } = Typography;

const EmptyStateBlock = ({ description = "Data belum tersedia." }) => {
  return (
    <div className="empty-state-block">
      <Empty
        description={<Text className="empty-state-text">{description}</Text>}
      />
    </div>
  );
};

export default EmptyStateBlock;
