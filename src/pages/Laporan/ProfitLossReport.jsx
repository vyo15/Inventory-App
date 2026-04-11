import React, { useEffect, useMemo, useState } from "react";
import { Card, Table, message, Row, Col, Statistic, Tag, Button } from "antd";
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

const ProfitLossReport = () => {
  // SECTION: state utama laporan laba rugi
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  // SECTION: ambil data pemasukan dan pengeluaran
  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const revenuesRef = collection(db, "revenues");
        const incomesRef = collection(db, "incomes");
        const expensesRef = collection(db, "expenses");

        const [revenuesSnap, incomesSnap, expensesSnap] = await Promise.all([
          getDocs(query(revenuesRef, orderBy("date", "desc"))),
          getDocs(query(incomesRef, orderBy("date", "desc"))),
          getDocs(query(expensesRef, orderBy("date", "desc"))),
        ]);

        const revenues = revenuesSnap.docs.map((docItem) => ({
          id: `revenues-${docItem.id}`,
          sourceCollection: "revenues",
          ...docItem.data(),
          flow: "Pemasukan",
        }));

        const incomes = incomesSnap.docs.map((docItem) => ({
          id: `incomes-${docItem.id}`,
          sourceCollection: "incomes",
          ...docItem.data(),
          flow: "Pemasukan",
        }));

        const expenses = expensesSnap.docs.map((docItem) => ({
          id: `expenses-${docItem.id}`,
          sourceCollection: "expenses",
          ...docItem.data(),
          flow: "Pengeluaran",
        }));

        const mergedData = [...revenues, ...incomes, ...expenses].sort(
          (a, b) => {
            const aTime = a.date?.toDate ? a.date.toDate().getTime() : 0;
            const bTime = b.date?.toDate ? b.date.toDate().getTime() : 0;
            return bTime - aTime;
          },
        );

        setReportData(mergedData);
      } catch (error) {
        console.error("Gagal mengambil data laporan laba rugi:", error);
        message.error("Gagal memuat laporan laba rugi.");
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, []);

  // SECTION: hitung total pendapatan, biaya, dan laba kotor
  const summary = useMemo(() => {
    return reportData.reduce(
      (acc, item) => {
        const amount = Math.round(Number(item.amount || 0));

        if (item.flow === "Pemasukan") {
          acc.totalRevenue += amount;
        } else if (item.flow === "Pengeluaran") {
          acc.totalCost += amount;
        }

        return acc;
      },
      {
        totalRevenue: 0,
        totalCost: 0,
      },
    );
  }, [reportData]);

  const grossProfit = summary.totalRevenue - summary.totalCost;

  // SECTION: ekspor excel
  const exportToExcel = async () => {
    const exportData = reportData.map((item) => ({
      Tanggal: item.date?.toDate
        ? dayjs(item.date.toDate()).format("DD-MM-YYYY HH:mm")
        : "-",
      "Aliran Kas": item.flow,
      Sumber: item.sourceCollection || "-",
      Tipe: item.type || "-",
      Deskripsi: item.description || "-",
      Jumlah: Math.round(Number(item.amount || 0)),
    }));

    await exportJsonToExcel({
      data: exportData,
      sheetName: "Laporan Laba Rugi",
      fileName: "Laporan-Laba-Rugi",
    });
    message.success("Laporan berhasil diekspor ke Excel!");
  };

  // SECTION: kolom tabel
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
      title: "Sumber",
      dataIndex: "sourceCollection",
      render: (value) => {
        if (value === "revenues") return <Tag color="blue">revenues</Tag>;
        if (value === "incomes") return <Tag color="green">incomes</Tag>;
        if (value === "expenses") return <Tag color="red">expenses</Tag>;
        return <Tag>-</Tag>;
      },
    },
    {
      title: "Tipe",
      dataIndex: "type",
      render: (text) => text || "-",
    },
    {
      title: "Deskripsi",
      dataIndex: "description",
      render: (text) => text || "-",
    },
    {
      title: "Jumlah",
      dataIndex: "amount",
      render: (val, record) => {
        const amount = Math.round(Number(val || 0));
        const sign = record.flow === "Pengeluaran" ? "-" : "+";
        const color = record.flow === "Pemasukan" ? "green" : "red";

        return (
          <span style={{ color }}>
            {sign} {formatCurrencyIDR(amount)}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <h2>Laporan Laba Rugi</h2>

      {/* SECTION: ringkasan utama */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Total Pendapatan"
              value={summary.totalRevenue}
              formatter={(value) => formatCurrencyIDR(value)}
            />
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Total Biaya"
              value={summary.totalCost}
              formatter={(value) => formatCurrencyIDR(value)}
            />
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card>
            <Statistic
              title="Laba Kotor"
              value={grossProfit}
              formatter={(value) => formatCurrencyIDR(value)}
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
