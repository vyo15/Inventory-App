import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
// =====================================================
// Import service log stok langsung dari inventory service aktif.
// Tujuan:
// - menghindari ketergantungan ke shim utils/stockService
// - menjaga halaman Stock Management tetap stabil walaupun file shim sudah tidak ada
// =====================================================
import { getInventoryLogs } from "../../services/Inventory/inventoryService";

const { Title, Text } = Typography;

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

// =====================================================
// Helper format angka tampilan log
// Dipakai hanya untuk presentasi UI, bukan untuk logic stok.
// =====================================================
const formatNumberID = (value) =>
  Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 0,
  });

// =====================================================
// Helper tanggal log agar semua kolom dan reference konsisten.
// =====================================================
const formatLogDate = (value) => {
  if (!value) return "-";
  const parsed = dayjs(value?.toDate?.() || value);
  return parsed.isValid() ? parsed.format("DD-MM-YYYY HH:mm") : "-";
};

// =====================================================
// Helper arah mutasi stok.
// Catatan maintainability:
// - Flow produksi wajib terbaca sebagai dua arah: bahan keluar dan output masuk.
// - Beberapa log lama tidak punya pola type yang rapi, jadi quantity tetap dipakai
//   sebagai fallback untuk menentukan arah mutasi.
// =====================================================
const resolveDirectionMeta = (record = {}) => {
  const type = String(record.type || "").toLowerCase();

  if (
    [
      "purchase_in",
      "return_in",
      "production_output_in",
      "production_in_completed",
      "sale_revert",
      "sale_cancel_revert",
    ].includes(type)
  ) {
    return { value: "in", label: "Masuk", color: "green" };
  }

  if (["sale", "production_material_out", "production_out_pending"].includes(type)) {
    return { value: "out", label: "Keluar", color: "red" };
  }

  if (type === "stock_adjustment") {
    return record.quantityChange >= 0
      ? { value: "in", label: "Masuk", color: "green" }
      : { value: "out", label: "Keluar", color: "red" };
  }

  return record.quantityChange >= 0
    ? { value: "in", label: "Masuk", color: "green" }
    : { value: "out", label: "Keluar", color: "red" };
};

// =====================================================
// Helper sumber mutasi untuk audit harian.
// Sumber ditampilkan terpisah dari arah agar user mudah bedakan
// transaksi pembelian, produksi, penjualan, dan penyesuaian.
// =====================================================
const resolveSourceMeta = (record = {}) => {
  const type = String(record.type || "").toLowerCase();

  if (type.startsWith("purchase")) return STOCK_LOG_SOURCE_META.purchase;
  if (type.startsWith("sale")) return STOCK_LOG_SOURCE_META.sales;
  if (type.startsWith("return")) return STOCK_LOG_SOURCE_META.return;
  if (type.startsWith("production_")) return STOCK_LOG_SOURCE_META.production;
  if (type === "stock_adjustment") return STOCK_LOG_SOURCE_META.adjustment;

  return STOCK_LOG_SOURCE_META.other;
};

// =====================================================
// Helper label item / varian / referensi.
// Semua helper ini murni untuk tampilan agar tabel stok lebih mudah dibaca.
// =====================================================
const resolveItemTypeLabel = (collectionName) =>
  ITEM_COLLECTION_LABELS[collectionName] || "-";

const resolveVariantLabel = (record = {}) =>
  record.variantLabel || record.materialVariantName || "";

const resolveReferenceLines = (record = {}) => {
  const lines = [];

  if (record.productionOrderCode) {
    lines.push(`PO: ${record.productionOrderCode}`);
  }

  if (record.workNumber) {
    lines.push(`WL: ${record.workNumber}`);
  } else if (record.workLogRefId) {
    lines.push(`Work Log ID: ${record.workLogRefId}`);
  }

  if (record.referenceNumber) {
    lines.push(`Ref: ${record.referenceNumber}`);
  }

  if (record.saleId) {
    lines.push(`Sale ID: ${record.saleId}`);
  }

  if (record.supplierName) {
    lines.push(`Supplier: ${record.supplierName}`);
  }

  if (record.customerName) {
    lines.push(`Customer: ${record.customerName}`);
  }

  return lines;
};

