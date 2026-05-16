import React, { useEffect, useMemo, useState } from "react";
import { Button, Col, Input, Select, Table, Tag, message } from "antd";
import { CheckCircleOutlined, FileExcelOutlined, WarningOutlined } from "@ant-design/icons";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import StockDisplayBlock from "../../components/Layout/Table/StockDisplayBlock";
import { db } from "../../firebase";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { formatNumberId } from "../../utils/formatters/numberId";
import { DataRefreshIndicator, getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";
import { getInventoryStockStatusMeta } from "../../utils/stock/stockHelpers";

const { Search } = Input;
const { Option } = Select;

/* =====================================================
SECTION: Stock Report Minimum Stock Status — AKTIF
Fungsi:
- Menentukan status stok report secara read-only memakai threshold master per entity, bukan angka statis global.

Dipakai oleh:
- Normalisasi row StockReport, tabel, filter status, summary, dan export XLSX.

Alasan perubahan:
- Stock Report harus konsisten dengan Dashboard/master page: Product memakai `minStockAlert`, Raw Material memakai `minStock`, Semi Finished memakai `minStockAlert`, dan stok pembanding memakai available-first.

Catatan cleanup:
- Belum ada fallback threshold statis; item dengan threshold kosong/0 hanya menjadi rendah jika stok benar-benar habis.

Risiko:
- Jika threshold statis atau `variants[].minStockAlert` dipakai lagi, report bisa berbeda dari Dashboard/master page dan menandai item rendah secara salah.
===================================================== */
const resolveDisplayUnit = (item = {}) => item.stockUnit || item.unit || "pcs";

const resolveSourceType = (typeLabel = "") => {
  if (typeLabel === "Bahan Baku") return "material";
  if (typeLabel === "Semi Finished") return "semi_finished";
  return "product";
};

const resolveReportStatus = (statusMeta = {}) => {
  if (statusMeta.statusKey === "empty") return "Habis";
  if (statusMeta.statusKey === "low") return "Kritis";
  return "Normal";
};

const resolveAffectedVariantSummary = (statusMeta = {}, unit = "pcs") => {
  if (!statusMeta.hasVariants || !statusMeta.affectedVariantCount) return "";

  const preview = statusMeta.affectedVariants
    .slice(0, 3)
    .map((variantMeta) => `${variantMeta.label} ${formatNumberId(variantMeta.availableStock)} ${unit}`)
    .join(", ");
  const extra = statusMeta.affectedVariantCount > 3 ? ` +${statusMeta.affectedVariantCount - 3} lainnya` : "";

  return `Varian perlu cek: ${preview}${extra}`;
};

// =========================
// ACTIVE / FINAL - normalisasi row stok untuk laporan/export.
// Fungsi blok:
// - menyatukan raw material, semi finished, dan produk jadi ke format row laporan yang sama;
// - menjaga Stock Report membaca source stok final tanpa menulis/mengubah data bisnis.
// Hubungan dengan flow laporan/export:
// - dipakai oleh tabel dan XLSX agar semi-finished stock ikut terbaca untuk data real produksi.
// Status: aktif dipakai; bukan legacy dan bukan kandidat cleanup.
// =========================
const mapInventorySnapshotToReportRows = (snapshot, typeLabel) =>
  snapshot.docs.map((documentItem) => {
    const payload = documentItem.data();
    const sourceType = resolveSourceType(typeLabel);
    const unitDisplay = resolveDisplayUnit(payload);
    const statusMeta = getInventoryStockStatusMeta(payload, sourceType);
    const lowestAffectedVariant = statusMeta.affectedVariants?.length
      ? [...statusMeta.affectedVariants].sort((left, right) => left.availableStock - right.availableStock)[0]
      : null;
    const stockValue = lowestAffectedVariant ? lowestAffectedVariant.availableStock : statusMeta.stock;

    return {
      id: documentItem.id,
      ...payload,
      stockDisplay: stockValue,
      minStockDisplay: statusMeta.threshold,
      unitDisplay,
      type: typeLabel,
      sourceType,
      status: resolveReportStatus(statusMeta),
      affectedVariantSummary: resolveAffectedVariantSummary(statusMeta, unitDisplay),
    };
  });

const StockReport = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  useEffect(() => {
    const unsubscribeRawMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        const rawMaterialsData = mapInventorySnapshotToReportRows(snapshot, "Bahan Baku");

        setInventory((previousInventory) => [
          ...previousInventory.filter((item) => item.type !== "Bahan Baku"),
          ...rawMaterialsData,
        ]);
        setLoading(false);
      },
      (error) => {
        message.error("Gagal memuat data bahan baku.");
        console.error("Error fetching raw materials:", error);
        setLoading(false);
      },
    );

    const unsubscribeProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const productsData = mapInventorySnapshotToReportRows(snapshot, "Produk Jadi");

        setInventory((previousInventory) => [
          ...previousInventory.filter((item) => item.type !== "Produk Jadi"),
          ...productsData,
        ]);
      },
      (error) => {
        message.error("Gagal memuat data produk jadi.");
        console.error("Error fetching products:", error);
      },
    );

    // =========================
    // ACTIVE / FINAL - subscription semi finished stock untuk Stock Report.
    // Fungsi blok:
    // - menambahkan collection semi_finished_materials ke laporan stok tanpa mengubah source of truth stok;
    // - menjaga export Stock Report siap data real karena produksi memakai semi-finished sebagai stok internal.
    // Hubungan dengan flow laporan/export:
    // - hanya membaca data, tidak melakukan update stok/produksi.
    // Status: aktif dipakai; bukan legacy dan bukan kandidat cleanup.
    // =========================
    const unsubscribeSemiFinished = onSnapshot(
      collection(db, "semi_finished_materials"),
      (snapshot) => {
        const semiFinishedData = mapInventorySnapshotToReportRows(snapshot, "Semi Finished");

        setInventory((previousInventory) => [
          ...previousInventory.filter((item) => item.type !== "Semi Finished"),
          ...semiFinishedData,
        ]);
      },
      (error) => {
        message.error("Gagal memuat data semi finished.");
        console.error("Error fetching semi finished materials:", error);
      },
    );

    const fetchCategories = async () => {
      try {
        const categorySnapshot = await getDocs(collection(db, "categories"));
        const categoryList = categorySnapshot.docs.map((documentItem) => documentItem.data().name);
        setCategories(categoryList);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };

    fetchCategories();

    return () => {
      unsubscribeRawMaterials();
      unsubscribeProducts();
      unsubscribeSemiFinished();
    };
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
        { key: "affectedVariantSummary", label: "Varian Perlu Cek" },
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
            sourceType={record.sourceType}
            className="ims-cell-stack ims-cell-stack-tight"
            metaClassName="ims-cell-meta"
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
              {record.affectedVariantSummary ? (
                <span className="ims-cell-meta">{record.affectedVariantSummary}</span>
              ) : null}
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
