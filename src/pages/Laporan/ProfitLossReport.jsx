import React, { useEffect, useMemo, useState } from "react";
import { Button, Table, Tag, message } from "antd";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import dayjs from "dayjs";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { db } from "../../firebase";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";

const ProfitLossReport = () => {
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const [revenuesSnap, incomesSnap, expensesSnap] = await Promise.all([
          getDocs(query(collection(db, "revenues"), orderBy("date", "desc"))),
          getDocs(query(collection(db, "incomes"), orderBy("date", "desc"))),
          getDocs(query(collection(db, "expenses"), orderBy("date", "desc"))),
        ]);

        const revenues = revenuesSnap.docs.map((documentItem) => ({
          id: `revenues-${documentItem.id}`,
          sourceCollection: "revenues",
          ...documentItem.data(),
          flow: "Pemasukan",
        }));

        const incomes = incomesSnap.docs.map((documentItem) => ({
          id: `incomes-${documentItem.id}`,
          sourceCollection: "incomes",
          ...documentItem.data(),
          flow: "Pemasukan",
        }));

        const expenses = expensesSnap.docs.map((documentItem) => ({
          id: `expenses-${documentItem.id}`,
          sourceCollection: "expenses",
          ...documentItem.data(),
          flow: "Pengeluaran",
        }));

        const mergedData = [...revenues, ...incomes, ...expenses].sort((left, right) => {
          const leftTime = left.date?.toDate ? left.date.toDate().getTime() : 0;
          const rightTime = right.date?.toDate ? right.date.toDate().getTime() : 0;
          return rightTime - leftTime;
        });

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

  const summary = useMemo(() => {
    return reportData.reduce(
      (accumulator, item) => {
        const amount = Math.round(Number(item.amount || 0));

        if (item.flow === "Pemasukan") {
          accumulator.totalRevenue += amount;
        } else if (item.flow === "Pengeluaran") {
          accumulator.totalCost += amount;
        }

        return accumulator;
      },
      {
        totalRevenue: 0,
        totalCost: 0,
      },
    );
  }, [reportData]);

  const grossProfit = summary.totalRevenue - summary.totalCost;

  const summaryItems = useMemo(
    () => [
      {
        key: "revenue-total",
        title: "Total Pendapatan",
        value: formatCurrencyId(summary.totalRevenue),
        subtitle: "Gabungan revenues dan incomes.",
        accent: "success",
      },
      {
        key: "cost-total",
        title: "Total Biaya",
        value: formatCurrencyId(summary.totalCost),
        subtitle: "Seluruh expenses yang diakui pada laporan.",
        accent: "danger",
      },
      {
        key: "gross-profit",
        title: "Laba Kotor",
        value: formatCurrencyId(grossProfit),
        subtitle: grossProfit >= 0 ? "Positif" : "Negatif",
        accent: grossProfit >= 0 ? "primary" : "warning",
      },
    ],
    [grossProfit, summary],
  );

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

  const columns = useMemo(
    () => [
      {
        title: "Tanggal",
        dataIndex: "date",
        key: "date",
        render: (value) => formatDateId(value, true),
      },
      {
        title: "Aliran Kas",
        dataIndex: "flow",
        key: "flow",
        render: (flow) => {
          const color = flow === "Pemasukan" ? "green" : "red";
          return <Tag color={color}>{flow}</Tag>;
        },
      },
      {
        title: "Sumber",
        dataIndex: "sourceCollection",
        key: "sourceCollection",
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
        key: "type",
        render: (value) => value || "-",
      },
      {
        title: "Deskripsi",
        dataIndex: "description",
        key: "description",
        render: (value) => value || "-",
      },
      {
        title: "Jumlah",
        dataIndex: "amount",
        key: "amount",
        render: (value, record) => {
          const amount = Math.round(Number(value || 0));
          const sign = record.flow === "Pengeluaran" ? "-" : "+";
          const color = record.flow === "Pemasukan" ? "green" : "red";

          return <span style={{ color }}>{`${sign} ${formatCurrencyId(amount)}`}</span>;
        },
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Laporan Laba Rugi"
        subtitle="Laporan ini tetap menggabungkan revenues, incomes, dan expenses sesuai business rule aktif, lalu dirapikan ke UI shared yang seragam."
      />

      <PageSection
        title="Ringkasan Keuangan"
        subtitle="Ringkasan membantu membaca total pendapatan, total biaya, dan laba kotor secara cepat."
      >
        <SummaryStatGrid items={summaryItems} columns={{ xs: 24, md: 8 }} />
      </PageSection>

      <PageSection
        title="Detail Transaksi Keuangan"
        subtitle="Semua baris tetap mengikuti source collection asli tanpa perubahan perhitungan data."
        extra={
          <Button type="primary" onClick={exportToExcel} disabled={reportData.length === 0}>
            Ekspor ke Excel
          </Button>
        }
      >
        {/* =========================
            SECTION: tabel laba rugi baseline global
            Fungsi:
            - mengunci surface laporan ke pattern yang sama dengan report lain
            - tabel tetap read-only dan tidak menambah aksi di luar export
            Status: aktif / final
        ========================= */}
        <Table
          className="app-data-table"
          dataSource={reportData}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 980 }}
          locale={{
            emptyText: <EmptyStateBlock description="Belum ada data laba rugi untuk ditampilkan." />,
          }}
        />
      </PageSection>
    </>
  );
};

export default ProfitLossReport;
