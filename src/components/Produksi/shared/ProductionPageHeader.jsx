import React from 'react';
import { Button, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

// =====================================================
// SECTION: Production Content Page Header — AKTIF / LEGACY-COMPAT
// Fungsi:
// - menampilkan nama menu/halaman produksi di dalam content card.
// - mempertahankan action produksi seperti Tambah/Generate/extra tanpa mengubah callback.
//
// Dipakai oleh:
// - halaman produksi di src/pages/Produksi yang memakai <ProductionPageHeader />.
//
// Alasan perubahan:
// - AppHeader global kembali menjadi toolbar saja; title/description produksi lebih natural berada di content area.
//
// Risiko:
// - jika onAdd, addLabel, atau extra diubah sembarangan, action produksi penting bisa hilang atau callback produksi bisa berubah.
// =====================================================
const ProductionPageHeader = ({
  title,
  description,
  onAdd,
  addLabel = 'Tambah',
  extra,
}) => {
  const shouldShowTitle = Boolean(title || description);
  const hasAction = Boolean(onAdd || extra);

  if (!shouldShowTitle && !hasAction) {
    return null;
  }

  return (
    <div className="production-page-header">
      {shouldShowTitle ? (
        <div className="production-page-header-content">
          {title ? (
            <Title level={3} className="production-page-header-title">
              {title}
            </Title>
          ) : null}
          {description ? (
            <Text className="production-page-header-description">{description}</Text>
          ) : null}
        </div>
      ) : null}

      {hasAction ? (
        <Space wrap className="production-page-header-actions">
          {onAdd ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
              {addLabel}
            </Button>
          ) : null}
          {extra}
        </Space>
      ) : null}
    </div>
  );
};

export default ProductionPageHeader;
