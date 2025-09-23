import React, { useEffect, useState } from "react";
import { Card, Table, message, Row, Col, Statistic, Tag, Button } from "antd"; // Perbaikan: Menambahkan Button
import { collection, query, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const ProfitLossReport = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [grossProfit, setGrossProfit] = useState(0);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const revenuesRef = collection(db, "revenues");
        const expensesRef = collection(db, "expenses");

        const [revenuesSnap, expensesSnap] = await Promise.all([
          getDocs(query(revenuesRef, orderBy("date", "desc"))),
          getDocs(query(expensesRef, orderBy("date", "desc"))),
        ]);

        const revenues = revenuesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          flow: "Pemasukan",
        }));
        const expenses = expensesSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          flow: "Pengeluaran",
        }));

        const mergedData = [...revenues, ...expenses].sort(
          (a, b) => b.date.toDate() - a.date.toDate()
        );
        setReportData(mergedData);

        const totalRev = revenues.reduce(
          (sum, item) => sum + (item.amount || 0),
          0
        );
        const totalCst = expenses.reduce(
          (sum, item) => sum + (item.amount || 0),
          0
        );
        setTotalRevenue(totalRev);
        setTotalCost(totalCst);
        setGrossProfit(totalRev - totalCst);
      } catch (error) {
        console.error("Gagal mengambil data laporan laba rugi:", error);
        message.error("Gagal memuat laporan laba rugi.");
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, []);

  const exportToExcel = () => {
    const exportData = reportData.map((item) => ({
      Tanggal: dayjs(item.date?.toDate()).format("DD-MM-YYYY HH:mm"),
      "Aliran Kas": item.flow,
      Deskripsi: item.description,
      Jumlah: item.amount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Laba Rugi");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });

    saveAs(blob, `Laporan-Laba-Rugi-${dayjs().format("YYYY-MM-DD")}.xlsx`);
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
      title: "Aliran Kas",
      dataIndex: "flow",
      render: (flow) => {
        const color = flow === "Pemasukan" ? "green" : "red";
        return <Tag color={color}>{flow}</Tag>;
      },
    },
    {
      title: "Deskripsi",
      dataIndex: "description",
    },
    {
      title: "Jumlah",
      dataIndex: "amount",
      render: (val, record) => {
        const sign = record.flow === "Pengeluaran" ? "-" : "+";
        const color = record.flow === "Pemasukan" ? "green" : "red";
        return (
          <span style={{ color }}>
            {sign} Rp {val != null ? val.toLocaleString() : "-"}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <h2>Laporan Laba Rugi</h2>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Pendapatan"
              value={`Rp ${totalRevenue.toLocaleString()}`}
              precision={2}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Total Biaya"
              value={`Rp ${totalCost.toLocaleString()}`}
              precision={2}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Laba Kotor"
              value={`Rp ${grossProfit.toLocaleString()}`}
              precision={2}
              valueStyle={{ color: grossProfit >= 0 ? "#3f8600" : "#cf1322" }}
            />
          </Card>
        </Col>
      </Row>
      <Card title="Detail Transaksi Keuangan">
        <div style={{ marginBottom: 16, textAlign: "right" }}>
          <Button
            type="primary"
            onClick={exportToExcel}
            disabled={reportData.length === 0}
          >
            Ekspor ke Excel
          </Button>
        </div>
        <Table
          dataSource={reportData}
          columns={columns}
          rowKey="id"
          loading={loading}
        />
      </Card>
    </div>
  );
};

export default ProfitLossReport;
