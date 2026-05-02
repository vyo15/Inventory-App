import { useEffect, useMemo, useState } from "react";
import { Col, Input, Select, Space, Table, Tag, Tooltip, Typography, message } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import StockAdjustmentPanel from "./components/StockAdjustmentPanel";
import { getInventoryLogs } from "../../services/Inventory/inventoryService";
import { formatNumberId } from "../../utils/formatters/numberId";

const { Text } = Typography;

const ITEM_COLLECTION_LABELS = {
  raw_materials: "Bahan Baku",
  semi_finished_materials: "Semi Finished",
  products: "Produk Jadi",
};

// =========================
// SECTION: Batas baca inventory log
// Fungsi:
// - membatasi jumlah log yang dibaca untuk tabel riwayat agar halaman tetap ringan.
// Hubungan flow:
// - hanya tampilan audit; stok tetap berubah hanya lewat flow resmi atau submit adjustment.
// Status:
// - aktif dipakai; jika butuh riwayat penuh, nanti dibuat pagination khusus.
// =========================
const INVENTORY_LOG_TABLE_LIMIT = 300;

const STOCK_LOG_SOURCE_META = {
  purchase: { label: "Pembelian", color: "blue" },
  sales: { label: "Penjualan", color: "volcano" },
  production: { label: "Produksi", color: "purple" },
  return: { label: "Retur", color: "cyan" },
  adjustment: { label: "Penyesuaian Stok", color: "orange" },
  other: { label: "Lainnya", color: "default" },
};

const formatLogDate = (value) => {
  if (!value) return "-";
  const parsed = dayjs(value?.toDate?.() || value);
  return parsed.isValid() ? parsed.format("DD-MM-YYYY HH:mm") : "-";
};

const resolveItemTypeLabel = (collectionName) =>
  ITEM_COLLECTION_LABELS[collectionName] || "Item Lainnya";

const resolveSourceMeta = (record) => {
  const normalizedType = String(record?.type || "").toLowerCase();

  if (normalizedType.includes("purchase")) return STOCK_LOG_SOURCE_META.purchase;
  if (normalizedType.includes("sale")) return STOCK_LOG_SOURCE_META.sales;
  if (normalizedType.includes("return")) return STOCK_LOG_SOURCE_META.return;
  if (normalizedType.includes("adjustment")) return STOCK_LOG_SOURCE_META.adjustment;
  if (normalizedType.includes("production") || normalizedType.includes("work_log")) {
    return STOCK_LOG_SOURCE_META.production;
  }

  return STOCK_LOG_SOURCE_META.other;
};

const resolveDirectionMeta = (record) => {
  const quantityChange = Number(record?.quantityChange || 0);

  if (quantityChange > 0) {
    return { label: "Masuk", value: "in", color: "green" };
  }

  if (quantityChange < 0) {
    return { label: "Keluar", value: "out", color: "red" };
  }

  return { label: "Netral", value: "neutral", color: "default" };
};

// =========================
// SECTION: Helper baca field log kompatibel lama/baru
// Fungsi:
// - membaca value dari details terlebih dahulu lalu fallback ke top-level record
// - menjaga inventory log lama tetap tampil walau writer baru sudah menyimpan details/referenceId standar
// Hubungan flow:
// - dipakai semua resolver tampilan Stock Management agar audit trail tidak putus setelah schema log dirapikan
// Status:
// - aktif/final untuk UI reader; fallback top-level adalah kompatibilitas legacy
// =========================
const readLogField = (record, fieldName, fallback = "") => {
  if (record?.details && record.details[fieldName] !== undefined && record.details[fieldName] !== null) {
    return record.details[fieldName];
  }

  if (record?.[fieldName] !== undefined && record?.[fieldName] !== null) {
    return record[fieldName];
  }

  return fallback;
};

const resolveVariantLabel = (record) =>
  readLogField(record, "variantLabel") || readLogField(record, "variantKey") || "";

