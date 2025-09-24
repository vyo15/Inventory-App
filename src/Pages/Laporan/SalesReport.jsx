import React, { useEffect, useState } from "react";
import { Card, Table, message, Row, Col, Statistic, Button } from "antd";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import dayjs from "dayjs";

// --- Perbaikan: Import library untuk ekspor Excel
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const SalesReport = () => {
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalSalesCount, setTotalSalesCount] = useState(0);

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      try {
        const salesRef = collection(db, "sales");
        const q = query(salesRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const total = data.reduce((sum, item) => sum + (item.total || 0), 0);
        setTotalRevenue(total);
        setTotalSalesCount(data.length);
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

  // --- Perbaikan: Fungsi untuk mengekspor data ke Excel
  const exportToExcel = () => {
    // Menyiapkan data yang akan diekspor
    const exportData = salesData.map((sale) => ({
      "ID Transaksi": sale.id,
      Tanggal: dayjs(sale.date?.toDate()).format("DD-MM-YYYY HH:mm"),
      Pelanggan: sale.customer,
      "Item Terjual": sale.items
        .map((item) => `${item.itemName} (${item.quantity})`)
        .join(", "),
      Platform: sale.platform,
      Resi: sale.receiptNumber,
      "Total Pendapatan": sale.total,
      Status: sale.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Penjualan");

    // Konversi workbook ke array buffer
    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });

    // Menyimpan file
    saveAs(blob, `Laporan-Penjualan-${dayjs().format("YYYY-MM-DD")}.xlsx`);
    message.success("Laporan berhasil diekspor ke Excel!");
  };

  const columns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      render: (val) =>
        val?.toDate ? dayjs(val.toDate()).format("DD-MM-YYYY HH:mm") : "-",
    },
    {
      title: "Pelanggan",
      dataIndex: "customer",
      render: (text) => text || "-",
    },
    {
      title: "Item",
      dataIndex: "items",
      render: (items) => (
        <ul>
          {items.map((item, index) => (
            <li key={index}>
              {item.itemName} ({item.quantity}) - Rp{" "}
              {item.pricePerUnit?.toLocaleString()}
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: "Platform",
      dataIndex: "platform",
      render: (text) => text || "-",
    },
    {
      title: "Total Pendapatan",
      dataIndex: "total",
      render: (val) => (val != null ? `Rp ${val.toLocaleString()}` : "-"),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (status) => status || "-",
    },
  ];

  return (
    <div>
      <h2>Laporan Penjualan</h2>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card>
            <Statistic
              title="Total Pendapatan"
              value={`Rp ${totalRevenue.toLocaleString()}`}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic title="Jumlah Transaksi" value={totalSalesCount} />
          </Card>
        </Col>
      </Row>
      <Card title="Detail Penjualan">
        {/* --- Perbaikan: Menambahkan tombol ekspor */}
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
