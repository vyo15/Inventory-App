import React, { useEffect, useState } from "react";
import { Card, Table, message, Row, Col, Statistic, Button } from "antd";
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const PurchasesReport = () => {
  const [purchasesData, setPurchasesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);
  const [totalPurchaseCount, setTotalPurchaseCount] = useState(0);

  useEffect(() => {
    const fetchPurchases = async () => {
      setLoading(true);
      try {
        const purchasesRef = collection(db, "purchases");
        const q = query(purchasesRef, orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        const total = data.reduce(
          (sum, item) => sum + (item.totalPrice || 0),
          0
        );
        setTotalCost(total);
        setTotalPurchaseCount(data.length);
        setPurchasesData(data);
      } catch (error) {
        console.error("Gagal mengambil data laporan pembelian:", error);
        message.error("Gagal memuat laporan pembelian.");
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, []);

  const exportToExcel = () => {
    const exportData = purchasesData.map((purchase) => ({
      "ID Transaksi": purchase.id,
      Tanggal: dayjs(purchase.date?.toDate()).format("DD-MM-YYYY HH:mm"),
      Supplier: purchase.supplierName,
      Item: purchase.itemName,
      Jumlah: purchase.quantity,
      "Harga Beli": purchase.purchasePrice,
      "Total Biaya": purchase.totalPrice,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Pembelian");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });

    saveAs(blob, `Laporan-Pembelian-${dayjs().format("YYYY-MM-DD")}.xlsx`);
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
      title: "Supplier",
      dataIndex: "supplierName",
      render: (text) => text || "-",
    },
    { title: "Item", dataIndex: "itemName" },
    { title: "Jumlah", dataIndex: "quantity" },
    {
      title: "Harga Beli",
      dataIndex: "purchasePrice",
      render: (val) => (val != null ? `Rp ${val.toLocaleString()}` : "-"),
    },
    {
      title: "Total Biaya",
      dataIndex: "totalPrice",
      render: (val) => (val != null ? `Rp ${val.toLocaleString()}` : "-"),
    },
  ];

  return (
    <div>
      <h2>Laporan Pembelian</h2>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card>
            <Statistic
              title="Total Biaya Pembelian"
              value={`Rp ${totalCost.toLocaleString()}`}
              precision={2}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic title="Jumlah Transaksi" value={totalPurchaseCount} />
          </Card>
        </Col>
      </Row>
      <Card title="Detail Pembelian">
        <div style={{ marginBottom: 16, textAlign: "right" }}>
          <Button
            type="primary"
            onClick={exportToExcel}
            disabled={purchasesData.length === 0}
          >
            Ekspor ke Excel
          </Button>
        </div>
        <Table
          dataSource={purchasesData}
          columns={columns}
          rowKey="id"
          loading={loading}
        />
      </Card>
    </div>
  );
};

export default PurchasesReport;