// =========================
// SECTION: Helper audit worker produksi
// Fungsi:
// - membaca snapshot worker/operator dari inventory log produksi baru;
// - memberi fallback aman untuk log legacy yang belum punya metadata worker.
// Hubungan flow:
// - Stock Management hanya reader audit, tidak fetch Work Log per row dan tidak melakukan write.
// Alasan logic dipakai:
// - worker sudah disalin ke `details` inventory log saat complete Work Log, sehingga kolom Catatan
//   bisa menampilkan operator tanpa mengubah stock mutation, payroll, atau HPP.
// Status:
// - AKTIF untuk log produksi baru.
// - LEGACY fallback: log lama tanpa worker metadata tetap tampil `-`.
// =========================
const normalizeLogStringArray = (value = []) =>
  Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];

const resolveProductionWorkerSummary = (record) => {
  const workerSummary = String(readLogField(record, "workerSummary") || readLogField(record, "operatorText") || "").trim();
  if (workerSummary) return workerSummary;

  const workerNames = normalizeLogStringArray(readLogField(record, "workerNames", []));
  const workerCodes = normalizeLogStringArray(readLogField(record, "workerCodes", []));
  const workerIds = normalizeLogStringArray(readLogField(record, "workerIds", []));
  const workerCount = Number(readLogField(record, "workerCount", 0) || 0);
  const readableWorkers = workerNames.length ? workerNames : workerCodes.length ? workerCodes : workerIds;

  if (readableWorkers.length) {
    return `Operator: ${readableWorkers.join(", ")}`;
  }

  if (workerCount > 0) {
    return `Operator: ${formatNumberId(workerCount)} orang`;
  }

  return "";
};

const resolveProductionAuditContextText = (record) => {
  const workNumber = String(readLogField(record, "workNumber") || "").trim();
  const productionOrderCode = String(readLogField(record, "productionOrderCode") || "").trim();
  const stepName = String(readLogField(record, "stepName") || "").trim();

  return [
    workNumber ? `Work Log: ${workNumber}` : "",
    productionOrderCode ? `PO: ${productionOrderCode}` : "",
    stepName ? `Step: ${stepName}` : "",
  ].filter(Boolean).join(" | ");
};

const REFERENCE_TYPE_LABELS = {
  sale: "Penjualan",
  sales: "Penjualan",
  purchase: "Pembelian",
  purchases: "Pembelian",
  return: "Retur",
  returns: "Retur",
  stock_adjustment: "Penyesuaian Stok",
  adjustment: "Penyesuaian Stok",
  production: "Produksi / Work Log",
  production_order: "Production Order",
  work_log: "Produksi / Work Log",
};

const compactReferenceId = (referenceId = "") => {
  const normalizedReferenceId = String(referenceId || "").trim();
  if (!normalizedReferenceId) return "";
  return normalizedReferenceId.length > 12
    ? `${normalizedReferenceId.slice(0, 8)}...${normalizedReferenceId.slice(-4)}`
    : normalizedReferenceId;
};

const buildReferenceItem = ({ label, referenceId = "", detail = "" }) => {
  const compactId = compactReferenceId(referenceId);
  return {
    label,
    referenceId,
    detail: detail || (compactId ? `ID: ${compactId}` : ""),
    searchText: [label, referenceId, detail, compactId].filter(Boolean).join(" "),
  };
};

const resolveReferenceTypeLabel = (referenceType = "") => {
  const normalizedReferenceType = String(referenceType || "").toLowerCase();
  return REFERENCE_TYPE_LABELS[normalizedReferenceType] || "Referensi Stok";
};

