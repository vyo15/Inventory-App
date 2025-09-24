// src/Components/Dashboard/RecentTransactionsTable.jsx
import React from "react";
import { Card, Table, Tag } from "antd";

const RecentTransactionsTable = ({ recentTransactions, loading }) => {
  const transactionColumns = [
    {
      title: "Tipe",
      dataIndex: "type",
      key: "type",
      render: (type) => {
        let color = "blue";
        if (type && type.includes("in")) color = "green";
        else if (type && type.includes("out")) color = "red";
        else if (type === "stock_adjustment") color = "orange";
        return <Tag color={color}>{type?.replace(/_/g, " ")}</Tag>;
      },
    },
    { title: "Item", dataIndex: "itemName", key: "itemName" },
    {
      title: "Jumlah",
      dataIndex: "quantityChange",
      key: "quantityChange",
      render: (val) => Math.abs(val || 0),
    },
    { title: "Catatan", dataIndex: "note", key: "note" },
  ];

  return (
    <Card
      title="Riwayat Transaksi Terbaru"
      className="dashboard-card"
      loading={loading}
    >
      <Table
        dataSource={recentTransactions}
        columns={transactionColumns}
        pagination={false}
        rowKey="id"
        locale={{ emptyText: "Tidak ada transaksi terbaru." }}
      />
    </Card>
  );
};

export default RecentTransactionsTable;
