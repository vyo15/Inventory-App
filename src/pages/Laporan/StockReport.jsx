import React, { useEffect, useMemo, useState } from "react";
import { Button, Col, Input, Select, Table, Tag, message } from "antd";
import { CheckCircleOutlined, FileExcelOutlined, WarningOutlined } from "@ant-design/icons";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import StockDisplayBlock from "../../components/Layout/Table/StockDisplayBlock";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { fetchStockReportData } from "../../services/Laporan/stockReportService";
import { formatNumberId } from "../../utils/formatters/numberId";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";

const { Search } = Input;
const { Option } = Select;

const StockReport = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    const loadStockReportData = async () => {
      try {
        setLoading(true);
        const { inventory: inventoryRows, categories: categoryList } = await fetchStockReportData();

        setInventory(inventoryRows);
        setCategories(categoryList);
      } catch (error) {
        console.error("Error fetching stock report data:", error);
        message.error("Gagal memuat data laporan stok.");
      } finally {
        setLoading(false);
      }
    };

    loadStockReportData();
  }, []);

  const filteredData = useMemo(() => {
    return inventory.filter((item) => {
      const itemName = String(item.name || "").toLowerCase();
      const matchesSearch = itemName.includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "all" || item.category === selectedCategory;
      const matchesStatus =
        selectedStatus === "all" || item.status.toLowerCase() === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [inventory, searchTerm, selectedCategory, selectedStatus]);

  // =========================
  // ACTIVE / FINAL - opsi kategori laporan dari master + stok tampil.
  // Fungsi blok:
  // - menjaga kategori semi-finished tetap bisa dipilih walaupun tidak ada di collection categories lama;
  // - tidak mengubah data kategori, hanya memperkaya pilihan filter UI/export.
  // Hubungan dengan flow laporan/export: filter aktif ikut tercatat di XLSX.
  // Status: aktif dipakai; bukan legacy dan bukan kandidat cleanup.
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
  const exportToExcel = async () => {
    if (filteredData.length === 0) {
      message.warning("Tidak ada data untuk diekspor.");
      return;
    }

    await exportJsonToExcel({
      title: "Laporan Stok IMS Bunga Flanel",
      subtitle: "Ekspor stok sesuai filter aktif.",
      fileName: "laporan-stok",
      sheetName: "Stock Report",
      filters: [
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
      data: filteredData.map((item) => ({
        ...item,
        displayReference: resolveDisplayReference(item),
        category: item.category || "-",
      })),
    });
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
            <Button type="primary" icon={<FileExcelOutlined />} onClick={exportToExcel}>
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
        subtitle="Item sesuai filter."
        extra={<Tag color="blue">{formatNumberId(filteredData.length)} baris</Tag>}
      >
        <DataRefreshIndicator loading={loading} dataSource={filteredData} />
        <Table
          // AKTIF / GUARDED UI: class standar hanya visual; sumber stok/currentStock/reservedStock/availableStock tidak diubah.
          className="app-data-table"
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          bordered
          tableLayout="fixed"
          locale={{
            emptyText: getDataTableEmptyText(loading, <EmptyStateBlock description="Belum ada data stok sesuai filter." />),
          }}
        />
      </PageSection>
    </>
  );
};

export default StockReport;
