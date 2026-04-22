import React from "react";
import { Col, Row } from "antd";
import SummaryStatCard from "./SummaryStatCard";

// =========================
// SECTION: Shared Summary Stat Grid
// Fungsi:
// - membungkus pola summary cards agar halaman tidak mengulang Row/Col/Card
// - menjaga grid statistik tetap seragam lintas halaman yang polanya sama
// Catatan:
// - komponen ini murni presentational
// - item.value diasumsikan sudah siap tampil dari halaman pemanggil
// =========================
const SummaryStatGrid = ({
  items = [],
  columns = { xs: 24, sm: 12, md: 12, lg: 6 },
  gutter = [16, 16],
  className = "",
}) => {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <Row gutter={gutter} className={className}>
      {items.map((item) => (
        <Col key={item.key || item.title} {...(item.columns || columns)}>
          <SummaryStatCard
            title={item.title}
            value={item.value}
            subtitle={item.subtitle}
            accent={item.accent || "primary"}
            className={item.className || ""}
            extra={item.extra || null}
          />
        </Col>
      ))}
    </Row>
  );
};

export default SummaryStatGrid;
