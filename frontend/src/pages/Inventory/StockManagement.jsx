import { useEffect, useMemo, useState } from "react";
import { Button, Col, Drawer, Input, Select, Space, Tag, Tooltip, Typography, message } from "antd";
import dayjs from "dayjs";
import SummaryStatGrid from "../../components/Layout/Display/SummaryStatGrid";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import FilterBar from "../../components/Layout/Filters/FilterBar";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import DataTableView from "../../components/Layout/Table/DataTableView";
import StockAdjustmentPanel from "./components/StockAdjustmentPanel";
import { getInventoryLogs } from "../../services/Inventory/inventoryService";
import { formatNumberId } from "../../utils/formatters/numberId";
import { getDataTableEmptyText } from "../../components/Layout/Feedback/DataLoadingState";
import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";
import { buildPurchaseLogNoteDisplayMeta } from "../../utils/purchases/purchaseNoteDisplay";
import { EyeOutlined } from "@ant-design/icons";

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
// SECTION: Helper satuan qty inventory log
// Fungsi:
// - menampilkan Qty riwayat stok bersama satuan stok yang dikirim writer baru
// - fallback produk/semi finished tetap pcs, sedangkan bahan baku legacy tanpa satuan tidak dipaksa menjadi pcs
// Hubungan flow:
// - hanya reader UI Stock Management; tidak mengubah quantityChange, stok, HPP, purchase, sales, return, atau produksi
// Status:
// - AKTIF untuk log baru yang punya stockUnit/unit
// - LEGACY-COMPAT untuk log lama yang belum menyimpan satuan
// =========================
const resolveLogStockUnit = (record = {}) => {
  const explicitUnit = String(
    readLogField(record, "stockUnit") ||
      readLogField(record, "unit") ||
      readLogField(record, "baseUnit") ||
      readLogField(record, "targetUnit") ||
      "",
  ).trim();

  if (explicitUnit) return explicitUnit;

  if (["products", "semi_finished_materials"].includes(record?.collectionName)) {
    return "pcs";
  }

  return "";
};

const formatLogQuantityWithUnit = (value, record = {}) => {
  const unit = resolveLogStockUnit(record);
  const quantityText = formatNumberId(Math.abs(Number(value || 0)));

  return unit ? `${quantityText} ${unit}` : quantityText;
};

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

const PRODUCTION_AUDIT_NOTE_SEGMENT_PREFIXES = [
  "work log:",
  "po:",
  "step:",
  "production order:",
  "no. order produksi:",
  "order produksi:",
  "produksi / work log:",
];

const isProductionLogRecord = (record) => resolveSourceMeta(record).label === STOCK_LOG_SOURCE_META.production.label;

