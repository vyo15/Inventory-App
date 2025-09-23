// src/Components/Dashboard/RecentProductionsTable.jsx
import React from "react";
import { Card, Table } from "antd";

const RecentProductionsTable = ({ recentProductions, loading }) => {
  const productionColumns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      key: "date",
      render: (date) =>
        date ? new Date(date).toLocaleDateString("id-ID") : "N/A",
    },
    {
      title: "Produk Hasil",
      dataIndex: ["productResult", "name"], // Pastikan data punya struktur ini
      key: "productResultName",
      render: (text) => text || "N/A",
    },
    {
      title: "Jumlah",
      dataIndex: ["productResult", "quantity"], // Pastikan data punya struktur ini
      key: "productResultQuantity",
      render: (text) => text || 0,
    },
  ];

  return (
    <Card title="Produksi Terbaru" className="dashboard-card" loading={loading}>
      <Table
        dataSource={recentProductions}
        columns={productionColumns}
        pagination={false}
        rowKey="id"
        locale={{ emptyText: "Tidak ada produksi terbaru." }}
      />
    </Card>
  );
};

export default RecentProductionsTable;
