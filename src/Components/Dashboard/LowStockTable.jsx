// src/Components/Dashboard/LowStockTable.jsx
import React from "react";
import { Card, Table } from "antd";

const LowStockTable = ({ lowStockProducts, lowStockMaterials, loading }) => {
  const allLowStockItems = [
    ...lowStockProducts.map((item) => ({ ...item, type: "Produk" })),
    ...lowStockMaterials.map((item) => ({ ...item, type: "Bahan Baku" })),
  ];

  const lowStockColumns = [
    { title: "Nama Item", dataIndex: "name", key: "name" },
    { title: "Stok Tersisa", dataIndex: "stock", key: "stock" },
    { title: "Tipe", dataIndex: "type", key: "type" },
  ];

  return (
    <Card title="Stok Menipis" className="dashboard-card" loading={loading}>
      <Table
        dataSource={allLowStockItems}
        columns={lowStockColumns}
        pagination={false}
        size="small"
        rowKey="id"
        locale={{ emptyText: "Tidak ada stok menipis." }}
      />
    </Card>
  );
};

export default LowStockTable;
