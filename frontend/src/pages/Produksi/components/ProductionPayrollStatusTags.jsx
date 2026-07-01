import { Space, Tag, Typography } from "antd";
import { getCompactPayrollStatusTags } from "../../../constants/productionPayrollOptions";

export const ProductionPayrollStatusTags = ({ record }) => (
  <Space size={4} wrap>
    {getCompactPayrollStatusTags(record).map((item) => (
      <Tag key={item.key} color={item.color}>
        {item.label}
      </Tag>
    ))}
  </Space>
);

export const PayrollDetailValue = ({ children, help }) => (
  <Space direction="vertical" size={0}>
    <span>{children}</span>
    {help ? (
      <Typography.Text type="secondary" className="ims-cell-meta">
        {help}
      </Typography.Text>
    ) : null}
  </Space>
);
