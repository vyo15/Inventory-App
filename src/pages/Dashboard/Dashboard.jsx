import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  ArrowRightOutlined,
  BarChartOutlined,
  BuildOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  DollarCircleOutlined,
  HistoryOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../firebase";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { formatNumberId } from "../../utils/formatters/numberId";
import SalesChart from "../../components/Dashboard/SalesChart";
import "./Dashboard.css";

const { Text, Title } = Typography;

// =========================
// SECTION: Constants
// Fungsi:
// - daftar label bulan untuk chart penjualan tahunan
// - daftar quick action yang muncul di dashboard agar user tidak perlu
//   bolak-balik buka sidebar saat pekerjaan harian sedang padat
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

const QUICK_ACTIONS = [
  {
    key: "create-purchase",
    label: "Input Pembelian",
    description: "Tambah pembelian bahan baku atau barang masuk.",
    to: "/purchases",
  },
  {
    key: "open-stock",
    label: "Cek Stok",
    description: "Pantau stok bahan, semi finished, dan produk jadi.",
    to: "/stock-management",
  },
  {
    key: "open-po",
    label: "Buat / Cek PO",
    description: "Lanjutkan antrian produksi dari Production Order.",
    to: "/produksi/production-orders",
  },
  {
    key: "open-worklog",
    label: "Buka Work Log",
    description: "Pantau pekerjaan produksi yang sedang berjalan.",
    to: "/produksi/work-log-produksi",
  },
  {
    key: "open-payroll",
    label: "Payroll Produksi",
    description: "Review payroll dari work log yang sudah selesai.",
    to: "/produksi/payroll-produksi",
  },
  {
    key: "open-sales",
    label: "Input Penjualan",
    description: "Catat transaksi penjualan yang sedang berjalan.",
    to: "/sales",
  },
];

// =========================
// SECTION: Helpers - angka & tanggal
// Fungsi:
// - menjaga parsing angka/tanggal tetap konsisten walaupun format data
//   dari firestore bisa sedikit berbeda antar collection lama dan baru
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
    record?.updatedAt,
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

// =========================
// SECTION: Helpers - sales status
// Fungsi:
// - memastikan chart dan ringkasan penjualan tidak ikut menghitung transaksi
//   yang sudah dibatalkan atau dianggap tidak valid
// =========================
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

// =========================
// SECTION: Helpers - inventory / stock
// Fungsi:
// - membaca stok aktual dan minimum stok dari field yang berbeda antar master
// - menjaga dashboard tetap akurat walaupun nama field lama dan baru bercampur
// =========================
const getItemDisplayName = (item = {}) =>
  item?.name || item?.productName || item?.materialName || "-";

const getItemStock = (item = {}) =>
  Number(item?.currentStock ?? item?.stock ?? item?.availableStock ?? 0);

const getItemMinStock = (item = {}) =>
  Number(item?.minStockAlert ?? item?.minStock ?? 0);

const isLowStockItem = (item = {}) => {
  const stock = getItemStock(item);
  const minStock = getItemMinStock(item);

  if (stock <= 0) return true;
  if (minStock > 0 && stock <= minStock) return true;

  return false;
};

const getLowStockSeverity = (item = {}) => {
  const stock = getItemStock(item);
  const minStock = getItemMinStock(item);

  if (stock <= 0) {
    return { label: "Kosong", color: "red" };
  }

  if (minStock > 0 && stock <= minStock) {
    return { label: "Menipis", color: "gold" };
  }

  return { label: "Aman", color: "green" };
};

const buildLowStockRows = (products = [], materials = []) => {
  const rows = [
    ...products.map((item) => ({
      key: `product-${item.id}`,
      name: getItemDisplayName(item),
      stock: getItemStock(item),
      minStock: getItemMinStock(item),
      unit: item?.unit || "pcs",
      type: "Produk Jadi",
      severity: getLowStockSeverity(item),
    })),
    ...materials.map((item) => ({
      key: `material-${item.id}`,
      name: getItemDisplayName(item),
      stock: getItemStock(item),
      minStock: getItemMinStock(item),
      unit: item?.unit || "pcs",
      type: "Bahan Baku",
      severity: getLowStockSeverity(item),
    })),
  ]
    .filter((item) => isLowStockItem(item))
    .sort((left, right) => {
      const leftGap = left.stock - Math.max(left.minStock, 0);
      const rightGap = right.stock - Math.max(right.minStock, 0);
      return leftGap - rightGap;
    });

  return rows;
};

