import React from "react";
import { Card, Typography } from "antd";
import "./PageSection.css";

const { Title, Text } = Typography;

// =========================
// SECTION: Shared Page Section
// Fungsi:
// - menjadi pembungkus blok konten seperti tabel, chart, atau ringkasan
// - menjaga judul section, subtitle, dan extra action tetap satu pola
// Catatan:
// - komponen ini masih dipakai aktif di dashboard, transaksi, dan stok
// - className tetap dibuka agar halaman tertentu bisa menambah style tanpa mengubah fondasi
// =========================
const PageSection = ({ title, subtitle, extra, children, className = "" }) => {
  return (
    <Card className={`page-section ${className}`.trim()}>
      {(title || subtitle || extra) && (
        <div className="page-section-header">
          <div className="page-section-title-group">
            {title ? (
              <Title level={5} className="page-section-title">
                {title}
              </Title>
            ) : null}

            {subtitle ? (
              <Text className="page-section-subtitle">{subtitle}</Text>
            ) : null}
          </div>

          {extra ? <div className="page-section-extra">{extra}</div> : null}
        </div>
      )}

      <div className="page-section-body">{children}</div>
    </Card>
  );
};

export default PageSection;