const sanitizeProductionNoteText = (noteText = "", record = {}) => {
  const normalizedNote = String(noteText || "").trim();
  if (!normalizedNote || !isProductionLogRecord(record)) return normalizedNote;

  const segments = normalizedNote
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (!segments.length) return normalizedNote;

  const filteredSegments = segments.filter((segment) => {
    const normalizedSegment = segment.toLowerCase();
    return !PRODUCTION_AUDIT_NOTE_SEGMENT_PREFIXES.some((prefix) => normalizedSegment.startsWith(prefix));
  });

  if (filteredSegments.length === segments.length) return normalizedNote;

  const workerSummary = resolveProductionWorkerSummary(record);
  const mergedSegments = [...filteredSegments];
  if (workerSummary && !mergedSegments.some((segment) => segment.toLowerCase().startsWith("operator:"))) {
    mergedSegments.unshift(workerSummary);
  }

  return mergedSegments.join(" | ") || workerSummary || "-";
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

const normalizeReferenceText = (value = "") => String(value ?? "").trim();

const isLikelyTechnicalReferenceId = (value = "") => {
  const normalizedValue = normalizeReferenceText(value);
  if (!normalizedValue) return false;
  if (normalizedValue.includes("-") || normalizedValue.includes("/") || normalizedValue.includes(" ")) {
    return false;
  }

  return /^[A-Za-z0-9_-]{18,28}$/.test(normalizedValue);
};

const resolveDisplayableReference = ({ referenceId = "", businessReference = "" }) => {
  const normalizedBusinessReference = normalizeReferenceText(businessReference);
  const normalizedReferenceId = normalizeReferenceText(referenceId);

  if (normalizedBusinessReference) return normalizedBusinessReference;
  if (normalizedReferenceId && !isLikelyTechnicalReferenceId(normalizedReferenceId)) {
    return normalizedReferenceId;
  }

  return "";
};

const buildReferenceItem = ({ label, referenceId = "", businessReference = "", detail = "" }) => {
  const normalizedReferenceId = normalizeReferenceText(referenceId);
  const normalizedBusinessReference = normalizeReferenceText(businessReference);
  const normalizedDetail = normalizeReferenceText(detail);
  const displayReference = resolveDisplayableReference({
    referenceId: normalizedReferenceId,
    businessReference: normalizedBusinessReference,
  });
  const detailLines = [
    displayReference ? `Ref: ${displayReference}` : "",
    normalizedDetail,
  ].filter(Boolean);
  const detailText = detailLines.join(" | ");

  return {
    label,
    referenceId: normalizedReferenceId,
    businessReference: displayReference,
    detail: detailText,
    tooltipText: detailText || label,
    // ID teknis tetap masuk searchText agar audit/search legacy masih bisa menemukan log, tetapi tidak ditampilkan di teks utama/tooltip.
    searchText: [label, displayReference, normalizedBusinessReference, normalizedReferenceId, normalizedDetail]
      .filter(Boolean)
      .join(" "),
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
  // - ID teknis hanya dipakai untuk pencarian internal agar tampilan audit tidak dobel/kotor
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
  const businessReference = resolveDisplayReference(record, {
    fallback: "",
    includeDefaultFields: false,
    fields: [
      "saleNumber",
      "purchaseNumber",
      "returnNumber",
      "adjustmentNumber",
      "cashInNumber",
      "cashOutNumber",
      "referenceNumber",
      "sourceRef",
      "referenceCode",
      "workNumber",
      "payrollNumber",
      "productionOrderCode",
      "planningCode",
    ],
  });

  if (saleId) {
    items.push(
      buildReferenceItem({
        label: "Penjualan",
        referenceId: saleId,
        businessReference,
        detail: customerName ? `Pelanggan: ${customerName}` : "",
      }),
    );
  }

  if (returnId) {
    items.push(buildReferenceItem({ label: "Retur", referenceId: returnId, businessReference }));
  }

  if (purchaseId) {
    items.push(
      buildReferenceItem({
        label: "Pembelian",
        referenceId: purchaseId,
        businessReference,
        detail: supplierName ? `Supplier: ${supplierName}` : "",
      }),
    );
  }

  if (adjustmentId) {
    items.push(
      buildReferenceItem({
        label: "Penyesuaian Stok",
        referenceId: adjustmentId,
        businessReference,
        detail: reason ? `Alasan: ${reason}` : "",
      }),
    );
  }

  if (productionOrderId) {
    items.push(
      buildReferenceItem({
        label: "Production Order",
        referenceId: productionOrderId,
        businessReference: productionOrderCode || businessReference,
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
        businessReference: workNumber || businessReference,
        detail: stepName ? `Step: ${stepName}` : workLogDetails,
      }),
    );
  }

  if (!items.length && referenceId) {
    items.push(
      buildReferenceItem({
        label: resolveReferenceTypeLabel(referenceType),
        referenceId,
        businessReference,
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

  if (!isProductionLogRecord(record)) {
    return explicitNote || "-";
  }

  // =====================================================
  // SECTION: Catatan produksi compact — AKTIF
  // Fungsi:
  // - Menampilkan operator/catatan produksi tanpa mengulang PO/Work Log/Step yang sudah ada di kolom Referensi Audit.
  //
  // Dipakai oleh:
  // - Tabel Stock Management dan pencarian riwayat stok.
  //
  // Alasan perubahan:
  // - Note produksi lama dan writer output sebelumnya menyimpan `Operator | Work Log | PO | Step`, sehingga kolom Catatan tetap dobel walau Referensi Audit sudah benar.
  //
  // Catatan cleanup:
  // - Data inventory_logs lama tidak dimigrasi; sanitasi ini hanya reader UI. Writer produksi baru juga tidak lagi membuat note konteks dobel.
  //
  // Risiko:
  // - Jangan membuang catatan manual non-teknis; hanya segmen konteks produksi yang sudah tampil di Referensi Audit yang disembunyikan dari Catatan.
  // =====================================================
  const sanitizedExplicitNote = sanitizeProductionNoteText(explicitNote, record);
  if (sanitizedExplicitNote) return sanitizedExplicitNote;

  const workerSummary = resolveProductionWorkerSummary(record);
  return workerSummary || "-";
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
  const [selectedStockLogDetail, setSelectedStockLogDetail] = useState(null);

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
        noteDisplayMeta: buildPurchaseLogNoteDisplayMeta(resolveNoteText(record)),
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

  // =========================
  // SECTION: Detail read-only inventory log untuk mobile card
  // Fungsi:
  // - membuka drawer detail dari kartu mobile riwayat stok tanpa membuat mutation baru.
  // Hubungan flow:
  // - hanya memakai record inventory log yang sudah terbaca di tabel; tidak fetch/write stock, purchase, sales, return, atau produksi.
  // Status:
  // - AKTIF sebagai UI audit ringkas di mobile.
  // - GUARDED karena drawer ini tidak boleh menjadi entry point perubahan stok.
  // =========================
  const openStockLogDetail = (record) => {
    setSelectedStockLogDetail(record);
  };

  const closeStockLogDetail = () => {
    setSelectedStockLogDetail(null);
  };

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
            style={{ color: record.directionMeta?.value === "in" ? "var(--ims-color-success-text)" : "var(--ims-color-danger-text)" }}
          >
            {formatLogQuantityWithUnit(value, record)}
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
                  title={item.tooltipText || item.detail || item.label}
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
        render: (_, record) => {
          const noteMeta = record.noteDisplayMeta || buildPurchaseLogNoteDisplayMeta(record.noteText);
          const tooltipTitle = noteMeta.fullNote && noteMeta.fullNote !== "-" ? <span style={{ whiteSpace: "pre-line" }}>{noteMeta.fullNote}</span> : "";

          if (!noteMeta.fullNote || noteMeta.fullNote === "-") {
            return <Text type="secondary">-</Text>;
          }

          if (!noteMeta.hasShopeeOcrNote) {
            return (
              <Tooltip title={tooltipTitle}>
                <Text className="ims-note-preview">{noteMeta.fullNote}</Text>
              </Tooltip>
            );
          }

          return (
            <Tooltip title={tooltipTitle}>
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <div className="ims-note-tag-row">
                  <Tag color="blue" style={{ marginInlineEnd: 0 }}>OCR Shopee</Tag>
                  {noteMeta.conversionNote ? <Tag color="cyan" style={{ marginInlineEnd: 0 }}>Konversi Stok</Tag> : null}
                </div>
                {noteMeta.manualPreview ? <Text className="ims-note-inline">{noteMeta.manualPreview}</Text> : null}
                {noteMeta.conversionNote ? <Text className="ims-cell-caption">{noteMeta.conversionNote}</Text> : null}
              </Space>
            </Tooltip>
          );
        },
      },
    ],
    [],
  );


  const stockHistoryMobileCardConfig = {
    title: (record) => record.itemName || "-",
    subtitle: (record) => [
      formatLogDate(record.timestamp),
      record.itemTypeLabel || resolveItemTypeLabel(record.collectionName),
      record.variantLabelResolved ? `Varian: ${record.variantLabelResolved}` : null,
    ].filter(Boolean),
    tags: (record) => [
      <Tag key="direction" color={record.directionMeta?.color || "default"}>
        {record.directionMeta?.label || "-"}
      </Tag>,
      <Tag key="source" color={record.sourceMeta?.color || "default"}>
        {record.sourceMeta?.label || "-"}
      </Tag>,
    ],
    meta: [
      {
        label: "Qty",
        value: (record) => (
          <Text
            strong
            style={{ color: record.directionMeta?.value === "in" ? "var(--ims-color-success-text)" : "var(--ims-color-danger-text)" }}
          >
            {formatLogQuantityWithUnit(record.quantityChange, record)}
          </Text>
        ),
      },
      {
        label: "Referensi",
        value: (record) => {
          const primaryReference = Array.isArray(record.referenceItems) ? record.referenceItems[0] : null;
          return primaryReference?.businessReference || primaryReference?.label || "-";
        },
      },
    ],
    content: (record) => {
      const noteMeta = record.noteDisplayMeta || buildPurchaseLogNoteDisplayMeta(record.noteText);
      if (!noteMeta.fullNote || noteMeta.fullNote === "-") return null;

      return <span className="ims-note-preview">{noteMeta.fullNote}</span>;
    },
    actions: (record) => (
      <Button
        className="ims-action-button"
        icon={<EyeOutlined />}
        size="small"
        onClick={() => openStockLogDetail(record)}
      >
        Detail
      </Button>
    ),
  };

  return (
    <>
      <PageHeader
        title="Manajemen Stok"
        subtitle="Audit stok dan penyesuaian manual."
      />

      <PageSection
        title="Ringkasan Log"
        subtitle="Ringkasan jumlah log."
      >
        <SummaryStatGrid items={summaryItems} columns={{ xs: 24, sm: 12, md: 12, lg: 6 }} />
      </PageSection>

      <PageSection
        title="Filter Riwayat"
        subtitle="Filter audit stok."
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
        subtitle={`Audit operasional. ${STOCK_SNAPSHOT_COLUMN_NOTE}`}
        extra={<Tag color="purple">{formatNumberId(filteredHistory.length)} baris</Tag>}
      >
        <DataTableView
          // AKTIF / GUARDED UI: DataTableView hanya mengganti renderer mobile card; dataSource, columns, dan flow inventory log tidak diubah.
          className="app-data-table"
          rowKey="id"
          columns={columns}
          dataSource={filteredHistory}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: getDataTableEmptyText(loading, <EmptyStateBlock description="Belum ada riwayat mutasi stok." />),
          }}
          loading={loading}
          mobileCardConfig={stockHistoryMobileCardConfig}
        />
      </PageSection>

      <PageSection
        title="Area Penyesuaian Stok"
        subtitle="Adjustment stok manual dengan audit log."
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

      <Drawer
        title="Detail Riwayat Stok"
        open={Boolean(selectedStockLogDetail)}
        onClose={closeStockLogDetail}
        width="min(100vw, 420px)"
      >
        {selectedStockLogDetail ? (
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <div className="ims-cell-stack">
              <Text type="secondary">Tanggal</Text>
              <Text strong>{formatLogDate(selectedStockLogDetail.timestamp)}</Text>
            </div>
            <div className="ims-cell-stack">
              <Text type="secondary">Item</Text>
              <Text strong>{selectedStockLogDetail.itemName || "-"}</Text>
              <Text type="secondary">
                {selectedStockLogDetail.itemTypeLabel || resolveItemTypeLabel(selectedStockLogDetail.collectionName)}
                {selectedStockLogDetail.variantLabelResolved ? ` • Varian: ${selectedStockLogDetail.variantLabelResolved}` : ""}
              </Text>
            </div>
            <Space wrap>
              <Tag color={selectedStockLogDetail.directionMeta?.color || "default"}>
                {selectedStockLogDetail.directionMeta?.label || "-"}
              </Tag>
              <Tag color={selectedStockLogDetail.sourceMeta?.color || "default"}>
                {selectedStockLogDetail.sourceMeta?.label || "-"}
              </Tag>
            </Space>
            <div className="ims-cell-stack">
              <Text type="secondary">Qty</Text>
              <Text
                strong
                style={{ color: selectedStockLogDetail.directionMeta?.value === "in" ? "var(--ims-color-success-text)" : "var(--ims-color-danger-text)" }}
              >
                {formatLogQuantityWithUnit(selectedStockLogDetail.quantityChange, selectedStockLogDetail)}
              </Text>
            </div>
            <div className="ims-cell-stack">
              <Text type="secondary">Referensi Audit</Text>
              {Array.isArray(selectedStockLogDetail.referenceItems) && selectedStockLogDetail.referenceItems.length > 0 ? (
                <Space direction="vertical" size={6}>
                  {selectedStockLogDetail.referenceItems.map((item) => (
                    <div key={`${item.label}-${item.referenceId || item.detail}`} className="ims-cell-stack ims-cell-stack-tight">
                      <Text strong>{item.label}</Text>
                      {item.detail ? <Text type="secondary">{item.detail}</Text> : null}
                    </div>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">-</Text>
              )}
            </div>
            <div className="ims-cell-stack">
              <Text type="secondary">Catatan</Text>
              <Text>{selectedStockLogDetail.noteText || "-"}</Text>
            </div>
          </Space>
        ) : null}
      </Drawer>
    </>
  );
};

export default StockManagement;
