import React, { useEffect, useMemo, useState } from "react";
import { Col, Input, Select, Space, Table, Tag, Typography, message } from "antd";
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

const STOCK_LOG_SOURCE_META = {
  purchase: { label: "Pembelian", color: "blue" },
  sales: { label: "Penjualan", color: "volcano" },
  production: { label: "Produksi", color: "purple" },
  return: { label: "Retur", color: "cyan" },
  adjustment: { label: "Penyesuaian", color: "orange" },
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

const resolveReferenceLines = (record) => {
  const lines = [];

  // =========================
  // SECTION: Referensi mutasi stok yang lebih manusiawi
  // Fungsi:
  // - menerjemahkan ID referensi mentah menjadi konteks sumber transaksi
  // - membaca schema baru (details/referenceId) dan schema lama (top-level) secara aman
  // Status:
  // - aktif dipakai di UI Stock Management
  // - fallback top-level dipertahankan supaya log lama tetap terbaca
  // =========================
  const saleId = readLogField(record, "saleId");
  const returnId = readLogField(record, "returnId");
  const purchaseId = readLogField(record, "purchaseId");
  const adjustmentId = readLogField(record, "adjustmentId");
  const productionOrderId = readLogField(record, "productionOrderId");
  const workLogId = readLogField(record, "workLogId") || readLogField(record, "workLogRefId");
  const customerName = readLogField(record, "customerName");
  const supplierName = readLogField(record, "supplierName");
  const reason = readLogField(record, "reason");
  const referenceId = readLogField(record, "referenceId");
  const referenceType = readLogField(record, "referenceType");

  if (saleId) lines.push(`Penjualan: ${saleId}`);
  if (returnId) lines.push(`Retur: ${returnId}`);
  if (purchaseId) lines.push(`Pembelian: ${purchaseId}`);
  if (adjustmentId) lines.push(`Adjustment: ${adjustmentId}`);
  if (productionOrderId) lines.push(`PO: ${productionOrderId}`);
  if (workLogId) lines.push(`Work Log: ${workLogId}`);
  if (!saleId && !returnId && !purchaseId && !adjustmentId && !productionOrderId && !workLogId && referenceId) {
    lines.push(`${referenceType || "Referensi"}: ${referenceId}`);
  }
  if (customerName) lines.push(`Pelanggan: ${customerName}`);
  if (supplierName) lines.push(`Supplier: ${supplierName}`);
  if (reason) lines.push(`Alasan: ${reason}`);

  return lines;
};

const resolveNoteText = (record) =>
  readLogField(record, "note") ||
  readLogField(record, "description") ||
  readLogField(record, "remark") ||
  "-";

// =========================
// SECTION: Helper stok sebelum/sesudah untuk audit log
// Fungsi:
// - membaca currentStockBefore/currentStockAfter dan availableStockBefore/availableStockAfter dari schema baru
// - fallback aman untuk log lama yang belum menyimpan detail stok
// Hubungan flow:
// - membuat log adjustment lebih mudah diaudit setelah mutasi memakai updateInventoryStock()
// Status:
// - aktif/final untuk reader; fallback kosong adalah kompatibilitas legacy
// =========================
const resolveStockLevelLines = (record) => {
  const currentStockBefore = readLogField(record, "currentStockBefore", null);
  const currentStockAfter =
    readLogField(record, "currentStockAfter", null) ?? readLogField(record, "newStock", null);
  const availableStockBefore = readLogField(record, "availableStockBefore", null);
  const availableStockAfter = readLogField(record, "availableStockAfter", null);

  const lines = [];

  if (currentStockBefore !== null || currentStockAfter !== null) {
    lines.push(
      `Current: ${formatNumberId(currentStockBefore || 0)} -> ${formatNumberId(
        currentStockAfter || 0,
      )}`,
    );
  }

  if (availableStockBefore !== null || availableStockAfter !== null) {
    lines.push(
      `Available: ${formatNumberId(availableStockBefore || 0)} -> ${formatNumberId(
        availableStockAfter || 0,
      )}`,
    );
  }

  return lines;
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
    ...(resolveReferenceLines(record) || []),
    ...(resolveStockLevelLines(record) || []),
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
  // - membaca collection inventory_logs via service inventory
  // Hubungan flow:
  // - service tetap menjadi source pembacaan; page hanya presenter/filter
  // Status:
  // - aktif dipakai
  // =========================
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getInventoryLogs();
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
  // - aktif dipakai; fallback sorting aman untuk log lama
  // =========================
  const normalizedHistory = useMemo(() => {
    return [...history]
      .map((record) => ({
        ...record,
        directionMeta: resolveDirectionMeta(record),
        sourceMeta: resolveSourceMeta(record),
        itemTypeLabel: resolveItemTypeLabel(record.collectionName),
        variantLabelResolved: resolveVariantLabel(record),
        referenceLines: resolveReferenceLines(record),
        stockLevelLines: resolveStockLevelLines(record),
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
      {
        title: "Stok",
        key: "stockLevels",
        width: 190,
        render: (_, record) =>
          Array.isArray(record.stockLevelLines) && record.stockLevelLines.length > 0 ? (
            <Space direction="vertical" size={2}>
              {record.stockLevelLines.map((line) => (
                <Text key={line} type="secondary" style={{ fontSize: 12 }}>
                  {line}
                </Text>
              ))}
            </Space>
          ) : (
            <Text type="secondary">-</Text>
          ),
      },
      {
        title: "Sumber / Referensi",
        key: "reference",
        width: 260,
        render: (_, record) =>
          Array.isArray(record.referenceLines) && record.referenceLines.length > 0 ? (
            <Space direction="vertical" size={2}>
              {record.referenceLines.map((line) => (
                <Text key={line} type="secondary" style={{ fontSize: 12 }}>
                  {line}
                </Text>
              ))}
            </Space>
          ) : (
            <Text type="secondary">-</Text>
          ),
      },
      {
        title: "Catatan",
        key: "note",
        render: (_, record) => <Text>{record.noteText}</Text>,
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
              placeholder="Cari item, varian, referensi, supplier, customer..."
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
        subtitle="Tabel tetap fokus pada audit operasional: kapan, dari mana, item apa, qty berapa, dan referensinya dari transaksi mana."
        extra={<Tag color="purple">{formatNumberId(filteredHistory.length)} baris</Tag>}
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredHistory}
          scroll={{ x: 1380 }}
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