const resolveReferenceItems = (record) => {
  const items = [];

  // =========================
  // SECTION: Referensi audit stok yang lebih manusiawi
  // Fungsi:
  // - menampilkan sumber mutasi stok sebagai label bisnis, bukan ID mentah sebagai teks utama
  // - ID teknis tetap disimpan sebagai detail kecil/tooltip agar audit dan pencarian tetap bisa dilakukan
  // Alasan:
  // - kolom Referensi masih berguna untuk audit, tetapi user lebih mudah membaca label seperti Penjualan/Pembelian/Penyesuaian Stok
  // Status:
  // - aktif dipakai di UI Stock Management
  // - fallback top-level dipertahankan sebagai kompatibilitas log legacy
  // =========================
  const saleId = readLogField(record, "saleId");
  const returnId = readLogField(record, "returnId");
  const purchaseId = readLogField(record, "purchaseId");
  const adjustmentId = readLogField(record, "adjustmentId");
  const productionOrderId = readLogField(record, "productionOrderId");
  const productionOrderCode = readLogField(record, "productionOrderCode");
  const workLogId = readLogField(record, "workLogId") || readLogField(record, "workLogRefId");
  const workNumber = readLogField(record, "workNumber");
  const stepName = readLogField(record, "stepName");
  const customerName = readLogField(record, "customerName");
  const supplierName = readLogField(record, "supplierName");
  const reason = readLogField(record, "reason");
  const referenceId = readLogField(record, "referenceId");
  const referenceType = readLogField(record, "referenceType");

  if (saleId) {
    items.push(
      buildReferenceItem({
        label: "Penjualan",
        referenceId: saleId,
        detail: customerName ? `Pelanggan: ${customerName}` : "",
      }),
    );
  }

  if (returnId) {
    items.push(buildReferenceItem({ label: "Retur", referenceId: returnId }));
  }

  if (purchaseId) {
    items.push(
      buildReferenceItem({
        label: "Pembelian",
        referenceId: purchaseId,
        detail: supplierName ? `Supplier: ${supplierName}` : "",
      }),
    );
  }

  if (adjustmentId) {
    items.push(
      buildReferenceItem({
        label: "Penyesuaian Stok",
        referenceId: adjustmentId,
        detail: reason ? `Alasan: ${reason}` : "",
      }),
    );
  }

  if (productionOrderId) {
    items.push(
      buildReferenceItem({
        label: "Production Order",
        referenceId: productionOrderId,
        detail: productionOrderCode ? `Kode: ${productionOrderCode}` : "",
      }),
    );
  }

  if (workLogId) {
    const workLogDetails = [
      workNumber ? `Nomor: ${workNumber}` : "",
      stepName ? `Step: ${stepName}` : "",
    ].filter(Boolean).join(" | ");

    items.push(
      buildReferenceItem({
        label: "Produksi / Work Log",
        referenceId: workLogId,
        detail: workLogDetails,
      }),
    );
  }

  if (!items.length && referenceId) {
    items.push(
      buildReferenceItem({
        label: resolveReferenceTypeLabel(referenceType),
        referenceId,
      }),
    );
  }

  if (reason && !adjustmentId) {
    items.push(buildReferenceItem({ label: "Keterangan", detail: reason }));
  }

  return items;
};

const resolveNoteText = (record) => {
  const explicitNote =
    readLogField(record, "note") ||
    readLogField(record, "description") ||
    readLogField(record, "remark");

  if (explicitNote) return explicitNote;

  if (resolveSourceMeta(record).label !== STOCK_LOG_SOURCE_META.production.label) {
    return "-";
  }

  const workerSummary = resolveProductionWorkerSummary(record);
  if (!workerSummary) {
    return "-";
  }

  const productionNote = [
    workerSummary,
    resolveProductionAuditContextText(record),
  ].filter(Boolean).join(" | ");

  return productionNote || "-";
};

// =========================
// SECTION: Keputusan kolom stok snapshot legacy
// Fungsi:
// - mendokumentasikan kenapa tabel riwayat tidak lagi menampilkan kolom "Stok" generik
// Hubungan flow:
// - inventory_logs lama dan sebagian writer lintas modul belum selalu punya snapshot before/after yang lengkap
// - menampilkan stok saat ini sebagai pengganti akan menyesatkan audit historis
// Status:
// - AKTIF sebagai guard UI agar kolom "Stok" generik tidak menyesatkan audit.
// - GUARDED karena snapshot lama belum reliable untuk semua writer inventory log.
// - LEGACY: sebagian log lama belum punya before/after sehingga tidak boleh dipaksa tampil sebagai stok historis.
// - CLEANUP CANDIDATE jika semua writer inventory log sudah menyimpan snapshot stok reliable.
// =========================
const STOCK_SNAPSHOT_COLUMN_NOTE =
  "Snapshot stok tidak ditampilkan sebagai kolom utama karena tidak semua log lama menyimpan before/after yang reliable.";

