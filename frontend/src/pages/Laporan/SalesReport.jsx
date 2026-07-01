import {
  useEffect,
  useMemo,
  useState } from "react";
import { App,
  Button,
  Col,
  DatePicker,
} from "antd";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageContentCanvas from "../../components/Layout/Page/PageContentCanvas";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { fetchSalesReportData } from "../../services/Laporan/reportsService";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import { formatNumberId } from "../../utils/formatters/numberId";
import { getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import StatusTag from "../../components/Layout/Feedback/StatusTag";
import { getSalesStatusColor } from "../Transaksi/helpers/salesPageHelpers";
import {
  buildSalesChannelSummary,
  getSalesChannelLabel,
  isMarketplaceSalesChannel,
} from "../../constants/salesChannelOptions";
import {
  getDefaultReportDateRange,
  buildReportPeriodFilterLines,
  getReportDateRangeLabel,
  normalizeReportDateRange,
} from "../../utils/reports/reportDateRange";

const { RangePicker } = DatePicker;

const toSafeText = (value = "") => String(value ?? "").trim();

const getSalesInternalReference = (sale = {}) =>
  toSafeText(sale.saleNumber || sale.code || sale.sourceRef || sale.referenceNumber) || "-";

const getSalesMarketplaceReference = (sale = {}) => {
  if (!isMarketplaceSalesChannel(sale.salesChannel)) {
    return "-";
  }

  const internalReferences = new Set([
    toSafeText(sale.saleNumber),
    toSafeText(sale.code),
    toSafeText(sale.sourceRef),
    getSalesInternalReference(sale),
  ].filter(Boolean));

  const referenceCandidates = [
    sale.externalReferenceNumber,
    sale.marketplaceOrderNumber,
    sale.marketplaceReferenceNumber,
    sale.orderNumber,
    sale.referenceNumber,
  ];

  const marketplaceReference = referenceCandidates
    .map(toSafeText)
    .find((candidate) => candidate && !internalReferences.has(candidate));

  return marketplaceReference || "-";
};

const SalesReport = () => {
  const { message } = App.useApp();
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
  }, [dateRangeBounds, message]);

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
  // SECTION: Ringkasan channel laporan penjualan
  // Fungsi:
  // - memakai helper channel yang sama dengan halaman Sales agar laporan dan transaksi tidak beda label/urutan.
  // - hanya read/display; tidak mengubah sales source, income timing, stok, atau export formula.
  // =========================
  const salesChannelSummaryItems = useMemo(
    () => buildSalesChannelSummary(salesData),
    [salesData],
  );

  const salesChannelSummaryColumns = useMemo(
    () => [
      {
        title: "Channel",
        key: "channel",
        width: 210,
        render: (_, record) => (
          <div className="ims-cell-stack ims-cell-stack-tight">
            <strong>{record.channel}</strong>
            <span className="ims-cell-meta">
              {record.groupLabel} • {formatNumberId(record.transactionCount)} transaksi
            </span>
          </div>
        ),
      },
      {
        title: "Omzet",
        key: "totalAmount",
        width: 150,
        align: "right",
        render: (_, record) => <strong>{formatCurrencyId(record.totalAmount)}</strong>,
      },
      {
        title: "Selesai",
        key: "completedAmount",
        width: 145,
        align: "right",
        render: (_, record) => (
          <div className="ims-cell-stack ims-cell-stack-tight" style={{ alignItems: "flex-end" }}>
            <strong>{formatCurrencyId(record.completedAmount)}</strong>
            <span className="ims-cell-meta">{formatNumberId(record.completedCount)} transaksi</span>
          </div>
        ),
      },
      {
        title: "Pending",
        key: "pendingAmount",
        width: 145,
        align: "right",
        render: (_, record) => (
          <div className="ims-cell-stack ims-cell-stack-tight" style={{ alignItems: "flex-end" }}>
            <strong>{formatCurrencyId(record.pendingAmount)}</strong>
            <span className="ims-cell-meta">{formatNumberId(record.pendingCount)} transaksi</span>
          </div>
        ),
      },
    ],
    [],
  );

  const salesChannelSummaryMobileCardConfig = useMemo(
    () => ({
      title: (record) => record.channel || "Channel penjualan",
      subtitle: (record) => [record.groupLabel, `${formatNumberId(record.transactionCount)} transaksi`],
      meta: [
        { label: "Omzet", value: (record) => formatCurrencyId(record.totalAmount) },
        { label: "Selesai", value: (record) => `${formatCurrencyId(record.completedAmount)} / ${formatNumberId(record.completedCount)} trx` },
        { label: "Pending", value: (record) => `${formatCurrencyId(record.pendingAmount)} / ${formatNumberId(record.pendingCount)} trx` },
      ],
    }),
    [],
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
      filters: buildReportPeriodFilterLines(dateRange),
      columns: [
        { header: "Ref Transaksi", key: "salesReference", width: 24 },
        { header: "Tanggal", key: "salesDate", width: 18 },
        { header: "Pelanggan", key: "customerName", width: 24 },
        { header: "Channel", key: "salesChannel", width: 18 },
        { header: "Order Marketplace / Resi", key: "marketplaceReference", width: 28 },
        { header: "Item Terjual", key: "soldItems", width: 42 },
        { header: "Total", key: "salesTotal", width: 18 },
        { header: "Status", key: "salesStatus", width: 16 },
        { header: "Catatan", key: "salesNote", width: 40 },
      ],
      data: salesData.map((sale) => ({
        salesReference: getSalesInternalReference(sale),
        salesDate: formatDateId(sale.date, true),
        customerName: sale.customerName || "-",
        salesChannel: getSalesChannelLabel(sale.salesChannel),
        marketplaceReference: getSalesMarketplaceReference(sale),
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

  const salesReportMobileCardConfig = useMemo(
    () => ({
      title: (record) => getSalesInternalReference(record),
      subtitle: (record) => [
        formatDateId(record.date, true),
        record.customerName || "Tanpa pelanggan",
        getSalesChannelLabel(record.salesChannel),
      ],
      tags: (record) => (
        <StatusTag color={getSalesStatusColor(record.status)}>{record.status || "-"}</StatusTag>
      ),
      meta: [
        { label: "Total", value: (record) => formatCurrencyId(record.total) },
        { label: "Marketplace/Resi", value: (record) => getSalesMarketplaceReference(record) },
      ],
      subtext: (record) => {
        const items = Array.isArray(record.items) ? record.items : [];
        if (!items.length) return "Item: -";
        const firstItem = items[0];
        const moreCount = Math.max(items.length - 1, 0);
        return `Item: ${firstItem.itemName || "-"} (${formatNumberId(firstItem.quantity)} ${firstItem.unit || "pcs"})${moreCount ? ` +${formatNumberId(moreCount)} item` : ""}`;
      },
    }),
    [],
  );

  const columns = useMemo(
    () => [
      {
        title: "Tanggal",
        dataIndex: "date",
        key: "date",
        width: 150,
        render: (value) => formatDateId(value, true),
      },
      {
        title: "Ref Transaksi",
        key: "salesReference",
        width: 170,
        render: (_, record) => getSalesInternalReference(record),
      },
      {
        title: "Pelanggan",
        dataIndex: "customerName",
        key: "customerName",
        width: 170,
        render: (value) => value || "-",
      },
      {
        title: "Item",
        dataIndex: "items",
        key: "items",
        width: 320,
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
        width: 145,
        render: (value) => getSalesChannelLabel(value),
      },
      {
        title: "Order Marketplace / Resi",
        key: "marketplaceReference",
        width: 190,
        render: (_, record) => getSalesMarketplaceReference(record),
      },
      {
        title: "Total",
        dataIndex: "total",
        key: "total",
        width: 150,
        render: (value) => formatCurrencyId(value),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 120,
        render: (status) => (
          <StatusTag color={getSalesStatusColor(status)}>{status || "-"}</StatusTag>
        ),
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

      <PageContentCanvas>

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
        title="Performa Channel"
        subtitle="Ringkasan omzet per channel pada periode laporan."
      >
        <DataTableView
          className="app-data-table"
          dataSource={salesChannelSummaryItems}
          columns={salesChannelSummaryColumns}
          rowKey="key"
          pagination={false}
          size="small"
          tableLayout="fixed"
          loading={loading}
          showRefreshIndicator={false}
          scroll={{ x: 650 }}
          mobileCardConfig={salesChannelSummaryMobileCardConfig}
          locale={{
            emptyText: getDataTableEmptyText(
              loading,
              <EmptyStateBlock description="Belum ada channel penjualan pada periode ini." />,
            ),
          }}
        />
        <div className="ims-readonly-panel-note">
          Channel tanpa transaksi disembunyikan. Pending adalah transaksi Diproses/Dikirim dan belum menjadi kas resmi.
        </div>
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
        <DataTableView
          // AKTIF / GUARDED UI: class standar hanya visual; sales status, income recognition, dan report calculation tidak diubah.
          loading={loading}
          showRefreshIndicator
          className="app-data-table"
          dataSource={salesData}
          columns={columns}
          rowKey="id"
          scroll={{ x: 1245 }}
          mobileCardConfig={salesReportMobileCardConfig}
          locale={{
            emptyText: getDataTableEmptyText(loading, "Belum ada data penjualan untuk ditampilkan."),
          }}
        />
      </PageSection>
      </PageContentCanvas>
    </>
  );
};

export default SalesReport;
