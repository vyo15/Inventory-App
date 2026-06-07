import React from "react";
import { Button, Descriptions, Drawer, Space, Typography } from "antd";
import "./MobileDetailDrawer.css";

const { Text } = Typography;

const mergeClassNames = (...classNames) => classNames.filter(Boolean).join(" ");

// =====================================================
// SECTION: MobileDetailDrawer — AKTIF / UI-ONLY
// Fungsi:
// - menampung detail panjang dari mobile card agar list utama tetap ringkas.
// - menyamakan pola header/status/meta/footer detail drawer di real pages.
// - desktop tetap bisa memakai lebar khusus dari page; mobile dibuat full-screen friendly.
// Guardrail:
// - presentational-only; action callback tetap berasal dari page pemilik data.
// =====================================================
const MobileDetailDrawer = ({
  open,
  onClose,
  title,
  subtitle,
  status,
  items = [],
  actions,
  extra,
  footer,
  children,
  width = 520,
  placement = "right",
  destroyOnClose = true,
  closeText = "Tutup",
  showCloseAction = true,
  className,
  rootClassName,
  drawerProps = {},
}) => {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const hasHeaderActions = Boolean(status || extra);
  const footerContent = footer || actions;
  const shouldShowFooter = Boolean(footerContent || (showCloseAction && onClose));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={null}
      placement={placement}
      width={width}
      className={mergeClassNames("ims-mobile-detail-drawer", className)}
      rootClassName={mergeClassNames("ims-mobile-detail-drawer-root", rootClassName)}
      destroyOnClose={destroyOnClose}
      {...drawerProps}
    >
      <div className="ims-mobile-detail-drawer__header">
        <div className="ims-mobile-detail-drawer__identity">
          <Text className="ims-mobile-detail-drawer__eyebrow">Detail</Text>
          <h2>{title || "Detail Data"}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {hasHeaderActions ? (
          <Space className="ims-mobile-detail-drawer__actions" size={8} wrap>
            {status ? <div className="ims-mobile-detail-drawer__status">{status}</div> : null}
            {extra}
          </Space>
        ) : null}
      </div>

      {safeItems.length ? (
        <Descriptions
          column={1}
          size="small"
          bordered
          className="ims-mobile-detail-drawer__descriptions"
          items={safeItems.map((item, index) => ({
            key: item.key || item.label || index,
            label: item.label,
            children: item.value,
          }))}
        />
      ) : null}

      {children ? <div className="ims-mobile-detail-drawer__body">{children}</div> : null}

      {shouldShowFooter ? (
        <div className="ims-mobile-detail-drawer__footer">
          <Space wrap>
            {footerContent}
            {showCloseAction && onClose ? <Button onClick={onClose}>{closeText}</Button> : null}
          </Space>
        </div>
      ) : null}
    </Drawer>
  );
};

export default MobileDetailDrawer;