// =========================
// SECTION: Style ringkas catatan inventory log
// Fungsi:
// - menjaga kolom Catatan tetap terbaca 1-2 baris tanpa membuat row table terlalu tinggi
// Hubungan flow:
// - Stock Management tetap menjadi audit log operasional, bukan halaman detail panjang
// Status:
// - AKTIF dipakai di tabel riwayat.
// - GUARDED agar catatan panjang tidak membuat row terlalu tinggi.
// - LEGACY: tidak ada logic legacy di style ini.
// - CLEANUP CANDIDATE jika nanti ada komponen table text clamp global.
// =========================
const NOTE_PREVIEW_STYLE = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  whiteSpace: "normal",
  lineHeight: 1.35,
};

const matchesKeyword = (record, keyword) => {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return true;

  const haystacks = [
    record.itemName,
    record.type,
    resolveSourceMeta(record).label,
    resolveItemTypeLabel(record.collectionName),
    resolveVariantLabel(record),
    resolveNoteText(record),
    readLogField(record, "referenceId"),
    readLogField(record, "referenceType"),
    ...(resolveReferenceItems(record).map((item) => item.searchText) || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystacks.includes(normalizedKeyword);
};

const StockManagement = () => {
  // =========================
  // SECTION: State utama log stok
  // Fungsi:
  // - menyimpan list inventory log, status loading, dan filter tampilan
  // Hubungan flow:
  // - halaman ini membaca audit trail dan menjadi container final untuk panel penyesuaian stok
  // Status:
  // - aktif dipakai
  // =========================
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  // =========================
  // SECTION: Load inventory logs
  // Fungsi:
  // - membaca collection inventory_logs via service inventory dengan limit performa
  // Hubungan flow:
  // - service tetap menjadi source pembacaan; page hanya presenter/filter dan tidak melakukan write
  // Status:
  // - aktif dipakai; limit ini bukan mutation dan bukan perubahan business rule
  // =========================
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getInventoryLogs({ limit: INVENTORY_LOG_TABLE_LIMIT });
      setHistory(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil riwayat stok");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // =========================
  // SECTION: Normalisasi & filter data
  // Fungsi:
  // - memperkaya row log dengan label arah, sumber, jenis item, varian, reference, dan note
  // - sorting newest first tetap dilakukan di UI sebagai fallback meski service sudah orderBy timestamp
  // Status:
  // - AKTIF dipakai untuk memastikan riwayat terbaru di atas.
  // - GUARDED karena sorting UI hanya tampilan, bukan hitung ulang stok.
  // - LEGACY: fallback sorting tetap menjaga log lama yang timestamp-nya belum seragam.
  // - CLEANUP CANDIDATE jika service sudah punya pagination server-side final.
  // =========================
  const normalizedHistory = useMemo(() => {
    return [...history]
      .map((record) => ({
        ...record,
        directionMeta: resolveDirectionMeta(record),
        sourceMeta: resolveSourceMeta(record),
        itemTypeLabel: resolveItemTypeLabel(record.collectionName),
        variantLabelResolved: resolveVariantLabel(record),
        referenceItems: resolveReferenceItems(record),
        noteText: resolveNoteText(record),
      }))
      .sort((left, right) => {
        const leftTime = left.timestamp?.toDate?.()?.getTime?.() || 0;
        const rightTime = right.timestamp?.toDate?.()?.getTime?.() || 0;
        return rightTime - leftTime;
      });
  }, [history]);

  const summary = useMemo(() => {
    return normalizedHistory.reduce(
      (accumulator, item) => {
        accumulator.total += 1;
        if (item.directionMeta?.value === "in") accumulator.totalIn += 1;
        if (item.directionMeta?.value === "out") accumulator.totalOut += 1;
        if (item.sourceMeta?.label === STOCK_LOG_SOURCE_META.production.label) {
          accumulator.productionLogs += 1;
        }
        return accumulator;
      },
      {
        total: 0,
        totalIn: 0,
        totalOut: 0,
        productionLogs: 0,
      },
    );
  }, [normalizedHistory]);

  const filteredHistory = useMemo(() => {
    return normalizedHistory.filter((record) => {
      const matchSearch = matchesKeyword(record, search);
      const matchDirection =
        directionFilter === "all" || record.directionMeta?.value === directionFilter;
      const matchSource =
        sourceFilter === "all" ||
        record.sourceMeta?.label === STOCK_LOG_SOURCE_META[sourceFilter]?.label;

      return matchSearch && matchDirection && matchSource;
    });
  }, [directionFilter, normalizedHistory, search, sourceFilter]);

  const summaryItems = useMemo(
    () => [
      {
        key: "stock-log-total",
        title: "Total Log",
        value: formatNumberId(summary.total),
        subtitle: "Jumlah seluruh inventory log yang terbaca.",
        accent: "primary",
      },
      {
        key: "stock-log-in",
        title: "Mutasi Masuk",
        value: formatNumberId(summary.totalIn),
        subtitle: "Log dengan perubahan quantity positif.",
        accent: "success",
      },
      {
        key: "stock-log-out",
        title: "Mutasi Keluar",
        value: formatNumberId(summary.totalOut),
        subtitle: "Log dengan perubahan quantity negatif.",
        accent: "danger",
      },
      {
        key: "stock-log-production",
        title: "Log Produksi",
        value: formatNumberId(summary.productionLogs),
        subtitle: "Log yang berasal dari aktivitas produksi/work log.",
        accent: "warning",
      },
    ],
    [summary],
  );

  const columns = useMemo(
    () => [
      {
        title: "Tanggal",
        dataIndex: "timestamp",
        key: "timestamp",
        width: 160,
        render: (value) => formatLogDate(value),
      },
      {
        title: "Arah",
        key: "direction",
        width: 110,
        render: (_, record) => (
          <Tag color={record.directionMeta?.color || "default"}>
            {record.directionMeta?.label || "-"}
          </Tag>
        ),
      },
      {
        title: "Sumber",
        key: "source",
        width: 130,
        render: (_, record) => (
          <Tag color={record.sourceMeta?.color || "default"}>
            {record.sourceMeta?.label || "-"}
          </Tag>
        ),
      },
      {
        title: "Item",
        key: "item",
        width: 280,
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Text strong>{record.itemName || "-"}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.itemTypeLabel}
            </Text>
            {record.variantLabelResolved ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Varian: {record.variantLabelResolved}
              </Text>
            ) : null}
          </Space>
        ),
      },
      {
        title: "Qty",
        dataIndex: "quantityChange",
        key: "quantityChange",
        width: 120,
        render: (value, record) => (
          <Text
            strong
            style={{ color: record.directionMeta?.value === "in" ? "#389e0d" : "#cf1322" }}
          >
            {formatNumberId(Math.abs(value || 0))}
          </Text>
        ),
      },
      // =========================
      // SECTION: Kolom stok snapshot legacy dinonaktifkan
      // Fungsi:
      // - tabel tidak lagi menampilkan kolom "Stok" generik yang sering kosong/"-"
      // Alasan:
      // - tidak semua inventory_logs punya snapshot before/after yang reliable; menampilkan stok saat ini akan misleading
      // Status:
      // - AKTIF sebagai keputusan UI untuk menghapus kolom stok generic/kosong.
      // - GUARDED karena tabel tidak boleh mengisi stok historis dengan stok saat ini.
      // - LEGACY: inventory log lama belum selalu punya snapshot stok reliable.
      // - CLEANUP CANDIDATE jika semua writer log sudah konsisten dan kolom bisa dibuat ulang sebagai "Stok Setelah".
      // =========================
      {
        title: "Referensi Audit",
        key: "reference",
        width: 230,
        render: (_, record) =>
          Array.isArray(record.referenceItems) && record.referenceItems.length > 0 ? (
            <Space direction="vertical" size={4}>
              {record.referenceItems.map((item) => (
                <Tooltip
                  key={`${item.label}-${item.referenceId || item.detail}`}
                  title={item.referenceId ? `ID referensi: ${item.referenceId}` : item.detail}
                >
                  <Space direction="vertical" size={0}>
                    <Text strong style={{ fontSize: 12 }}>
                      {item.label}
                    </Text>
                    {item.detail ? (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {item.detail}
                      </Text>
                    ) : null}
                  </Space>
                </Tooltip>
              ))}
            </Space>
          ) : (
            <Text type="secondary">-</Text>
          ),
      },
      {
        title: "Catatan",
        key: "note",
        width: 280,
        render: (_, record) => (
          <Tooltip title={record.noteText && record.noteText !== "-" ? record.noteText : ""}>
            <Text style={NOTE_PREVIEW_STYLE}>{record.noteText}</Text>
          </Tooltip>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <PageHeader
        title="Manajemen Stok"
        subtitle="Satu halaman utama inventaris untuk audit riwayat pergerakan stok dan melakukan penyesuaian stok manual."
        actions={[
          {
            key: "refresh-stock-history",
            icon: <ReloadOutlined />,
            label: "Refresh",
            onClick: fetchHistory,
          },
        ]}
      />

      <PageSection
        title="Ringkasan Log"
        subtitle="Ringkasan menggunakan jumlah log, bukan total qty lintas item, agar aman untuk item dengan satuan berbeda."
      >
        <SummaryStatGrid items={summaryItems} columns={{ xs: 24, sm: 12, md: 12, lg: 6 }} />
      </PageSection>

      <PageSection
        title="Filter Riwayat"
        subtitle="Filter membantu audit cepat berdasarkan kata kunci, arah mutasi, dan sumber transaksi. Kolom Sumber / Referensi membaca schema log baru dan fallback log lama."
      >
        <FilterBar>
          <Col xs={24} md={10}>
            <Input
              allowClear
              placeholder="Cari item, varian, sumber audit, supplier, customer..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Col>
          <Col xs={24} md={7}>
            <Select
              style={{ width: "100%" }}
              value={directionFilter}
              onChange={setDirectionFilter}
              options={[
                { value: "all", label: "Semua Arah" },
                { value: "in", label: "Masuk" },
                { value: "out", label: "Keluar" },
              ]}
            />
          </Col>
          <Col xs={24} md={7}>
            <Select
              style={{ width: "100%" }}
              value={sourceFilter}
              onChange={setSourceFilter}
              options={[
                { value: "all", label: "Semua Sumber" },
                { value: "purchase", label: "Pembelian" },
                { value: "production", label: "Produksi" },
                { value: "sales", label: "Penjualan" },
                { value: "return", label: "Retur" },
                { value: "adjustment", label: "Penyesuaian" },
                { value: "other", label: "Lainnya" },
              ]}
            />
          </Col>
        </FilterBar>
      </PageSection>

      <PageSection
        title="Tabel Riwayat Pergerakan Stok"
        subtitle={`Tabel fokus pada audit operasional. Kolom Referensi Audit menampilkan label bisnis, sementara ID teknis hanya menjadi detail kecil. ${STOCK_SNAPSHOT_COLUMN_NOTE}`}
        extra={<Tag color="purple">{formatNumberId(filteredHistory.length)} baris</Tag>}
      >
        <Table
          // AKTIF / GUARDED UI: class standar hanya menyamakan surface riwayat stok; dataSource, columns, dan flow inventory log tidak diubah.
          className="app-data-table"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredHistory}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: <EmptyStateBlock description="Belum ada riwayat mutasi stok." />,
          }}
        />
      </PageSection>

      <PageSection
        title="Area Penyesuaian Stok"
        subtitle="Form adjustment sekarang berada di Manajemen Stok agar audit log dan koreksi stok manual berada dalam satu konteks. Logic submit adjustment hanya aktif dari panel ini."
      >
        {/* =========================
            SECTION: Panel Penyesuaian Stok final
            Fungsi:
            - menampilkan riwayat stock_adjustments dan modal tambah adjustment di halaman Manajemen Stok
            Hubungan flow:
            - menggantikan halaman/menu Penyesuaian Stok lama agar tidak ada dua entry point inventory
            Status:
            - aktif/final; route lama /stock-adjustment hanya redirect ke halaman ini
        ========================= */}
        <StockAdjustmentPanel onAdjustmentSaved={fetchHistory} />
      </PageSection>
    </>
  );
};

export default StockManagement;
