import { useEffect, useMemo, useState } from "react";
import { Button, Col, DatePicker, Tag, message } from "antd";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { fetchPurchasesReportData } from "../../services/Laporan/reportsService";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import { formatNumberId } from "../../utils/formatters/numberId";
import { getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";
import {
  getDefaultReportDateRange,
  getReportDateRangeLabel,
  normalizeReportDateRange,
} from "../../utils/reports/reportDateRange";

// =========================
// SECTION: Helper saving pembelian
// Catatan:
// - saving tetap dibaca sebagai informasi efisiensi
// - tidak mengubah fakta bahwa laporan pembelian membaca expenses
// =========================
const getSavingMeta = (value) => {
  const amount = Math.round(Number(value || 0));

  if (amount > 0) {
    return {
      label: `Hemat ${formatCurrencyId(amount)}`,
      color: "green",
    };
  }

  if (amount < 0) {
    return {
      label: `Lebih Mahal ${formatCurrencyId(Math.abs(amount))}`,
      color: "red",
    };
  }

  return {
    label: "Sesuai Referensi",
    color: "default",
  };
};

// =========================
// SECTION: Helper label varian laporan pembelian
// Fungsi:
// - menampilkan metadata varian/sumber stok dari expense purchase jika tersedia.
// Status: AKTIF; read-only dan tidak mengubah source data Purchases Report.
// =========================
const getPurchaseVariantLabel = (record = {}) => {
  if (record.variantLabel || record.variantKey) return record.variantLabel || record.variantKey;
  return record.stockSourceType === "variant" ? "Varian" : "Master";
};

const { RangePicker } = DatePicker;

const PurchasesReport = () => {
  const [purchasesData, setPurchasesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(getDefaultReportDateRange);

  const dateRangeBounds = useMemo(() => normalizeReportDateRange(dateRange), [dateRange]);

  useEffect(() => {
    const fetchPurchases = async () => {
      setLoading(true);
      try {
        const data = await fetchPurchasesReportData({ dateRangeBounds });
        setPurchasesData(data);
      } catch (error) {
        console.error("Gagal mengambil data laporan pembelian:", error);
        message.error("Gagal memuat laporan pembelian.");
      } finally {
        setLoading(false);
      }
    };

    fetchPurchases();
  }, [dateRangeBounds]);

  const summary = useMemo(() => {
    return purchasesData.reduce(
      (accumulator, item) => {
        accumulator.totalActual += Math.round(Number(item.amount || 0));
        accumulator.totalReference += Math.round(Number(item.totalReferenceAmount || 0));
        accumulator.totalSaving += Math.round(Number(item.savingAmount || 0));
        accumulator.totalTransactions += 1;
        return accumulator;
      },
      {
        totalActual: 0,
        totalReference: 0,
        totalSaving: 0,
        totalTransactions: 0,
      },
    );
  }, [purchasesData]);

  const summaryItems = useMemo(
    () => [
      {
        key: "total-actual-purchase",
        title: "Total Aktual Pembelian",
        value: formatCurrencyId(summary.totalActual),
        subtitle: "Total expense pembelian yang benar-benar diakui.",
        accent: "danger",
      },
      {
        key: "total-reference-purchase",
        title: "Total Referensi",
        value: formatCurrencyId(summary.totalReference),
        subtitle: "Nilai referensi untuk pembanding efisiensi pembelian.",
        accent: "primary",
      },
      {
        key: "total-saving-purchase",
        title: "Total Saving",
        value:
          summary.totalSaving < 0
            ? `- ${formatCurrencyId(Math.abs(summary.totalSaving))}`
            : formatCurrencyId(summary.totalSaving),
        subtitle: "Saving tetap ditampilkan sebagai info, bukan pengurang kas keluar.",
        accent: summary.totalSaving >= 0 ? "success" : "danger",
      },
      {
        key: "purchase-transaction-count",
        title: "Jumlah Transaksi",
        value: formatNumberId(summary.totalTransactions),
        subtitle: "Jumlah transaksi pembelian yang terbaca dari expenses.",
        accent: "warning",
      },
    ],
    [summary],
  );

  // =========================
  // SECTION: Export laporan pembelian
  // Fungsi:
  // - mengekspor data expenses pembelian aktif ke XLSX yang lebih rapi untuk owner/admin
  // - tetap memakai sumber data laporan yang sama tanpa mengubah perhitungan kas keluar
  // Status:
  // - aktif dipakai sebagai jalur export final laporan pembelian
  // - sheet name distandarkan untuk Task 5 agar XLSX mudah dikenali user
  // =========================
  const exportToExcel = async () => {
    await exportJsonToExcel({
      title: "Laporan Pembelian IMS Bunga Flanel",
      subtitle: "Ekspor mengikuti data expenses pembelian yang tampil di halaman ini.",
      sheetName: "Purchases Report",
      fileName: "Laporan-Pembelian",
      filters: [
        `Periode: ${getReportDateRangeLabel(dateRange)}`,
      ],
      columns: [
        { header: "ID Expense", key: "expenseId", width: 24 },
        { header: "Tanggal", key: "expenseDate", width: 18 },
        { header: "Ref Pembelian", key: "purchaseReference", width: 24 },
        { header: "Supplier", key: "supplierName", width: 24 },
        { header: "Item", key: "itemName", width: 32 },
        { header: "Varian / Sumber", key: "variantLabel", width: 22 },
        { header: "Aktual Keluar", key: "actualAmount", width: 18 },
        { header: "Referensi", key: "referenceAmount", width: 18 },
        { header: "Saving", key: "savingAmount", width: 18 },
        { header: "Tipe", key: "expenseType", width: 24 },
        { header: "Deskripsi", key: "description", width: 40 },
      ],
      data: purchasesData.map((purchase) => ({
        expenseId: resolveDisplayReference(purchase, { fallback: purchase.id, allowTechnicalId: true }),
        expenseDate: formatDateId(purchase.date, true),
        purchaseReference: resolveDisplayReference(purchase, { fallback: purchase.sourceRef || purchase.id, allowTechnicalId: true }),
        supplierName: purchase.supplierName || "-",
        itemName: purchase.relatedItemName || purchase.description || "-",
        variantLabel: getPurchaseVariantLabel(purchase),
        actualAmount: formatCurrencyId(purchase.amount),
        referenceAmount: purchase.totalReferenceAmount ? formatCurrencyId(purchase.totalReferenceAmount) : "-",
        savingAmount: formatCurrencyId(purchase.savingAmount || 0),
        expenseType: purchase.type || "-",
        description: purchase.description || "-",
      })),
    });
    message.success("Laporan pembelian berhasil diekspor ke Excel.");
  };

  const purchasesReportMobileCardConfig = useMemo(
    () => ({
      title: (record) => resolveDisplayReference(record, { fallback: record.sourceRef || "Pembelian" }),
      subtitle: (record) => [
        formatDateId(record.date, true),
        record.supplierName || "Tanpa supplier",
        getPurchaseVariantLabel(record),
      ],
      tags: (record) => {
        const meta = getSavingMeta(record.savingAmount);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
      meta: [
        { label: "Aktual Keluar", value: (record) => formatCurrencyId(record.amount) },
        { label: "Referensi", value: (record) => (record.totalReferenceAmount ? formatCurrencyId(record.totalReferenceAmount) : "-") },
      ],
      subtext: (record) => `Item: ${record.relatedItemName || record.description || "-"}`,
      content: (record) => record.description ? <span className="ims-cell-meta">{record.description}</span> : null,
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
        title: "Supplier",
        dataIndex: "supplierName",
        key: "supplierName",
        render: (value) => value || "-",
      },
      {
        title: "Ref",
        key: "purchaseReference",
        render: (_, record) => resolveDisplayReference(record, { fallback: record.sourceRef || "-" }),
      },
      {
        title: "Item",
        key: "itemName",
        render: (_, record) => record.relatedItemName || record.description || "-",
      },
      {
        title: "Varian / Sumber",
        key: "variantLabel",
        render: (_, record) => {
          const label = getPurchaseVariantLabel(record);
          const isVariant = record.stockSourceType === "variant" || record.variantLabel || record.variantKey;
          return (
            <Tag color={isVariant ? "purple" : "default"}>
              {label}
            </Tag>
          );
        },
      },
      {
        title: "Aktual Keluar",
        dataIndex: "amount",
        key: "amount",
        render: (value) => formatCurrencyId(value),
      },
      {
        title: "Referensi",
        dataIndex: "totalReferenceAmount",
        key: "totalReferenceAmount",
        render: (value) => (value ? formatCurrencyId(value) : "-"),
      },
      {
        title: "Saving",
        dataIndex: "savingAmount",
        key: "savingAmount",
        render: (value) => {
          const meta = getSavingMeta(value);
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
      },
      {
        title: "Deskripsi",
        dataIndex: "description",
        key: "description",
        render: (value) => value || "-",
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Laporan Pembelian"
        subtitle="Laporan membaca data pembelian aktif."
      />

      <PageSection
        title="Filter Periode"
        subtitle="Report membaca expenses pembelian sesuai tanggal transaksi, bukan seluruh collection."
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
        title="Ringkasan Pembelian"
        subtitle="Ringkasan total dan saving pembelian."
      >
        <SummaryStatGrid
          items={summaryItems}
          columns={{ xs: 24, sm: 12, md: 12, lg: 6 }}
          variant="finance"
          highlightKey="total-saving-purchase"
        />
      </PageSection>

      <PageSection
        title="Detail Pembelian"
        subtitle={`Data expenses pembelian periode ${getReportDateRangeLabel(dateRange)}.`}
        extra={
          <Button type="primary" onClick={exportToExcel} disabled={purchasesData.length === 0}>
            Ekspor ke Excel
          </Button>
        }
      >
        <DataTableView
          // AKTIF / GUARDED UI: class standar hanya visual; pembacaan report pembelian/expense flow tidak diubah.
          loading={loading}
          showRefreshIndicator
          className="app-data-table"
          dataSource={purchasesData}
          columns={columns}
          rowKey="id"
          mobileCardConfig={purchasesReportMobileCardConfig}
          locale={{
            emptyText: getDataTableEmptyText(loading, <EmptyStateBlock description="Belum ada data pembelian untuk ditampilkan." />),
          }}
        />
      </PageSection>
    </>
  );
};

export default PurchasesReport;
