import React, { useEffect, useMemo, useState } from "react";
import { Button, Col, DatePicker, Table, Tag, message } from "antd";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { fetchSalesReportData } from "../../services/Laporan/reportsService";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import { formatNumberId } from "../../utils/formatters/numberId";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";
import {
  getDefaultReportDateRange,
  getReportDateRangeLabel,
  normalizeReportDateRange,
} from "../../utils/reports/reportDateRange";

const { RangePicker } = DatePicker;

const SalesReport = () => {
  // =========================
  // SECTION: State utama laporan
  // =========================
  const [salesData, setSalesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(getDefaultReportDateRange);

  const dateRangeBounds = useMemo(() => normalizeReportDateRange(dateRange), [dateRange]);

  // =========================
  // SECTION: Fetch data laporan penjualan
  // Catatan business rule:
  // - source laporan tetap membaca collection sales
  // - refactor ini hanya menata presentasi, bukan mengubah sumber laporan
  // =========================
  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      try {
        const data = await fetchSalesReportData({ dateRangeBounds });
        setSalesData(data);
      } catch (error) {
        console.error("Gagal mengambil data laporan penjualan:", error);
        message.error("Gagal memuat laporan penjualan.");
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, [dateRangeBounds]);

  // =========================
  // SECTION: Summary data
  // =========================
  const summary = useMemo(() => {
    return salesData.reduce(
      (accumulator, item) => {
        const total = Math.round(Number(item.total || 0));
        accumulator.totalRevenue += total;
        accumulator.totalSalesCount += 1;

        if ((item.status || "") === "Selesai") {
          accumulator.totalCompletedRevenue += total;
          accumulator.totalCompletedCount += 1;
        }

        return accumulator;
      },
      {
        totalRevenue: 0,
        totalSalesCount: 0,
        totalCompletedRevenue: 0,
        totalCompletedCount: 0,
      },
    );
  }, [salesData]);

  const summaryItems = useMemo(
    () => [
      {
        key: "all-revenue",
        title: "Total Omzet Semua Transaksi",
        value: formatCurrencyId(summary.totalRevenue),
        subtitle: "Total nominal seluruh transaksi sales.",
        accent: "primary",
      },
      {
        key: "sales-count",
        title: "Jumlah Transaksi",
        value: formatNumberId(summary.totalSalesCount),
        subtitle: "Jumlah dokumen penjualan yang tercatat.",
        accent: "success",
      },
      {
        key: "completed-revenue",
        title: "Omzet Status Selesai",
        value: formatCurrencyId(summary.totalCompletedRevenue),
        subtitle: "Bagian omzet dari transaksi berstatus selesai.",
        accent: "warning",
      },
      {
        key: "completed-count",
        title: "Transaksi Selesai",
        value: formatNumberId(summary.totalCompletedCount),
        subtitle: "Jumlah transaksi dengan status selesai.",
        accent: "danger",
      },
    ],
    [summary],
  );

  // =========================
  // SECTION: Export helper
  // =========================
  // =========================
  // SECTION: Export laporan penjualan
  // Fungsi:
  // - mengekspor data penjualan aktif ke XLSX dengan format yang lebih siap pakai
  // - tetap mengikuti source laporan penjualan dari collection sales
  // Status:
  // - aktif dipakai sebagai jalur export final laporan penjualan
  // - sheet name distandarkan untuk Task 5 agar XLSX mudah dikenali user
  // =========================
  const exportToExcel = async () => {
    await exportJsonToExcel({
      title: "Laporan Penjualan IMS Bunga Flanel",
      subtitle: "Ekspor mengikuti data penjualan yang sedang tampil di halaman ini.",
      sheetName: "Sales Report",
      fileName: "Laporan-Penjualan",
      filters: [
        `Periode: ${getReportDateRangeLabel(dateRange)}`,
      ],
      columns: [
        { header: "Ref Transaksi", key: "salesReference", width: 24 },
        { header: "Tanggal", key: "salesDate", width: 18 },
        { header: "Pelanggan", key: "customerName", width: 24 },
        { header: "Channel", key: "salesChannel", width: 18 },
        { header: "Resi / Referensi", key: "referenceNumber", width: 24 },
        { header: "Item Terjual", key: "soldItems", width: 42 },
        { header: "Total", key: "salesTotal", width: 18 },
        { header: "Status", key: "salesStatus", width: 16 },
        { header: "Catatan", key: "salesNote", width: 40 },
      ],
      data: salesData.map((sale) => ({
        salesReference: resolveDisplayReference(sale, { fallback: sale.id, allowTechnicalId: true }),
        salesDate: formatDateId(sale.date, true),
        customerName: sale.customerName || "-",
        salesChannel: sale.salesChannel || "-",
        referenceNumber: resolveDisplayReference(sale, { fallback: sale.referenceNumber || "-" }),
        soldItems: (sale.items || [])
          .map((item) => `${item.itemName} (${formatNumberId(item.quantity)} ${item.unit || "pcs"})`)
          .join("; ") || "-",
        salesTotal: formatCurrencyId(sale.total),
        salesStatus: sale.status || "-",
        salesNote: sale.note || "-",
      })),
    });
    message.success("Laporan penjualan berhasil diekspor ke Excel.");
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
        title: "Pelanggan",
        dataIndex: "customerName",
        key: "customerName",
        render: (value) => value || "-",
      },
      {
        title: "Item",
        dataIndex: "items",
        key: "items",
        // IMS NOTE [AKTIF/GUARDED] - Display quantity laporan sales
        // Fungsi blok: memastikan qty item laporan memakai formatter global no-decimal.
        // Hubungan flow: hanya display report; source data dan formula sales report tidak diubah.
        // Behavior: behavior-preserving untuk kalkulasi, tampilan qty menjadi konsisten tanpa decimal.
        render: (items) =>
          Array.isArray(items) && items.length > 0 ? (
            <ul style={{ paddingLeft: 18, margin: 0 }}>
              {items.map((item, index) => (
                <li key={`${item.itemName}-${index}`}>
                  {item.itemName} ({formatNumberId(item.quantity)} {item.unit || "pcs"}) - {formatCurrencyId(item.pricePerUnit)}
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
        key: "salesChannel",
        render: (value) => value || "-",
      },
      {
        title: "Resi / Referensi",
        key: "referenceNumber",
        render: (_, record) => resolveDisplayReference(record, { fallback: record.referenceNumber || "-" }),
      },
      {
        title: "Total",
        dataIndex: "total",
        key: "total",
        render: (value) => formatCurrencyId(value),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status) => {
          const statusColors = {
            Selesai: "green",
            Dikirim: "orange",
            Diproses: "blue",
          };

          return <Tag color={statusColors[status] || "default"}>{status || "-"}</Tag>;
        },
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Laporan Penjualan"
        subtitle="Laporan membaca data sales aktif."
      />

      <PageSection
        title="Filter Periode"
        subtitle="Report membaca data sales sesuai tanggal transaksi, bukan seluruh collection."
      >
        <FilterBar surface={false}>
          <Col xs={24} md={10} lg={8}>
            <RangePicker
              style={{ width: "100%" }}
              format="DD/MM/YYYY"
              value={dateRange}
              allowClear={false}
              onChange={(value) => setDateRange(value || getDefaultReportDateRange())}
            />
          </Col>
        </FilterBar>
      </PageSection>

      <PageSection
        title="Ringkasan Penjualan"
        subtitle="Ringkasan performa transaksi."
      >
        <SummaryStatGrid items={summaryItems} columns={{ xs: 24, sm: 12, md: 12, lg: 6 }} variant="finance" />
      </PageSection>

      <PageSection
        title="Detail Penjualan"
        subtitle={`Data sales periode ${getReportDateRangeLabel(dateRange)}.`}
        extra={
          <Button type="primary" onClick={exportToExcel} disabled={salesData.length === 0}>
            Ekspor ke Excel
          </Button>
        }
      >
        <DataRefreshIndicator loading={loading} dataSource={salesData} />
        <Table
          // AKTIF / GUARDED UI: class standar hanya visual; sales status, income recognition, dan report calculation tidak diubah.
          className="app-data-table"
          dataSource={salesData}
          columns={columns}
          rowKey="id"
          locale={{
            emptyText: getDataTableEmptyText(loading, <EmptyStateBlock description="Belum ada data penjualan untuk ditampilkan." />),
          }}
        />
      </PageSection>
    </>
  );
};

export default SalesReport;
