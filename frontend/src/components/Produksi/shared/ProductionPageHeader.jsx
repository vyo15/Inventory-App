import React from 'react';
import { PlusOutlined } from '@ant-design/icons';
import PageHeader from '../../Layout/Page/PageHeader';

// =====================================================
// SECTION: Production Content Page Header — AKTIF / LEGACY-COMPAT
// Fungsi:
// - menampilkan title/description halaman produksi di kiri dan action utama di kanan.
// - memakai layout PageHeader agar tombol tambah/generate produksi konsisten dengan halaman bisnis lain.
//
// Dipakai oleh:
// - halaman produksi di src/pages/Produksi yang memakai <ProductionPageHeader />.
//
// Alasan perubahan:
// - tombol action utama produksi perlu sejajar kanan seperti PageHeader halaman non-produksi tanpa mengubah props/callback halaman.
//
// Catatan cleanup:
// - belum ada; wrapper ini tetap menjaga kompatibilitas prop title, description, onAdd, addLabel, dan extra.
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
  const actions = onAdd
    ? [
        {
          key: 'production-page-header-add',
          label: addLabel,
          type: 'primary',
          icon: <PlusOutlined />,
          onClick: onAdd,
        },
      ]
    : [];

  return (
    <PageHeader
      title={title}
      subtitle={description}
      extra={extra}
      actions={actions}
      className="production-page-header"
    />
  );
};

export default ProductionPageHeader;
