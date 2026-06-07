import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Input, Select, Tag, message } from "antd";
import { CheckCircleOutlined, FileExcelOutlined, WarningOutlined } from "@ant-design/icons";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import StockDisplayBlock from "../../components/Layout/Table/StockDisplayBlock";
import DataTableView from "../../components/Layout/Table/DataTableView";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { fetchFullStockReportExportData, fetchStockReportData } from "../../services/Laporan/stockReportService";
import { formatNumberId } from "../../utils/formatters/numberId";
import { getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";

const { Search } = Input;
const { Option } = Select;

const STOCK_REPORT_PAGE_SIZE = 500;
const STOCK_REPORT_EXPORT_PAGE_SIZE = 1000;
const STOCK_REPORT_EXPORT_LIMIT = 20000;

const getStockReportRowKey = (record = {}) => (
  record.readModelId ||
  `${record.sourceType || record.type || "stock"}__${record.sourceId || record.id || record.displayReference || record.name}`
);

const mergeUniqueStockReportRows = (currentRows = [], nextRows = []) => {
  const rowMap = new Map();
  [...currentRows, ...nextRows].forEach((row) => {
    rowMap.set(getStockReportRowKey(row), row);
  });
  return Array.from(rowMap.values());
};

const filterStockReportRows = (rows = [], { searchTerm = "", selectedCategory = "all", selectedStatus = "all" } = {}) => {
  const normalizedSearch = String(searchTerm || "").toLowerCase();

  return rows.filter((item) => {
    const itemName = String(item.name || "").toLowerCase();
    const itemReference = String(resolveDisplayReference(item) || "").toLowerCase();
    const matchesSearch = !normalizedSearch || itemName.includes(normalizedSearch) || itemReference.includes(normalizedSearch);
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesStatus = selectedStatus === "all" || String(item.status || "").toLowerCase() === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });
};

const StockReport = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [categories, setCategories] = useState([]);
  const [failedReads, setFailedReads] = useState([]);
  const [reportMeta, setReportMeta] = useState(null);
  const [stockReportCursor, setStockReportCursor] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    const loadStockReportData = async () => {
      try {
        setLoading(true);
        const {
          inventory: inventoryRows,
          categories: categoryList,
          failedReads: readFailures = [],
          reportMeta: nextReportMeta = null,
        } = await fetchStockReportData();

        setInventory(inventoryRows);
        setCategories(categoryList);
        setFailedReads(readFailures);
        setReportMeta(nextReportMeta);
        setStockReportCursor(nextReportMeta?.nextCursor || null);
      } catch (error) {
        console.error("Error fetching stock report data:", error);
        message.error("Gagal memuat data laporan stok.");
        setFailedReads([]);
        setReportMeta(null);
        setStockReportCursor(null);
      } finally {
        setLoading(false);
      }
    };

    loadStockReportData();
  }, []);

  const filteredData = useMemo(() => filterStockReportRows(inventory, {
    searchTerm,
    selectedCategory,
    selectedStatus,
  }), [inventory, searchTerm, selectedCategory, selectedStatus]);

  // =========================
  // ACTIVE / FINAL - opsi kategori laporan dari master + stok tampil.
  // Fungsi blok:
  // - menjaga kategori semi-finished tetap bisa dipilih walaupun tidak ada di collection categories lama;
  // - tidak mengubah data kategori, hanya memperkaya pilihan filter UI/export.
  // Hubungan dengan flow laporan/export: filter aktif ikut tercatat di XLSX.
  // Status: aktif dipakai; bukan data lama dan bukan kandidat cleanup.
  // =========================
  const categoryOptions = useMemo(() => {
    const mergedCategories = new Set([
      ...categories.filter(Boolean),
      ...inventory.map((item) => item.category).filter(Boolean),
    ]);

    return Array.from(mergedCategories).sort((left, right) =>
      String(left).localeCompare(String(right)),
    );
  }, [categories, inventory]);

  const totalItems = filteredData.length;
  const lowStockItems = filteredData.filter((item) => item.status === "Kritis" || item.status === "Habis");
  const criticalStockItems = filteredData.filter((item) => item.status === "Habis");
  const isPartialStockReport = failedReads.length > 0;
  const isLimitedStockReport = Boolean(reportMeta?.isLimited);
  const failedReadsLabel = failedReads.join(", ");
  const stockReportLimitLabel = reportMeta?.maxResults ? formatNumberId(reportMeta.maxResults) : "-";
  const stockReportLoadedLabel = reportMeta?.loadedRows ? formatNumberId(reportMeta.loadedRows) : formatNumberId(inventory.length);
  const stockReportSourceLabel = reportMeta?.dataSource === "master_stock_fallback"
    ? "Master stock fallback"
    : "Data stok lokal";
  const hasMoreStockReportRows = Boolean(reportMeta?.hasMore && stockReportCursor);

  const summaryItems = useMemo(
    () => [
      {
        key: "stock-total-items",
        title: "Total Item",
        value: formatNumberId(totalItems),
        subtitle: "Item sesuai filter.",
        accent: "primary",
      },
      {
        key: "stock-low-items",
        title: "Item Stok Rendah",
        value: formatNumberId(lowStockItems.length),
        subtitle: "Di bawah minimum stok.",
        accent: "warning",
      },
      {
        key: "stock-empty-items",
        title: "Item Stok Habis",
        value: formatNumberId(criticalStockItems.length),
        subtitle: "Stok habis.",
        accent: "danger",
      },
    ],
    [criticalStockItems.length, lowStockItems.length, totalItems],
  );

  // =========================
  // SECTION: Export laporan stok ke XLSX
  // Fungsi:
  // - mengganti export CSV mentah menjadi file Excel yang lebih rapi
  // - menjaga helper export reusable lintas laporan batch berikutnya
  // Status:
  // - aktif dipakai di laporan stok
  // - sheet name distandarkan untuk Task 5 agar XLSX mudah dikenali user
  // - kandidat cleanup hanya jika nanti seluruh laporan pindah ke report/export engine yang lebih besar
  // =========================
  const loadMoreStockReportRows = async () => {
    if (!stockReportCursor || loadingMore) return;

    try {
      setLoadingMore(true);
      const {
        inventory: nextRows,
        categories: nextCategories,
        failedReads: nextFailedReads = [],
        reportMeta: nextReportMeta = null,
      } = await fetchStockReportData({
        maxResults: STOCK_REPORT_PAGE_SIZE,
        cursor: stockReportCursor,
        includeCategories: false,
      });

      const mergedRows = mergeUniqueStockReportRows(inventory, nextRows);

      setInventory(mergedRows);
      setReportMeta({
        ...nextReportMeta,
        loadedRows: mergedRows.length,
        activeRows: mergedRows.length,
        isLimited: Boolean(nextReportMeta?.hasMore),
      });
      setCategories((currentCategories) => Array.from(new Set([
        ...currentCategories,
        ...nextCategories,
        ...nextRows.map((item) => item.category || item.categoryName || "").filter(Boolean),
      ])).sort((left, right) => String(left).localeCompare(String(right))));
      setFailedReads((currentFailures) => Array.from(new Set([...currentFailures, ...nextFailedReads])));
      setStockReportCursor(nextReportMeta?.nextCursor || null);

      if (!nextReportMeta?.hasMore) {
        message.success("Semua data Stock Report yang tersedia sudah termuat.");
      }
    } catch (error) {
      console.error("Error loading more stock report data:", error);
      message.error("Gagal memuat data lanjutan Stock Report.");
    } finally {
      setLoadingMore(false);
    }
  };

  // =========================
  // SECTION: Export laporan stok ke XLSX
  // Fungsi:
  // - memakai full export loop read model agar export tidak hanya bergantung pada rows UI yang termuat;
  // - tetap memakai filter aktif di client agar behavior filter UI dan export konsisten.
  // Status:
  // - aktif dipakai di laporan stok;
  // - tidak mengubah sumber stok, hanya read-only export.
  // =========================
  const exportToExcel = async () => {
    let exportRows = inventory;
    let exportMeta = reportMeta;
    let exportFailedReads = failedReads;

    try {
      setExporting(true);
      const exportResult = await fetchFullStockReportExportData({
        pageSize: STOCK_REPORT_EXPORT_PAGE_SIZE,
        maxResults: STOCK_REPORT_EXPORT_LIMIT,
      });

      if (Array.isArray(exportResult.inventory) && exportResult.inventory.length > 0) {
        exportRows = exportResult.inventory;
        exportMeta = exportResult.reportMeta || reportMeta;
        exportFailedReads = exportResult.failedReads || [];
      }
    } catch (error) {
      console.warn("Gagal memuat full export Stock Report, memakai data yang sudah termuat di UI:", error);
      message.warning("Full export gagal dimuat. Export memakai data Stock Report yang sudah termuat di tabel.");
    }

    const exportFilteredData = filterStockReportRows(exportRows, {
      searchTerm,
      selectedCategory,
      selectedStatus,
    });
    const exportIsPartial = exportFailedReads.length > 0;
    const exportIsLimited = Boolean(exportMeta?.isLimited || exportMeta?.hasMore);
    const exportFailedReadsLabel = exportFailedReads.join(", ");
    const exportSourceLabel = exportMeta?.dataSource === "master_stock_fallback"
      ? "Master stock fallback"
      : "Data stok lokal";

    if (exportFilteredData.length === 0) {
      message.warning("Tidak ada data untuk diekspor.");
      setExporting(false);
      return;
    }

    if (exportIsPartial) {
      message.warning("Export XLSX hanya memuat sumber laporan stok yang berhasil dibaca.");
    }

    if (exportIsLimited) {
      message.warning("Export XLSX dibatasi oleh limit full export Stock Report saat ini.");
    }

    try {
      await exportJsonToExcel({
        title: "Laporan Stok IMS Bunga Flanel",
        subtitle: exportIsPartial || exportIsLimited
          ? "Ekspor stok sesuai filter aktif. PERINGATAN: data laporan parsial/terbatas."
          : "Ekspor stok sesuai filter aktif dari data stok lengkap.",
        fileName: "laporan-stok",
        sheetName: "Stock Report",
        filters: [
          `Status data: ${exportIsPartial ? `Parsial - sumber gagal: ${exportFailedReadsLabel}` : "Lengkap sesuai sumber yang berhasil dimuat"}`,
          `Sumber data: ${exportSourceLabel}`,
          `Rows export termuat: ${formatNumberId(exportFilteredData.length)}`,
          `Rows sumber terbaca: ${formatNumberId(exportMeta?.loadedRows || exportRows.length)}`,
          `Batas full export: ${exportMeta?.exportLimit ? formatNumberId(exportMeta.exportLimit) : formatNumberId(STOCK_REPORT_EXPORT_LIMIT)}`,
          `Catatan export: ${exportIsLimited ? "Export mencapai batas full export/paging. Tambah limit/index jika data production sudah melewati batas ini." : "Export memakai paging data stok sesuai filter aktif."}`,
          `Kategori: ${selectedCategory === "all" ? "Semua" : selectedCategory}`,
          `Status: ${selectedStatus === "all" ? "Semua" : selectedStatus}`,
          `Pencarian: ${searchTerm || "-"}`,
        ],
        columns: [
          { key: "displayReference", label: "Kode Item" },
          { key: "name", label: "Nama Item" },
          { key: "category", label: "Kategori" },
          { key: "type", label: "Jenis" },
          { key: "stockDisplay", label: "Stok Tersedia" },
          { key: "minStockDisplay", label: "Minimum Stok Master" },
          { key: "unitDisplay", label: "Satuan" },
          { key: "status", label: "Status" },
        ],
        data: exportFilteredData.map((item) => ({
          ...item,
          displayReference: resolveDisplayReference(item),
          category: item.category || "-",
        })),
      });
    } finally {
      setExporting(false);
    }
  };

  /* =====================================================
  SECTION: Kolom laporan stok compact — AKTIF / GUARDED
  Fungsi:
  - Menampilkan laporan stok read-only dengan format saldo stok locked: Total, Tersedia, dan variant pill jika row membawa variants[].

  Dipakai oleh:
  - Halaman Laporan / StockReport dan summary/export yang tetap memakai data filteredData existing.

  Alasan perubahan:
  - StockReport sebelumnya masih menampilkan angka stok sederhana walaupun normalisasi row mempertahankan field variants/currentStock/availableStock dari source collection.

  Catatan cleanup:
  - Export XLSX memakai status dan minimum stok master yang sama dengan tabel agar report tidak berbeda dari Dashboard/master page.

  Risiko:
  - Jangan mengubah query, filter, summary, export mapping, atau perhitungan stockDisplay dari section ini tanpa approval report/data layer.
  ===================================================== */
  const stockReportMobileCardConfig = useMemo(
    () => ({
      title: (record) => record.name || resolveDisplayReference(record) || "Item stok",
      subtitle: (record) => [
        resolveDisplayReference(record),
        record.type || "Jenis belum diisi",
        record.category || "Tanpa kategori",
      ],
      tags: (record) => {
        const status = record.status || "-";
        const color = status === "Kritis" || status === "Habis" ? "volcano" : status === "Normal" ? "green" : "default";
        return <Tag color={color}>{status}</Tag>;
      },
      content: (record) => (
        <StockDisplayBlock
          record={record}
          unit={record.unitDisplay}
          className="ims-cell-stack ims-cell-stack-tight"
          metaClassName="ims-cell-meta"
          minStockThreshold={Number(record.minStockDisplay || 0)}
        />
      ),
      subtext: (record) => record.affectedVariantSummary || null,
    }),
    [],
  );

  const columns = useMemo(
    () => [
      {
        title: "Kode",
        key: "displayReference",
        render: (_, record) => resolveDisplayReference(record),
      },
      {
        title: "Nama Item",
        dataIndex: "name",
        key: "name",
        sorter: (left, right) => String(left.name || "").localeCompare(String(right.name || "")),
      },
      {
        title: "Kategori",
        dataIndex: "category",
        key: "category",
        render: (value) => value || "-",
      },
      {
        title: "Jenis",
        dataIndex: "type",
        key: "type",
        filters: [
          { text: "Bahan Baku", value: "Bahan Baku" },
          { text: "Semi Finished", value: "Semi Finished" },
          { text: "Produk Jadi", value: "Produk Jadi" },
        ],
        onFilter: (value, record) => record.type === value,
      },
      {
        title: "Stok",
        dataIndex: "stockDisplay",
        key: "stockDisplay",
        width: "34%",
        // AKTIF / GUARDED: display locked hanya membaca field row; stockDisplay/export dan formula laporan tidak diubah.
        render: (_, record) => (
          <StockDisplayBlock
            record={record}
            unit={record.unitDisplay}
            className="ims-cell-stack ims-cell-stack-tight"
            metaClassName="ims-cell-meta"
            minStockThreshold={Number(record.minStockDisplay || 0)}
          />
        ),
        sorter: (left, right) => left.stockDisplay - right.stockDisplay,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status, record) => {
          let color = "geekblue";
          let icon = null;

          if (status === "Kritis" || status === "Habis") {
            color = "volcano";
            icon = <WarningOutlined />;
          } else if (status === "Normal") {
            color = "green";
            icon = <CheckCircleOutlined />;
          }

          return (
            <div className="ims-cell-stack ims-cell-stack-tight">
              <Tag color={color} icon={icon}>
                {status}
              </Tag>
              {record.affectedVariantSummary ? <span className="ims-cell-caption">{record.affectedVariantSummary}</span> : null}
            </div>
          );
        },
        filters: [
          { text: "Normal", value: "normal" },
          { text: "Kritis", value: "kritis" },
          { text: "Habis", value: "habis" },
        ],
        onFilter: (value, record) => record.status.toLowerCase() === value,
      },
    ],
    [],
  );

  /* =====================================================
     SECTION: Stock Report Render Panel — GUARDED
     Fungsi:
     - Menata filter, summary, tabel, dan export stok agar bahan, semi finished, produk, varian, dan minimum stok tetap terbaca.

     Dipakai oleh:
     - Halaman Stock Report.

     Alasan perubahan:
     - Batch 3 merapikan copy laporan tanpa mengubah threshold, available stock, status rendah/habis, atau export.

     Catatan cleanup:
     - Breakdown varian detail bisa dibuat drawer jika kebutuhan audit stok bertambah.

     Risiko:
     - Jangan mengubah source stok, threshold master, status stok, filter value, atau export payload dari section ini.
     ===================================================== */
  return (
    <>
      <PageHeader
        title="Laporan Stok"
        subtitle="Snapshot stok sesuai filter."
      />

      <PageSection
        title="Ringkasan Stok"
        subtitle="KPI stok."
      >
        <SummaryStatGrid items={summaryItems} columns={{ xs: 24, md: 8 }} />
      </PageSection>

      <PageSection
        title="Filter Laporan"
        subtitle="Filter stok."
      >
        <FilterBar
          actions={
            <Button type="primary" icon={<FileExcelOutlined />} onClick={exportToExcel} loading={exporting}>
              Ekspor ke XLSX
            </Button>
          }
        >
          <Col xs={24} md={8}>
            <Search
              placeholder="Cari item..."
              allowClear
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </Col>

          <Col xs={24} md={6}>
            <Select
              value={selectedCategory}
              style={{ width: "100%" }}
              onChange={setSelectedCategory}
            >
              <Option value="all">Semua Kategori</Option>
              {categoryOptions.map((category) => (
                <Option key={category} value={category}>
                  {category}
                </Option>
              ))}
            </Select>
          </Col>

          <Col xs={24} md={6}>
            <Select value={selectedStatus} style={{ width: "100%" }} onChange={setSelectedStatus}>
              <Option value="all">Semua Status</Option>
              <Option value="normal">Normal</Option>
              <Option value="kritis">Kritis</Option>
              <Option value="habis">Habis</Option>
            </Select>
          </Col>
        </FilterBar>
      </PageSection>

      <PageSection
        title="Tabel Laporan Stok"
        subtitle={`Item sesuai filter. Sumber: ${stockReportSourceLabel}.`}
        extra={<Tag color="blue">{formatNumberId(filteredData.length)} baris</Tag>}
      >
        {isPartialStockReport && (
          <Alert
            type="warning"
            showIcon
            message="Sebagian sumber laporan stok gagal dimuat."
            description={`Area gagal: ${failedReadsLabel}. Data yang berhasil dibaca tetap ditampilkan agar laporan tidak kosong total. Export XLSX akan ditandai sebagai data parsial.`}
          />
        )}
        {isLimitedStockReport && (
          <Alert
            type="warning"
            showIcon
            message="Data laporan stok dibatasi oleh batas pemuatan."
            description={`Saat ini termuat ${stockReportLoadedLabel} dari batas ${stockReportLimitLabel} row. Gunakan tombol Muat data lanjutan untuk menambah rows tabel; Export XLSX akan mencoba mengambil data lengkap secara bertahap.`}
          />
        )}
        <DataTableView
          // AKTIF / GUARDED UI: class standar hanya visual; sumber stok/currentStock/reservedStock/availableStock tidak diubah.
          loading={loading}
          showRefreshIndicator
          className="app-data-table"
          columns={columns}
          dataSource={filteredData}
          rowKey={(record) => getStockReportRowKey(record)}
          bordered
          tableLayout="fixed"
          mobileCardConfig={stockReportMobileCardConfig}
          locale={{
            emptyText: getDataTableEmptyText(loading, <EmptyStateBlock description="Belum ada data stok sesuai filter." />),
          }}
        />
        {hasMoreStockReportRows && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
            <Button onClick={loadMoreStockReportRows} loading={loadingMore}>
              Muat data lanjutan
            </Button>
          </div>
        )}
      </PageSection>
    </>
  );
};

export default StockReport;
