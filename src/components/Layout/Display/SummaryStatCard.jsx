import React from "react";
import { Card, Typography } from "antd";
import "./SummaryStatCard.css";

const { Text, Title } = Typography;

// =========================
// SECTION: Shared Summary Stat Card
// Fungsi:
// - menjadi kartu ringkasan statistik standar lintas halaman
// - menjaga tampilan statistik tetap netral, profesional, dan konsisten
// Catatan:
// - prop accent tetap dipertahankan untuk kompatibilitas pemanggil lama
// - namun style akhir dibuat netral agar tidak warna-warni per kartu
// =========================
const SummaryStatCard = ({
  title,
  value,
  subtitle,
  accent = "primary",
  className = "",
  extra = null,
}) => {
  return (
    <Card
      className={`summary-stat-card ${className}`.trim()}
      data-accent={accent}
      bordered={false}
    >
      <div className="summary-stat-card-content">
        <div className="summary-stat-card-header">
          <Text className="summary-stat-card-title">{title}</Text>
          {extra ? <div className="summary-stat-card-extra">{extra}</div> : null}
        </div>

        <Title level={3} className="summary-stat-card-value">
          {value}
        </Title>

        {subtitle ? (
          <Text className="summary-stat-card-subtitle">{subtitle}</Text>
        ) : null}
      </div>
    </Card>
  );
};

export default SummaryStatCard;