// =========================
// SECTION: Helpers - activity tag
// Fungsi:
// - mengubah type dari inventory log menjadi label visual yang lebih mudah
//   dipahami user operasional di dashboard
// =========================
const formatActivityType = (type) => {
  const normalized = String(type || "").toLowerCase();

  if (normalized.includes("purchase")) {
    return { label: "Pembelian", color: "green" };
  }

  if (normalized.includes("sale")) {
    return { label: "Penjualan", color: "blue" };
  }

  if (normalized.includes("return")) {
    return { label: "Retur", color: "orange" };
  }

  if (normalized.includes("adjust")) {
    return { label: "Penyesuaian", color: "gold" };
  }

  if (normalized.includes("production")) {
    return { label: "Produksi", color: "purple" };
  }

  if (normalized.includes("in")) {
    return { label: type || "Masuk", color: "green" };
  }

  if (normalized.includes("out")) {
    return { label: type || "Keluar", color: "red" };
  }

  return { label: type || "-", color: "default" };
};

// =========================
// SECTION: Dashboard
// Fokus:
// - menampilkan prioritas kerja harian, bukan hanya angka total master
// - membantu user langsung tahu apa yang perlu dicek, dikerjakan, dan dibuka
// =========================
const Dashboard = () => {
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalMaterials, setTotalMaterials] = useState(0);
  const [lowStockRows, setLowStockRows] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [salesChartData, setSalesChartData] = useState(
    MONTH_LABELS.map((month) => ({ month, sales: 0 })),
  );
  const [salesThisMonth, setSalesThisMonth] = useState(0);
  const [readyOrdersCount, setReadyOrdersCount] = useState(0);
  const [shortageOrdersCount, setShortageOrdersCount] = useState(0);
  const [inProductionOrdersCount, setInProductionOrdersCount] = useState(0);
  const [inProgressWorkLogsCount, setInProgressWorkLogsCount] = useState(0);
  const [unpaidPayrollCount, setUnpaidPayrollCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const lowStockTotal = lowStockRows.length;

  useEffect(() => {
    const initDashboard = async () => {
      try {
        setLoading(true);

        const recentTransactionsQuery = query(
          collection(db, "inventory_logs"),
          orderBy("timestamp", "desc"),
          limit(8),
        );

        const [
          productCountSnap,
          materialCountSnap,
          productsSnap,
          materialsSnap,
          recentTransactionsSnap,
          salesSnap,
          productionOrdersSnap,
          workLogsSnap,
          payrollsSnap,
        ] = await Promise.all([
          getCountFromServer(collection(db, "products")),
          getCountFromServer(collection(db, "raw_materials")),
          getDocs(collection(db, "products")),
          getDocs(collection(db, "raw_materials")),
          getDocs(recentTransactionsQuery),
          getDocs(collection(db, "sales")),
          getDocs(collection(db, "production_orders")),
          getDocs(collection(db, "production_work_logs")),
          getDocs(collection(db, "production_payrolls")),
        ]);

        const productsList = productsSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));

        const materialsList = materialsSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));

        const salesList = salesSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));

        const ordersList = productionOrdersSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));

        const workLogsList = workLogsSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));

        const payrollsList = payrollsSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        }));

        setTotalProducts(productCountSnap.data().count || 0);
        setTotalMaterials(materialCountSnap.data().count || 0);
        setLowStockRows(buildLowStockRows(productsList, materialsList).slice(0, 8));

        setRecentTransactions(
          recentTransactionsSnap.docs.map((docItem) => ({
            id: docItem.id,
            ...docItem.data(),
          })),
        );

        setSalesChartData(buildMonthlySalesChart(salesList));
        setSalesThisMonth(getCurrentMonthSalesTotal(salesList));

        setShortageOrdersCount(
          ordersList.filter((item) => item?.status === "shortage").length,
        );
        setReadyOrdersCount(
          ordersList.filter((item) => item?.status === "ready").length,
        );
        setInProductionOrdersCount(
          ordersList.filter((item) => item?.status === "in_production").length,
        );
        setInProgressWorkLogsCount(
          workLogsList.filter((item) => item?.status === "in_progress").length,
        );
        setUnpaidPayrollCount(
          payrollsList.filter(
            (item) =>
              String(item?.paymentStatus || "").toLowerCase() === "unpaid" ||
              String(item?.status || "").toLowerCase() === "draft",
          ).length,
        );
      } catch (error) {
        console.error("Gagal memuat dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    initDashboard();
  }, []);

  // =========================
  // SECTION: KPI utama
  // Fungsi:
  // - kartu teratas diprioritaskan untuk operasional harian
  // - user bisa langsung lihat stok, produksi, payroll, dan penjualan bulan berjalan
  // =========================
  const summaryData = useMemo(
    () => [
      {
        key: "low-stock",
        title: "Stok Menipis",
        value: lowStockTotal,
        subtitle: "Perlu restock atau monitoring",
        prefix: <WarningOutlined />,
        color: "#f59e0b",
        formatter: (value) => formatNumberId(value),
      },
      {
        key: "po-shortage",
        title: "PO Shortage",
        value: shortageOrdersCount,
        subtitle: "Perlu cek bahan / BOM",
        prefix: <ToolOutlined />,
        color: "#ef4444",
        formatter: (value) => formatNumberId(value),
      },
      {
        key: "po-ready",
        title: "PO Siap Produksi",
        value: readyOrdersCount,
        subtitle: "Bisa langsung mulai produksi",
        prefix: <CheckCircleOutlined />,
        color: "#2563eb",
        formatter: (value) => formatNumberId(value),
      },
      {
        key: "worklog-running",
        title: "Work Log Berjalan",
        value: inProgressWorkLogsCount,
        subtitle: "Masih dalam proses pengerjaan",
        prefix: <ClockCircleOutlined />,
        color: "#7c3aed",
        formatter: (value) => formatNumberId(value),
      },
      {
        key: "payroll-pending",
        title: "Payroll Pending",
        value: unpaidPayrollCount,
        subtitle: "Belum dibayar / masih draft",
        prefix: <DollarCircleOutlined />,
        color: "#0f766e",
        formatter: (value) => formatNumberId(value),
      },
      {
        key: "sales-month",
        title: "Penjualan Bulan Ini",
        value: salesThisMonth,
        subtitle: "Akumulasi transaksi bulan berjalan",
        prefix: <ShoppingCartOutlined />,
        color: "#7c3aed",
        formatter: (value) => `Rp ${formatNumberId(value)}`,
      },
    ],
    [
      inProgressWorkLogsCount,
      lowStockTotal,
      readyOrdersCount,
      salesThisMonth,
      shortageOrdersCount,
      unpaidPayrollCount,
    ],
  );

  // =========================
  // SECTION: Action items
  // Fungsi:
  // - menyusun daftar hal yang perlu diperhatikan user hari ini
  // - setiap item diberi link tujuan agar dashboard tidak berhenti di informasi saja
  // =========================
  const actionItems = useMemo(() => {
    const items = [
      {
        key: "low-stock",
        label: "Stok menipis perlu dipantau",
        count: lowStockTotal,
        description: "Periksa item yang mendekati batas minimum stok.",
        color: "gold",
        to: "/stock-management",
      },
      {
        key: "po-shortage",
        label: "Production Order shortage",
        count: shortageOrdersCount,
        description: "Cek requirement bahan yang belum cukup atau perlu revisi.",
        color: "red",
        to: "/produksi/production-orders",
      },
      {
        key: "po-ready",
        label: "Production Order siap dimulai",
        count: readyOrdersCount,
        description: "Antrian ini bisa langsung diproses ke work log produksi.",
        color: "blue",
        to: "/produksi/production-orders",
      },
      {
        key: "worklog-progress",
        label: "Work log masih berjalan",
        count: inProgressWorkLogsCount,
        description: "Review pekerjaan yang belum selesai atau belum ditutup.",
        color: "purple",
        to: "/produksi/work-log-produksi",
      },
      {
        key: "payroll-pending",
        label: "Payroll menunggu proses",
        count: unpaidPayrollCount,
        description: "Periksa payroll draft atau pembayaran yang belum selesai.",
        color: "cyan",
        to: "/produksi/payroll-produksi",
      },
    ];

    return items.filter((item) => item.count > 0);
  }, [
    inProgressWorkLogsCount,
    lowStockTotal,
    readyOrdersCount,
    shortageOrdersCount,
    unpaidPayrollCount,
  ]);

  // =========================
  // SECTION: Secondary summary
  // Fungsi:
  // - memberi konteks tambahan tentang master aktif dan status produksi
  // - dibuat ringkas supaya tidak menyaingi KPI utama di atas
  // =========================
  const secondarySummary = useMemo(
    () => [
      {
        key: "products",
        title: "Produk Aktif",
        value: totalProducts,
        subtitle: "Master produk jadi",
        icon: <AppstoreOutlined />,
      },
      {
        key: "materials",
        title: "Bahan Aktif",
        value: totalMaterials,
        subtitle: "Master bahan baku",
        icon: <DatabaseOutlined />,
      },
      {
        key: "po-production",
        title: "PO In Production",
        value: inProductionOrdersCount,
        subtitle: "Order yang sudah dimulai",
        icon: <BuildOutlined />,
      },
    ],
    [inProductionOrdersCount, totalMaterials, totalProducts],
  );

  // =========================
  // SECTION: Low stock table
  // Fungsi:
  // - menampilkan item stok terendah yang paling perlu dilihat cepat
  // - kolom dibuat ringkas agar user tidak perlu scroll terlalu jauh
  // =========================
  const lowStockColumns = [
    {
      title: "Item",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{value}</Text>
          <Tag color={record.severity.color}>{record.type}</Tag>
        </Space>
      ),
    },
    {
      title: "Stok",
      dataIndex: "stock",
      key: "stock",
      width: 130,
      render: (value, record) => (
        <Text>
          {formatNumberId(value)} {record.unit}
        </Text>
      ),
    },
    {
      title: "Min",
      dataIndex: "minStock",
      key: "minStock",
      width: 120,
      render: (value, record) => (
        <Text>
          {formatNumberId(value)} {record.unit}
        </Text>
      ),
    },
  ];

  // =========================
  // SECTION: Recent activity table
  // Fungsi:
  // - menjaga user bisa audit log terakhir tanpa harus buka halaman stok dulu
  // - cocok untuk melihat apakah mutasi terbaru sesuai dengan aktivitas operasional
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

  const alertMessage =
    actionItems.length > 0
      ? "Ada prioritas operasional yang perlu diperhatikan."
      : "Semua indikator utama dalam kondisi aman.";

  const alertDescription =
    actionItems.length > 0
      ? `${formatNumberId(lowStockTotal)} stok menipis, ${formatNumberId(
          shortageOrdersCount,
        )} PO shortage, ${formatNumberId(
          readyOrdersCount,
        )} PO siap, ${formatNumberId(
          inProgressWorkLogsCount,
        )} work log berjalan, dan ${formatNumberId(
          unpaidPayrollCount,
        )} payroll pending.`
      : "Belum ada item prioritas yang memerlukan tindakan cepat saat ini.";

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="Pusat ringkasan operasional untuk membantu user melihat prioritas kerja harian, status produksi, stok, dan penjualan."
      />

      <div className="dashboard-alert-wrap">
        <Alert
          type={actionItems.length > 0 ? "warning" : "success"}
          showIcon
          message={alertMessage}
          description={alertDescription}
        />
      </div>

      {/* =========================
          SECTION: KPI Cards
          Tujuan:
          - menampilkan indikator utama yang paling sering dicek user
          - urutan kartu mengikuti prioritas operasional harian
      ========================= */}
      <Row gutter={[16, 16]} className="dashboard-summary-row">
        {summaryData.map((item) => (
          <Col xs={24} sm={12} xl={8} xxl={4} key={item.key}>
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
          SECTION: Action Center
          Tujuan:
          - blok kiri fokus ke prioritas kerja hari ini
          - blok kanan fokus ke akses cepat dan ringkasan master
      ========================= */}
      <Row gutter={[16, 16]} className="dashboard-main-grid">
        <Col xs={24} xl={10}>
          <PageSection
            title="Perlu Tindakan Hari Ini"
            subtitle="Daftar prioritas yang sebaiknya dicek lebih dulu agar operasional tetap lancar."
          >
            {actionItems.length > 0 ? (
              <div className="dashboard-action-list">
                {actionItems.map((item) => (
                  <Link key={item.key} to={item.to} className="dashboard-action-item">
                    <div className="dashboard-action-content">
                      <Space size={8} wrap>
                        <Tag color={item.color}>{formatNumberId(item.count)}</Tag>
                        <Text strong>{item.label}</Text>
                      </Space>
                      <Text className="dashboard-action-description">
                        {item.description}
                      </Text>
                    </div>

                    <ArrowRightOutlined className="dashboard-action-arrow" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty-wrap dashboard-empty-compact">
                <Empty description="Belum ada prioritas operasional yang perlu ditindak." />
              </div>
            )}
          </PageSection>
        </Col>

        <Col xs={24} xl={14}>
          <PageSection
            title="Aksi Cepat"
            subtitle="Shortcut ke halaman yang paling sering dipakai saat operasional harian."
          >
            <div className="dashboard-quick-grid">
              {QUICK_ACTIONS.map((action) => (
                <Link key={action.key} to={action.to} className="dashboard-quick-card">
                  <Text strong>{action.label}</Text>
                  <Text className="dashboard-quick-description">
                    {action.description}
                  </Text>
                </Link>
              ))}
            </div>

            <div className="dashboard-mini-summary-grid">
              {secondarySummary.map((item) => (
                <div key={item.key} className="dashboard-mini-summary-card">
                  <Space size={10} align="start">
                    <div className="dashboard-mini-summary-icon">{item.icon}</div>
                    <div className="dashboard-mini-summary-body">
                      <Text className="dashboard-mini-summary-label">{item.title}</Text>
                      <Title level={4} className="dashboard-mini-summary-value">
                        {formatNumberId(item.value)}
                      </Title>
                      <Text className="dashboard-mini-summary-subtitle">
                        {item.subtitle}
                      </Text>
                    </div>
                  </Space>
                </div>
              ))}
            </div>
          </PageSection>
        </Col>
      </Row>

      {/* =========================
          SECTION: Insight Panels
          Tujuan:
          - kiri untuk tren penjualan
          - kanan untuk daftar item stok yang paling perlu diprioritaskan
      ========================= */}
      <Row gutter={[16, 16]} className="dashboard-main-grid">
        <Col xs={24} xl={14}>
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

        <Col xs={24} xl={10}>
          <PageSection
            title="Stok Menipis"
            subtitle="Daftar item yang paling perlu diperhatikan saat ini."
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
                scroll={{ x: 420 }}
              />
            ) : (
              <div className="dashboard-empty-wrap dashboard-empty-compact">
                <Empty description="Belum ada item dengan stok menipis." />
              </div>
            )}
          </PageSection>
        </Col>
      </Row>

      {/* =========================
          SECTION: Recent Activities
          Tujuan:
          - memberi jejak audit cepat atas transaksi inventaris terbaru
          - user bisa cocokkan perubahan sistem dengan aktivitas nyata di lapangan
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
              <div className="dashboard-empty-wrap dashboard-empty-compact">
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
