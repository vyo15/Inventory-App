import React from "react";
import { Button, Space, Typography } from "antd";
import "./PageHeader.css";

const { Title, Text } = Typography;

// =====================================================
// SECTION: Shared Content Page Header — AKTIF / LEGACY-COMPAT
// Fungsi:
// - menampilkan nama menu/page title dan subtitle di dalam content card.
// - tetap menerima props lama title, subtitle, extra, actions, className, dan showTitle agar halaman bisnis tidak perlu diubah satu per satu.
//
// Dipakai oleh:
// - banyak halaman di src/pages yang memakai <PageHeader /> untuk title halaman dan action seperti Tambah, Export, Generate, dan action operasional lain.
//
// Alasan perubahan:
// - title halaman dikembalikan ke area content agar tidak terasa mengambang di top header.
// - AppHeader global tetap menjadi toolbar saja; PageHeader menjadi source visual nama menu di bawah header.
//
// Catatan cleanup:
// - prop showTitle tetap tersedia untuk edge case yang perlu menyembunyikan title, tetapi default true.
//
// Risiko:
// - jika action/extra dihapus sembarangan, tombol penting halaman bisa hilang; jangan ubah callback, icon, danger, type, atau label action dari komponen ini.
// =====================================================
const PageHeader = ({
  title,
  subtitle,
  extra,
  actions = [],
  className = "",
  showTitle = true,
}) => {
  const safeActions = Array.isArray(actions) ? actions.filter(Boolean) : [];
  const hasExtra = Boolean(extra);
  const hasActions = safeActions.length > 0;
  const shouldShowTitle = Boolean(showTitle && (title || subtitle));

  if (!shouldShowTitle && !hasExtra && !hasActions) {
    return null;
  }

  return (
    <div
      className={`page-header ${
        shouldShowTitle ? "page-header--with-title" : "page-header--actions-only"
      } ${className}`.trim()}
    >
      {shouldShowTitle ? (
        <div className="page-header-content">
          {title ? (
            <Title level={3} className="page-header-title">
              {title}
            </Title>
          ) : null}

          {subtitle ? (
            <Text className="page-header-subtitle">{subtitle}</Text>
          ) : null}
        </div>
      ) : null}

      {(hasExtra || hasActions) ? (
        <div className="page-header-actions">
          {hasExtra ? <div className="page-header-extra">{extra}</div> : null}

          {hasActions ? (
            <Space wrap className="page-header-action-group">
              {safeActions.map((actionItem, index) => {
                if (React.isValidElement(actionItem)) {
                  return actionItem;
                }

                return (
                  <Button
                    key={actionItem.key || `page-header-action-${index}`}
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
                );
              })}
            </Space>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default PageHeader;
