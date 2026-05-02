import React, { useEffect, useMemo, useState } from "react";
import { Button, Col, Input, Select, Table, Tag, message } from "antd";
import { CheckCircleOutlined, FileExcelOutlined, WarningOutlined } from "@ant-design/icons";
import { collection, getDocs, onSnapshot } from "firebase/firestore";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { db } from "../../firebase";
import { exportJsonToExcel } from "../../utils/export/exportExcel";
import { formatNumberId } from "../../utils/formatters/numberId";

const { Search } = Input;
const { Option } = Select;

// =========================
// SECTION: Threshold stok rendah
// Catatan:
// - nilai ini memang masih sederhana sesuai current state docs
// - refactor UI ini sengaja tidak mengubah business behavior laporan stok
// =========================
const LOW_STOCK_THRESHOLD = 10;

const resolveDisplayStock = (item = {}) =>
  Number(item.currentStock ?? item.stock ?? item.availableStock ?? 0);

const resolveDisplayUnit = (item = {}) => item.unit || item.stockUnit || "pcs";

const resolveStatus = (stockValue) => {
  if (stockValue === 0) return "Habis";
  if (stockValue < LOW_STOCK_THRESHOLD) return "Kritis";
  return "Normal";
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
    const stockValue = resolveDisplayStock(payload);

    return {
      id: documentItem.id,
      ...payload,
      stockDisplay: stockValue,
      unitDisplay: resolveDisplayUnit(payload),
      type: typeLabel,
      status: resolveStatus(stockValue),
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
  const lowStockItems = filteredData.filter((item) => item.stockDisplay < LOW_STOCK_THRESHOLD);
  const criticalStockItems = filteredData.filter((item) => item.stockDisplay === 0);

  const summaryItems = useMemo(
    () => [
      {
        key: "stock-total-items",
        title: "Total Item",
        value: formatNumberId(totalItems),
        subtitle: "Jumlah item yang lolos filter laporan stok.",
        accent: "primary",
      },
      {
        key: "stock-low-items",
        title: "Item Stok Rendah",
        value: formatNumberId(lowStockItems.length),
        subtitle: `Threshold aktif < ${LOW_STOCK_THRESHOLD}.`,
        accent: "warning",
      },
      {
        key: "stock-empty-items",
        title: "Item Stok Habis",
        value: formatNumberId(criticalStockItems.length),
        subtitle: "Item dengan stok 0 pada data yang sedang tampil.",
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
      subtitle: "Snapshot stok bahan baku, semi finished, dan produk jadi sesuai filter aktif.",
      fileName: "laporan-stok",
      sheetName: "Stock Report",
      filters: [
        `Kategori: ${selectedCategory === "all" ? "Semua" : selectedCategory}`,
        `Status: ${selectedStatus === "all" ? "Semua" : selectedStatus}`,
        `Pencarian: ${searchTerm || "-"}`,
      ],
      columns: [
        { key: "name", label: "Nama Item" },
        { key: "category", label: "Kategori" },
        { key: "type", label: "Jenis" },
        { key: "stockDisplay", label: "Stok" },
        { key: "unitDisplay", label: "Satuan" },
        { key: "status", label: "Status" },
      ],
      data: filteredData.map((item) => ({
        ...item,
        category: item.category || "-",
      })),
    });
  };

  const columns = useMemo(
    () => [
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
        // AKTIF / GUARDED: format display stok report no-decimal tanpa mengubah source/formula laporan.
        render: (value) => formatNumberId(value),
        sorter: (left, right) => left.stockDisplay - right.stockDisplay,
      },
      {
        title: "Satuan",
        dataIndex: "unitDisplay",
        key: "unitDisplay",
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        render: (status) => {
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
            <Tag color={color} icon={icon}>
              {status}
            </Tag>
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

  return (
    <>
      <PageHeader
        title="Laporan Stok"
        subtitle="Laporan stok membaca bahan baku, semi finished, dan produk jadi tanpa mengubah source of truth stok."
      />

      <PageSection
        title="Ringkasan Stok"
        subtitle="Ringkasan tetap mengikuti filter pencarian, kategori, dan status pada halaman ini."
      >
        <SummaryStatGrid items={summaryItems} columns={{ xs: 24, md: 8 }} />
      </PageSection>

      <PageSection
        title="Filter Laporan"
        subtitle="Gunakan filter untuk mempersempit tampilan laporan sebelum ekspor XLSX."
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
        subtitle="Field stok tampilan mengikuti fallback currentStock → stock → availableStock dan sudah mencakup semi-finished stock produksi."
        extra={<Tag color="blue">{formatNumberId(filteredData.length)} baris</Tag>}
      >
        <Table
          // AKTIF / GUARDED UI: class standar hanya visual; sumber stok/currentStock/reservedStock/availableStock tidak diubah.
          className="app-data-table"
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          bordered
          locale={{
            emptyText: <EmptyStateBlock description="Belum ada data stok yang cocok dengan filter saat ini." />,
          }}
        />
      </PageSection>
    </>
  );
};

export default StockReport;
