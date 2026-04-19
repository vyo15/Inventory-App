import React from "react";
import { Button, Space, Typography } from "antd";
import "./PageHeader.css";

const { Title, Text } = Typography;

// =========================
// SECTION: Shared Page Header
// Fungsi:
// - menjadi header standar untuk halaman operasional
// - menjaga struktur judul, subtitle, extra, dan action button tetap konsisten
// Catatan:
// - komponen ini masih dipakai aktif di beberapa halaman transaksi, stok, dan dashboard
// - sengaja dibuat generik agar halaman baru bisa memakai pola yang sama
// =========================
const PageHeader = ({
  title,
  subtitle,
  extra,
  actions = [],
  className = "",
}) => {
  return (
    <div className={`page-header ${className}`.trim()}>
      <div className="page-header-content">
        <Title level={3} className="page-header-title">
          {title}
        </Title>

        {subtitle ? (
          <Text className="page-header-subtitle">{subtitle}</Text>
        ) : null}
      </div>

      <div className="page-header-actions">
        {extra ? <div className="page-header-extra">{extra}</div> : null}

        {actions.length > 0 ? (
          <Space wrap className="page-header-action-group">
            {actions.map((actionItem) => (
              <Button
                key={actionItem.key}
                type={actionItem.type || "default"}
                icon={actionItem.icon}
                onClick={actionItem.onClick}
                danger={actionItem.danger}
                className={`page-header-action-button ${
                  actionItem.type === "primary" ? "is-primary" : "is-default"
                }`.trim()}
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
