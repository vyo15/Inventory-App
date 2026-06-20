import React from "react";
import { Button, Popover, Space, Typography } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";
import "./InfoPopoverButton.css";

const { Text } = Typography;

const joinClassNames = (...items) => items.filter(Boolean).join(" ");

// =====================================================
// SECTION: IMS Info Popover Button — AKTIF / UI-ONLY
// Fungsi:
// - menampilkan info kecil/statis sebagai tombol popover compact;
// - menggantikan banner/alert permanen yang membuat halaman terlalu penuh;
// - menjaga satu sumber info per konteks agar tidak dobel.
// Catatan:
// - bukan untuk error, guard destructive, validasi form, atau data quality dynamic.
// - logic, route, service, stock, payroll, finance, production, dan audit tidak diubah.
// =====================================================
const InfoPopoverButton = ({
  label = "Info",
  title,
  description,
  items = [],
  placement = "bottomRight",
  size = "small",
  className = "",
  ariaLabel,
  buttonProps = {},
}) => {
  const normalizedItems = Array.isArray(items) ? items.filter(Boolean) : [];

  const content = (
    <Space direction="vertical" size={8} className="ims-info-popover-content">
      {description ? (
        <Text type="secondary" className="ims-info-popover-description">
          {description}
        </Text>
      ) : null}
      {normalizedItems.length > 0 ? (
        <div className="ims-info-popover-meta">
          {normalizedItems.map((item, index) => (
            <div className="ims-info-popover-meta-row" key={item.key || item.label || index}>
              <Text type="secondary" className="ims-info-popover-meta-label">
                {item.label}
              </Text>
              <Text className="ims-info-popover-meta-value">{item.value}</Text>
            </div>
          ))}
        </div>
      ) : null}
    </Space>
  );

  return (
    <Popover
      trigger="click"
      placement={placement}
      title={title}
      content={content}
      overlayClassName="ims-info-popover-overlay"
    >
      <Button
        {...buttonProps}
        size={size}
        icon={buttonProps.icon || <InfoCircleOutlined />}
        aria-label={buttonProps["aria-label"] || ariaLabel || label}
        className={joinClassNames("ims-info-popover-button", className, buttonProps.className)}
      >
        {label}
      </Button>
    </Popover>
  );
};

export default InfoPopoverButton;
