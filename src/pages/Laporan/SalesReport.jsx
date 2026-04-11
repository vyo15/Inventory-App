import React, { useEffect, useMemo, useState } from "react";
import { Card, Table, message, Row, Col, Statistic, Button, Tag } from "antd";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import dayjs from "dayjs";
import { exportJsonToExcel } from "../../utils/export/exportExcel";

// SECTION: format angka Indonesia tanpa desimal
const formatNumberID = (value) => {
  return Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 0,
  });
};

// SECTION: format rupiah Indonesia tanpa desimal
const formatCurrencyIDR = (value) => {
  return `Rp ${formatNumberID(value)}`;
};

const SalesReport = () => {
  // SECTION: state utama laporan penjualan
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);

  // SECTION: ambil data penjualan terbaru dari firestore
  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      try {
        const salesRef = collection(db, "sales");
        const q = query(salesRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        const data = querySnapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));

        setSalesData(data);
      } catch (error) {
        console.error("Gagal mengambil data laporan penjualan:", error);
        message.error("Gagal memuat laporan penjualan.");
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  // SECTION: ringkasan total keseluruhan laporan penjualan
  const summary = useMemo(() => {
    return salesData.reduce(
      (acc, item) => {
        const total = Math.round(Number(item.total || 0));
        acc.totalRevenue += total;
        acc.totalSalesCount += 1;

        if ((item.status || "") === "Selesai") {
          acc.totalCompletedRevenue += total;
          acc.totalCompletedCount += 1;
        }

        return acc;
      },
      {
        totalRevenue: 0,
        totalSalesCount: 0,
        totalCompletedRevenue: 0,
        totalCompletedCount: 0,
      },
    );
  }, [salesData]);

  // SECTION: ekspor laporan ke excel dengan field yang sudah sinkron
  const exportToExcel = async () => {
    const exportData = salesData.map((sale) => ({
      "ID Transaksi": sale.id,
      Tanggal: sale.date?.toDate
        ? dayjs(sale.date.toDate()).format("DD-MM-YYYY HH:mm")
        : "-",
      Pelanggan: sale.customerName || "-",
      Channel: sale.salesChannel || "-",
      Resi: sale.referenceNumber || "-",
      "Item Terjual": (sale.items || [])
        .map((item) => `${item.itemName} (${item.quantity})`)
        .join(", "),
      Total: Math.round(Number(sale.total || 0)),
      Status: sale.status || "-",
      Catatan: sale.note || "-",
    }));

    await exportJsonToExcel({
      data: exportData,
      sheetName: "Laporan Penjualan",
      fileName: "Laporan-Penjualan",
    });
    message.success("Laporan berhasil diekspor ke Excel!");
  };

  // SECTION: kolom tabel laporan penjualan
  const columns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      render: (val) =>
        val?.toDate ? dayjs(val.toDate()).format("DD-MM-YYYY HH:mm") : "-",
    },
    {
      title: "Pelanggan",
      dataIndex: "customerName",
      render: (text) => text || "-",
    },
    {
      title: "Item",
      dataIndex: "items",
      render: (items) =>
        Array.isArray(items) && items.length > 0 ? (
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {items.map((item, index) => (
              <li key={index}>
                {item.itemName} ({item.quantity}) -{" "}
                {formatCurrencyIDR(item.pricePerUnit)}
              </li>
            ))}
          </ul>
        ) : (
          "-"
        ),
    },
    {
      title: "Channel",
      dataIndex: "salesChannel",
      render: (text) => text || "-",
    },
    {
      title: "Resi / Referensi",
      dataIndex: "referenceNumber",
      render: (text) => text || "-",
    },
    {
      title: "Total",
      dataIndex: "total",
      render: (val) => formatCurrencyIDR(val),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (status) => {
        const statusColors = {
          Selesai: "green",
          Dikirim: "orange",
          Diproses: "blue",
          Dibatalkan: "red",
        };
        return (
          <Tag color={statusColors[status] || "default"}>{status || "-"}</Tag>
        );
      },
    },
  ];

  return (
    <div>
      <h2>Laporan Penjualan</h2>

      {/* SECTION: ringkasan total keseluruhan penjualan */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Total Omzet Semua Transaksi"
              value={summary.totalRevenue}
              formatter={(value) => formatCurrencyIDR(value)}
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Jumlah Transaksi"
              value={summary.totalSalesCount}
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Omzet Status Selesai"
              value={summary.totalCompletedRevenue}
              formatter={(value) => formatCurrencyIDR(value)}
            />
          </Card>
        </Col>

        <Col xs={24} md={6}>
          <Card>
            <Statistic
              title="Transaksi Selesai"
              value={summary.totalCompletedCount}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Detail Penjualan">
        {/* SECTION: tombol ekspor */}
        <div style={{ marginBottom: 16, textAlign: "right" }}>
          <Button
            type="primary"
            onClick={exportToExcel}
            disabled={salesData.length === 0}
          >
            Ekspor ke Excel
          </Button>
        </div>

        <Table
          dataSource={salesData}
          columns={columns}
          rowKey="id"
          loading={loading}
        />
      </Card>
    </div>
  );
};

export default SalesReport;
