import React, { useEffect, useState } from "react";
import {
  Alert,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  AppstoreOutlined,
  DatabaseOutlined,
  ShoppingCartOutlined,
  WarningOutlined,
  HistoryOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { formatNumberId } from "../../utils/formatters/numberId";
import SalesChart from "../../components/Dashboard/SalesChart";
import "./Dashboard.css";

const { Text } = Typography;

// =========================
// SECTION: Constants
// =========================
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

// =========================
// SECTION: Helpers
// =========================
const getNumericValue = (value) => {
  if (typeof value === "number" && !Number.isNaN(value)) return value;

  if (typeof value === "string") {
    const normalized = value.replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

const getSalesTotal = (sale) => {
  const candidates = [
    sale?.grandTotal,
    sale?.totalAmount,
    sale?.finalAmount,
    sale?.total,
    sale?.amountPaid,
  ];

  for (const candidate of candidates) {
    const value = getNumericValue(candidate);
    if (value > 0) return value;
  }

  return 0;
};

const getTransactionDate = (record) => {
  const candidates = [
    record?.date,
    record?.transactionDate,
    record?.createdAt,
    record?.timestamp,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (typeof candidate?.toDate === "function") {
      return candidate.toDate();
    }

    if (candidate instanceof Date) {
      return candidate;
    }

    if (typeof candidate === "string" || typeof candidate === "number") {
      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return null;
};

const isValidSalesStatus = (sale) => {
  const status = String(sale?.status || "")
    .trim()
    .toLowerCase();

  const invalidStatuses = [
    "cancelled",
    "canceled",
    "dibatalkan",
    "batal",
    "void",
  ];
  return !invalidStatuses.includes(status);
};

const buildMonthlySalesChart = (salesList) => {
  const currentYear = new Date().getFullYear();

  const result = MONTH_LABELS.map((month) => ({
    month,
    sales: 0,
  }));

  salesList.forEach((sale) => {
    if (!isValidSalesStatus(sale)) return;

    const transactionDate = getTransactionDate(sale);
    if (!transactionDate) return;
    if (transactionDate.getFullYear() !== currentYear) return;

    const total = getSalesTotal(sale);
    if (total <= 0) return;

    result[transactionDate.getMonth()].sales += total;
  });

  return result;
};

const getCurrentMonthSalesTotal = (salesList) => {
  const now = new Date();

  return salesList.reduce((acc, sale) => {
    if (!isValidSalesStatus(sale)) return acc;

    const transactionDate = getTransactionDate(sale);
    if (!transactionDate) return acc;
    if (transactionDate.getFullYear() !== now.getFullYear()) return acc;
    if (transactionDate.getMonth() !== now.getMonth()) return acc;

    return acc + getSalesTotal(sale);
  }, 0);
};

const formatActivityType = (type) => {
  const normalized = String(type || "").toLowerCase();

  if (normalized.includes("purchase"))
    return { label: "Pembelian", color: "green" };
  if (normalized.includes("sale")) return { label: "Penjualan", color: "blue" };
  if (normalized.includes("return")) return { label: "Retur", color: "orange" };
  if (normalized.includes("adjust"))
    return { label: "Penyesuaian", color: "gold" };
  if (normalized.includes("production"))
    return { label: "Produksi", color: "purple" };
  if (normalized.includes("in"))
    return { label: type || "Masuk", color: "green" };
  if (normalized.includes("out"))
    return { label: type || "Keluar", color: "red" };

  return { label: type || "-", color: "default" };
};

// =========================
// SECTION: Dashboard
// =========================
const Dashboard = () => {
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalMaterials, setTotalMaterials] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [lowStockMaterials, setLowStockMaterials] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [salesChartData, setSalesChartData] = useState(
    MONTH_LABELS.map((month) => ({ month, sales: 0 })),
  );
  const [salesThisMonth, setSalesThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  const lowStockTotal = lowStockProducts.length + lowStockMaterials.length;

  useEffect(() => {
    const initDashboard = async () => {
      try {
        setLoading(true);

        const productsQuery = query(
          collection(db, "products"),
          where("stock", "<=", 5),
        );

        const materialsQuery = query(
          collection(db, "raw_materials"),
          where("stock", "<=", 10),
        );

        const recentTransactionsQuery = query(
          collection(db, "inventory_logs"),
          orderBy("timestamp", "desc"),
          limit(6),
        );

        const [
          productCountSnap,
          materialCountSnap,
          productsSnap,
          materialsSnap,
          recentTransactionsSnap,
          salesSnap,
        ] = await Promise.all([
          getCountFromServer(collection(db, "products")),
          getCountFromServer(collection(db, "raw_materials")),
          getDocs(productsQuery),
          getDocs(materialsQuery),
          getDocs(recentTransactionsQuery),
          getDocs(collection(db, "sales")),
        ]);

        setTotalProducts(productCountSnap.data().count || 0);
        setTotalMaterials(materialCountSnap.data().count || 0);

        setLowStockProducts(
          productsSnap.docs.map((docItem) => ({
            id: docItem.id,
            ...docItem.data(),
          })),
        );

        setLowStockMaterials(
          materialsSnap.docs.map((docItem) => ({
            id: docItem.id,
            ...docItem.data(),
          })),
        );

        setRecentTransactions(
          recentTransactionsSnap.docs.map((docItem) => ({
            id: docItem.id,
            ...docItem.data(),
          })),
        );

        const salesList = salesSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));

        setSalesChartData(buildMonthlySalesChart(salesList));
        setSalesThisMonth(getCurrentMonthSalesTotal(salesList));
      } catch (error) {
        console.error("Gagal memuat dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    initDashboard();
  }, []);

  // =========================
  // SECTION: KPI Data
  // =========================
  const summaryData = [
    {
      key: "products",
      title: "Produk Jadi",
      value: totalProducts,
      subtitle: "Master produk aktif",
      prefix: <AppstoreOutlined />,
      color: "#16a34a",
      formatter: (value) => formatNumberId(value),
    },
    {
      key: "materials",
      title: "Bahan Baku",
      value: totalMaterials,
      subtitle: "Master bahan aktif",
      prefix: <DatabaseOutlined />,
      color: "#2563eb",
      formatter: (value) => formatNumberId(value),
    },
    {
      key: "low-stock",
      title: "Stok Menipis",
      value: lowStockTotal,
      subtitle: "Perlu restock/monitoring",
      prefix: <WarningOutlined />,
      color: "#f59e0b",
      formatter: (value) => formatNumberId(value),
    },
    {
      key: "sales-month",
      title: "Penjualan Bulan Ini",
      value: salesThisMonth,
      subtitle: "Akumulasi bulan berjalan",
      prefix: <ShoppingCartOutlined />,
      color: "#7c3aed",
      formatter: (value) => `Rp ${formatNumberId(value)}`,
    },
  ];

  // =========================
  // SECTION: Low Stock Table
  // =========================
  const lowStockRows = [...lowStockProducts, ...lowStockMaterials]
    .map((item) => ({
      key: item.id,
      name: item.name || item.productName || item.materialName || "-",
      stock: item.stock || 0,
      unit: item.unit || "-",
      type: lowStockProducts.some((p) => p.id === item.id) ? "Produk" : "Bahan",
    }))
    .slice(0, 8);

  const lowStockColumns = [
    {
      title: "Item",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
    },
    {
      title: "Stok",
      dataIndex: "stock",
      key: "stock",
      width: 120,
      render: (value, record) => (
        <Text>
          {formatNumberId(value)} {record.unit}
        </Text>
      ),
    },
  ];

  // =========================
  // SECTION: Recent Activities Table
  // =========================
  const activityColumns = [
    {
      title: "Aktivitas",
      dataIndex: "type",
      key: "type",
      width: 150,
      render: (value) => {
        const activity = formatActivityType(value);
        return <Tag color={activity.color}>{activity.label}</Tag>;
      },
    },
    {
      title: "Item",
      dataIndex: "itemName",
      key: "itemName",
      ellipsis: true,
      render: (value, record) =>
        value ||
        record?.name ||
        record?.productName ||
        record?.materialName ||
        "-",
    },
    {
      title: "Jumlah",
      dataIndex: "quantityChange",
      key: "quantityChange",
      width: 110,
      render: (value) => formatNumberId(Math.abs(value || 0)),
    },
    {
      title: "Catatan",
      dataIndex: "note",
      key: "note",
      ellipsis: true,
      render: (value) => value || "-",
    },
  ];

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan operasional bisnis, aktivitas terbaru, dan indikator utama inventaris."
      />

      {lowStockTotal > 0 && (
        <div className="dashboard-alert-wrap">
          <Alert
            type="warning"
            showIcon
            message="Perhatian stok menipis"
            description={`${formatNumberId(
              lowStockTotal,
            )} item berada di bawah batas aman dan perlu dipantau.`}
          />
        </div>
      )}

      {/* =========================
          SECTION: KPI Cards
      ========================= */}
      <Row gutter={[16, 16]} className="dashboard-summary-row">
        {summaryData.map((item) => (
          <Col xs={24} sm={12} xl={6} key={item.key}>
            <Card className="dashboard-stat-card" bordered={false}>
              <Statistic
                title={item.title}
                value={item.value}
                prefix={item.prefix}
                formatter={item.formatter}
                valueStyle={{ color: item.color }}
              />
              <Text className="dashboard-stat-subtitle">{item.subtitle}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* =========================
          SECTION: Main Panels
      ========================= */}
      <Row gutter={[16, 16]} className="dashboard-main-grid">
        <Col xs={24} xl={15}>
          <PageSection
            title="Penjualan Bulanan"
            subtitle="Performa penjualan dari transaksi real tahun berjalan."
            extra={
              <Space size={8}>
                <BarChartOutlined className="dashboard-section-icon" />
                <Text className="dashboard-section-extra">
                  Tahun {new Date().getFullYear()}
                </Text>
              </Space>
            }
          >
            <div className="dashboard-chart-wrap">
              <SalesChart data={salesChartData} />
            </div>
          </PageSection>
        </Col>

        <Col xs={24} xl={9}>
          <PageSection
            title="Stok Menipis"
            subtitle="Item yang paling perlu diperhatikan saat ini."
            extra={
              <Text className="dashboard-section-extra">
                {formatNumberId(lowStockRows.length)} item
              </Text>
            }
          >
            {lowStockRows.length > 0 ? (
              <Table
                dataSource={lowStockRows}
                columns={lowStockColumns}
                pagination={false}
                size="small"
                loading={loading}
                scroll={{ x: 480 }}
              />
            ) : (
              <div className="dashboard-empty-wrap">
                <Empty description="Belum ada item dengan stok menipis." />
              </div>
            )}
          </PageSection>
        </Col>
      </Row>

      {/* =========================
          SECTION: Recent Activities
      ========================= */}
      <PageSection
        title="Aktivitas Terbaru"
        subtitle="Riwayat aktivitas inventaris yang tercatat terakhir."
        extra={
          <Space size={8}>
            <HistoryOutlined className="dashboard-section-icon" />
            <Text className="dashboard-section-extra">
              {formatNumberId(recentTransactions.length)} aktivitas
            </Text>
          </Space>
        }
      >
        <Table
          dataSource={recentTransactions.map((item) => ({
            ...item,
            key: item.id,
          }))}
          columns={activityColumns}
          pagination={false}
          loading={loading}
          scroll={{ x: 760 }}
          locale={{
            emptyText: (
              <div className="dashboard-empty-wrap">
                <Empty description="Belum ada aktivitas yang bisa ditampilkan." />
              </div>
            ),
          }}
        />
      </PageSection>
    </div>
  );
};

export default Dashboard;
