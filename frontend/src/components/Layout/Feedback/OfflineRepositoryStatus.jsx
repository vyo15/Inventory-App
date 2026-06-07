import React from "react";
import { Empty, Space, Typography } from "antd";
import "./OfflineRepositoryStatus.css";

const { Text } = Typography;

// =====================================================
// SECTION: RepositoryStatus — COMPATIBILITY / UI-ONLY
// Fungsi:
// - Komponen status mode data historis dipertahankan sebagai no-op agar halaman lama
//   yang masih mengimpor komponen ini tidak menampilkan banner teknis di UI.
// - Karena alur data IMS sudah menggunakan database lokal utama, halaman operasional
//   tidak perlu lagi menampilkan label mode database kepada user.
// =====================================================
const OfflineRepositoryStatus = () => null;

export const OfflineRepositoryEmptyState = ({ dataLabel = "data" }) => {
  return (
    <div className="ims-offline-repository-empty-state">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={(
          <Space direction="vertical" size={6} align="center">
            <Text strong>{`Belum ada ${dataLabel}.`}</Text>
            <Text type="secondary">Tambahkan data dari halaman ini.</Text>
          </Space>
        )}
      />
    </div>
  );
};

export default OfflineRepositoryStatus;
