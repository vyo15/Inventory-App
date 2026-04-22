import React from "react";
import { Col, Row, Space } from "antd";
import "./FilterBar.css";

// =========================
// SECTION: Shared Filter Bar
// Fungsi:
// - menjadi fondasi area filter yang konsisten antar halaman
// - memisahkan blok filter dan blok action tanpa mengubah logic halaman
// Catatan:
// - children idealnya berupa elemen Col agar gutter tetap konsisten
// - komponen ini cukup generik untuk finance, laporan, dan inventory display
// =========================
const FilterBar = ({
  children,
  actions,
  className = "",
  surface = true,
}) => {
  const filterBarClassName = [
    "filter-bar",
    surface ? "filter-bar-surface" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={filterBarClassName}>
      <Row gutter={[12, 12]} align="middle" justify="space-between">
        <Col flex="auto">
          <Row gutter={[12, 12]}>{children}</Row>
        </Col>

        {actions ? (
          <Col>
            <Space wrap className="filter-bar-actions">
              {actions}
            </Space>
          </Col>
        ) : null}
      </Row>
    </div>
  );
};

export default FilterBar;