const resolveNoteText = (record = {}) =>
  record.note || record.reason || "-";

const matchesKeyword = (record = {}, keyword = "") => {
  const normalizedKeyword = String(keyword || "").trim().toLowerCase();
  if (!normalizedKeyword) return true;

  const haystacks = [
    record.itemName,
    record.type,
    resolveSourceMeta(record).label,
    resolveItemTypeLabel(record.collectionName),
    resolveVariantLabel(record),
    resolveNoteText(record),
    ...(resolveReferenceLines(record) || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystacks.includes(normalizedKeyword);
};

const StockManagement = () => {
  // =====================================================
  // State utama halaman log stok.
  // history = hasil mentah dari Firestore.
  // filter state dipisah agar logic pencarian tetap sederhana.
  // =====================================================
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");

  // =====================================================
  // Ambil seluruh riwayat mutasi stok.
  // Sorting utama tetap dibaca dari service/query, lalu dirapikan ulang lokal
  // sebagai fallback agar log terbaru selalu muncul di atas.
  // =====================================================
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

  // =====================================================
  // Normalisasi data tampilan.
  // Blok ini sengaja dipusatkan di useMemo agar page hanya menghitung ulang
  // saat data log berubah, bukan setiap render kecil.
  // =====================================================
  const normalizedHistory = useMemo(() => {
    return [...history]
      .map((record) => ({
        ...record,
        directionMeta: resolveDirectionMeta(record),
        sourceMeta: resolveSourceMeta(record),
        itemTypeLabel: resolveItemTypeLabel(record.collectionName),
        variantLabelResolved: resolveVariantLabel(record),
        referenceLines: resolveReferenceLines(record),
        noteText: resolveNoteText(record),
      }))
      .sort((a, b) => {
        const aTime = a.timestamp?.toDate?.()?.getTime?.() || 0;
        const bTime = b.timestamp?.toDate?.()?.getTime?.() || 0;
        return bTime - aTime;
      });
  }, [history]);

  // =====================================================
  // Summary card halaman.
  // Gunakan jumlah log, bukan total qty lintas item, karena unit antar item bisa beda.
  // =====================================================
  const summary = useMemo(() => {
    return normalizedHistory.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.directionMeta?.value === "in") acc.totalIn += 1;
        if (item.directionMeta?.value === "out") acc.totalOut += 1;
        if (item.sourceMeta?.label === STOCK_LOG_SOURCE_META.production.label) {
          acc.productionLogs += 1;
        }
        return acc;
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
  }, [normalizedHistory, search, directionFilter, sourceFilter]);

  // =====================================================
  // Kolom tabel log stok.
  // Kolom dibuat fokus ke audit operasional: kapan, arah, sumber,
  // item apa, qty berapa, dan referensinya dari transaksi mana.
  // =====================================================
  const columns = [
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
        <Text strong style={{ color: record.directionMeta?.value === "in" ? "#389e0d" : "#cf1322" }}>
          {formatNumberID(Math.abs(value || 0))}
        </Text>
      ),
    },
    {
      title: "Referensi",
      key: "reference",
      width: 240,
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
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              Riwayat Pergerakan Stok
            </Title>
            <Text type="secondary">
              Pantau mutasi barang masuk dan keluar dari pembelian, produksi, penjualan, retur, dan penyesuaian stok.
            </Text>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={fetchHistory}>
              Refresh
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Total Log" value={summary.total} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Mutasi Masuk" value={summary.totalIn} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Mutasi Keluar" value={summary.totalOut} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="Log Produksi" value={summary.productionLogs} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
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
        </Row>
      </Card>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredHistory}
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: <Empty description="Belum ada riwayat mutasi stok" />,
          }}
        />
      </Card>
    </div>
  );
};

export default StockManagement;
