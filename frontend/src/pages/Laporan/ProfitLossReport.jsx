import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  App as AntdApp,
  Button,
  Tag,
} from "antd";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageContentCanvas from "../../components/Layout/Page/PageContentCanvas";
import PageSection from "../../components/Layout/Page/PageSection";
import ReportPeriodFilterSection from "./components/ReportPeriodFilterSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { fetchProfitLossReportData } from "../../services/Laporan/reportsService";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import { getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";
import {
  getDefaultReportDateRange,
  buildReportPeriodFilterLines,
  getReportDateRangeLabel,
  normalizeReportDateRange,
} from "../../utils/reports/reportDateRange";

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
  const { message } = AntdApp.useApp();
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(getDefaultReportDateRange);

  const dateRangeBounds = useMemo(() => normalizeReportDateRange(dateRange), [dateRange]);

  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      try {
        const mergedData = await fetchProfitLossReportData({ dateRangeBounds });
        setReportData(mergedData);
      } catch (error) {
        console.error("Gagal mengambil data laporan laba rugi:", error);
        message.error("Gagal memuat laporan laba rugi.");
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [dateRangeBounds, message]);

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
      filters: buildReportPeriodFilterLines(dateRange),
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
        sourceReference: resolveDisplayReference(item, { fallback: item.sourceRef || item.sourceId || "-", allowTechnicalId: true }),
        transactionType: item.type || "-",
        transactionDescription: item.description || "-",
        transactionAmount: formatCurrencyId(item.amount),
      })),
    });
    message.success("Laporan laba rugi berhasil diekspor ke Excel.");
  };

  const profitLossMobileCardConfig = useMemo(
    () => ({
      title: (record) => record.description || record.type || resolveFinancialSourceLabel(record),
      subtitle: (record) => [
        formatDateId(record.date, true),
        resolveFinancialSourceLabel(record),
        resolveDisplayReference(record, { fallback: record.sourceRef || "" }) || null,
      ],
      tags: (record) => <Tag color={record.flow === "Pemasukan" ? "green" : "red"}>{record.flow || "-"}</Tag>,
      meta: [
        {
          label: "Jumlah",
          value: (record) => `${record.flow === "Pengeluaran" ? "-" : "+"} ${formatCurrencyId(record.amount)}`,
        },
        { label: "Tipe", value: (record) => record.type || "-" },
      ],
    }),
    [],
  );

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
          const referenceText = resolveDisplayReference(record, { fallback: record.sourceRef || "" });
          return (
            <div>
              <Tag color={color}>{label}</Tag>
              {referenceText ? (
                <div className="ims-cell-meta" style={{ marginTop: 4 }}>
                  Ref: {referenceText}
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
        subtitle="Laporan membaca pemasukan dan pengeluaran final."
      />

      <PageContentCanvas>

      <ReportPeriodFilterSection
        value={dateRange}
        onChange={setDateRange}
        subtitle="Report membaca revenues, incomes, dan expenses sesuai tanggal transaksi, bukan seluruh collection."
      />

      <PageSection
        title="Ringkasan Keuangan"
        subtitle="Ringkasan pendapatan, biaya, dan laba."
      >
        <SummaryStatGrid
          items={summaryItems}
          columns={{ xs: 24, md: 8 }}
          variant="finance"
          highlightKey="gross-profit"
        />
      </PageSection>

      <PageSection
        title="Detail Transaksi Keuangan"
        subtitle={`Data source collection periode ${getReportDateRangeLabel(dateRange)}.`}
        extra={
          <Button type="primary" onClick={exportToExcel} disabled={reportData.length === 0}>
            Ekspor ke Excel
          </Button>
        }
      >
        <DataTableView
          // AKTIF / GUARDED UI: class standar hanya visual; kalkulasi laba rugi dan sumber revenues/incomes/expenses tetap sama.
          loading={loading}
          showRefreshIndicator
          className="app-data-table"
          dataSource={reportData}
          columns={columns}
          rowKey="id"
          mobileCardConfig={profitLossMobileCardConfig}
          locale={{
            emptyText: getDataTableEmptyText(loading, "Belum ada data laba rugi untuk ditampilkan."),
          }}
        />
      </PageSection>
      </PageContentCanvas>
    </>
  );
};

export default ProfitLossReport;
