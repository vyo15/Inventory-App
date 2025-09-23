// src/Components/Dashboard/SummaryCards.jsx
import React from "react";
import { Card, Row, Col } from "antd";

const SummaryCards = ({
  totalProducts,
  totalMaterials,
  lowStockProductsCount,
  totalRevenue,
  totalExpenses,
  loading,
}) => {
  const summaryData = [
    { title: "Total Produk", value: totalProducts, color: "green" },
    { title: "Total Bahan Baku", value: totalMaterials, color: "blue" },
    {
      title: "Produk Stok Menipis",
      value: lowStockProductsCount, // Ini sudah digabungkan dari produk & bahan baku
      color: "orange",
    },
    { title: "Total Pendapatan", value: totalRevenue, color: "#1677ff" },
    { title: "Total Pengeluaran", value: totalExpenses, color: "#f5222d" },
    {
      title: "Laba Bersih",
      value: totalRevenue - totalExpenses,
      color: totalRevenue - totalExpenses >= 0 ? "#52c41a" : "#f5222d",
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {summaryData.map(({ title, value, color }, index) => (
        <Col xs={24} sm={12} md={8} lg={4} key={index}>
          <Card
            className="dashboard-card"
            style={{ textAlign: "center" }}
            loading={loading}
          >
            <h3>{title}</h3>
            <p style={{ fontSize: 24, color }}>
              {title.includes("Pendapatan") ||
              title.includes("Pengeluaran") ||
              title.includes("Laba")
                ? `Rp ${Number(value).toLocaleString("id-ID")}`
                : value}
            </p>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default SummaryCards;
