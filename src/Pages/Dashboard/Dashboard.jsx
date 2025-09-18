import React from "react";
import { Card, Row, Col, Table, Tag } from "antd";
import { Column } from "@ant-design/charts";

const Dashboard = () => {
  // Contoh data ringkasan
  const summaryData = [
    { title: "Total Penjualan", value: "Rp 120.000.000", color: "green" },
    { title: "Total Pembelian", value: "Rp 80.000.000", color: "blue" },
    { title: "Pengeluaran", value: "Rp 15.000.000", color: "red" },
  ];

  // Contoh data chart penjualan bulanan
  const salesData = [
    { month: "Jan", sales: 5000000 },
    { month: "Feb", sales: 7000000 },
    { month: "Mar", sales: 6000000 },
    { month: "Apr", sales: 9000000 },
    { month: "Mei", sales: 12000000 },
    { month: "Jun", sales: 11000000 },
  ];

  const config = {
    data: salesData,
    xField: "month",
    yField: "sales",
    label: {
      position: "middle",
      style: {
        fill: "#FFFFFF",
        opacity: 0.6,
      },
    },
    xAxis: {
      label: {
        autoHide: true,
        autoRotate: false,
      },
    },
    meta: {
      sales: {
        alias: "Penjualan (Rp)",
        formatter: (v) => `Rp ${v.toLocaleString()}`,
      },
    },
  };

  // Contoh data transaksi terbaru
  const transactions = [
    {
      key: "1",
      id: "TRX001",
      date: "2025-09-01",
      customer: "Budi",
      total: 1500000,
      status: "Lunas",
    },
    {
      key: "2",
      id: "TRX002",
      date: "2025-09-02",
      customer: "Sari",
      total: 2000000,
      status: "Pending",
    },
  ];

  const transactionColumns = [
    { title: "ID Transaksi", dataIndex: "id", key: "id" },
    { title: "Tanggal", dataIndex: "date", key: "date" },
    { title: "Pelanggan", dataIndex: "customer", key: "customer" },
    {
      title: "Total",
      dataIndex: "total",
      key: "total",
      render: (val) => `Rp ${val.toLocaleString()}`,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const color = status === "Lunas" ? "green" : "orange";
        return <Tag color={color}>{status}</Tag>;
      },
    },
  ];

  // Contoh produk stok menipis
  const lowStockProducts = [
    { key: "1", name: "Produk A", stock: 3 },
    { key: "2", name: "Produk B", stock: 1 },
  ];

  const productColumns = [
    { title: "Nama Produk", dataIndex: "name", key: "name" },
    { title: "Stok Tersisa", dataIndex: "stock", key: "stock" },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={16}>
        {summaryData.map(({ title, value, color }) => (
          <Col span={8} key={title}>
            <Card style={{ textAlign: "center" }}>
              <h3>{title}</h3>
              <p style={{ fontSize: 24, color }}>{value}</p>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={16}>
          <Card title="Grafik Penjualan Bulanan">
            <Column {...config} />
          </Card>
        </Col>

        <Col span={8}>
          <Card title="Produk Stok Menipis">
            <Table
              dataSource={lowStockProducts}
              columns={productColumns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="Transaksi Terbaru">
            <Table
              dataSource={transactions}
              columns={transactionColumns}
              pagination={{ pageSize: 5 }}
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
