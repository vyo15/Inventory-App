import React, { useEffect, useMemo, useState } from "react";
import { Button, Table, Tag, message } from "antd";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { db } from "../../firebase";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";

// =========================
// ACTIVE / FINAL - label source IMS untuk Profit Loss
// Fungsi blok:
// - membuat source reference payroll/pembelian/penjualan lebih mudah diaudit;
// - Profit Loss tetap membaca expenses/incomes, bukan menghitung payroll langsung agar tidak double.
// Status: aktif dipakai; guarded untuk mencegah double counting payroll.
// =========================
const resolveFinancialSourceLabel = (item = {}) => {
  if (item.sourceModule === "production_payroll") return "Payroll Produksi";
  if (item.sourceModule === "purchases") return "Pembelian";
  if (item.sourceModule === "sales") return "Penjualan";
  return item.sourceModule || item.sourceCollection || "-";
};

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

  // =========================
  // SECTION: Export laporan laba rugi
  // Fungsi:
  // - mengekspor gabungan revenues, incomes, dan expenses ke XLSX profesional
  // - tetap menjaga source collection asli agar audit laporan tetap mudah ditelusuri
  // Status:
  // - aktif dipakai sebagai jalur export final laporan laba rugi
  // - sheet name distandarkan untuk Task 5 agar XLSX mudah dikenali user
  // =========================
  const exportToExcel = async () => {
    await exportJsonToExcel({
      title: "Laporan Laba Rugi IMS Bunga Flanel",
      subtitle: "Ekspor mengikuti gabungan revenues, incomes, dan expenses pada halaman ini.",
      sheetName: "Profit Loss",
      fileName: "Laporan-Laba-Rugi",
      columns: [
        { header: "Tanggal", key: "transactionDate", width: 18 },
        { header: "Aliran Kas", key: "cashFlowType", width: 16 },
        { header: "Sumber", key: "sourceCollection", width: 22 },
        { header: "Referensi", key: "sourceReference", width: 24 },
        { header: "Tipe", key: "transactionType", width: 24 },
        { header: "Deskripsi", key: "transactionDescription", width: 42 },
        { header: "Jumlah", key: "transactionAmount", width: 18 },
      ],
      data: reportData.map((item) => ({
        transactionDate: formatDateId(item.date, true),
        cashFlowType: item.flow || "-",
        sourceCollection: resolveFinancialSourceLabel(item),
        sourceReference: item.sourceRef || item.sourceId || "-",
        transactionType: item.type || "-",
        transactionDescription: item.description || "-",
        transactionAmount: formatCurrencyId(item.amount),
      })),
    });
    message.success("Laporan laba rugi berhasil diekspor ke Excel.");
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
        key: "sourceCollection",
        render: (_, record) => {
          const label = resolveFinancialSourceLabel(record);
          const color = record.flow === "Pengeluaran" ? "red" : "green";
          return (
            <div>
              <Tag color={color}>{label}</Tag>
              {record.sourceRef ? (
                <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 4 }}>
                  Ref: {record.sourceRef}
                </div>
              ) : null}
            </div>
          );
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
        subtitle="Laporan ini membaca revenues, incomes, dan expenses sebagai source final. Payroll paid masuk melalui expenses agar tidak dihitung dobel dari production_payrolls."
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
        <Table
          // AKTIF / GUARDED UI: class standar hanya visual; kalkulasi laba rugi dan sumber revenues/incomes/expenses tetap sama.
          className="app-data-table"
          dataSource={reportData}
          columns={columns}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: <EmptyStateBlock description="Belum ada data laba rugi untuk ditampilkan." />,
          }}
        />
      </PageSection>
    </>
  );
};

export default ProfitLossReport;
