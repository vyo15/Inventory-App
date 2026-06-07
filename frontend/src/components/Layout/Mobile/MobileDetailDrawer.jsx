import React from "react";
import { Button, Descriptions, Drawer, Space, Typography } from "antd";
import "./MobileDetailDrawer.css";

const { Text } = Typography;

// =====================================================
// SECTION: MobileDetailDrawer — AKTIF / UI-ONLY
// Fungsi:
// - menampung detail panjang dari mobile card agar list utama tetap ringkas.
// - desktop tetap bisa memakai Drawer biasa; mobile dibuat full-screen/bottom-friendly.
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
  children,
}) => {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={null}
      placement="right"
      width={520}
      className="ims-mobile-detail-drawer"
      rootClassName="ims-mobile-detail-drawer-root"
      destroyOnClose
    >
      <div className="ims-mobile-detail-drawer__header">
        <div className="ims-mobile-detail-drawer__identity">
          <Text className="ims-mobile-detail-drawer__eyebrow">Detail</Text>
          <h2>{title || "Detail Data"}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {status ? <div className="ims-mobile-detail-drawer__status">{status}</div> : null}
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

      {(actions || onClose) ? (
        <div className="ims-mobile-detail-drawer__footer">
          <Space wrap>
            {actions}
            <Button onClick={onClose}>Tutup</Button>
          </Space>
        </div>
      ) : null}
    </Drawer>
  );
};

export default MobileDetailDrawer;
