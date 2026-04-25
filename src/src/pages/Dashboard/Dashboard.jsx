import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
  Card,
  Col,
  Empty,
  Progress,
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
  CalendarOutlined,
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
import {
  formatNumberId,
  formatPercentId,
  formatQuantityId,
} from "../../utils/formatters/numberId";
import { formatCurrencyId } from "../../utils/formatters/currencyId";
import { formatDateId } from "../../utils/formatters/dateId";
import SalesChart from "../../components/Dashboard/SalesChart";
import { getProductionPlanningDashboardSummary } from "../../services/Produksi/productionPlanningService";
import "./Dashboard.css";

const { Text, Title } = Typography;

// =========================
// SECTION: Default summary Production Planning
// Fungsi:
// - menjaga Dashboard tetap aman saat collection production_plans belum ada;
// - dipakai sebagai fallback sebelum service planning selesai load.
// Status:
// - aktif; read-only untuk Dashboard dan tidak mengubah stok/PO/Work Log.
// =========================
const EMPTY_PLANNING_SUMMARY = {
  weekly: {
    count: 0,
    targetQty: 0,
    actualCompletedQty: 0,
    remainingQty: 0,
    progressPercent: 0,
  },
  monthly: {
    count: 0,
    targetQty: 0,
    actualCompletedQty: 0,
    remainingQty: 0,
    progressPercent: 0,
  },
  overdueCount: 0,
  behindTargetCount: 0,
  activePlanningCount: 0,
  overduePlans: [],
  priorityPlans: [],
};

// =========================
// SECTION: Constants Dashboard
// Fungsi:
// - daftar label bulan untuk chart penjualan;
// - daftar shortcut operasional harian.
// Status:
// - aktif dipakai di Dashboard.
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
  // =========================
  // ACTIVE - shortcut Production Planning.
  // Fungsi:
  // - mengarahkan user membuat target sebelum PO;
  // - tidak menggantikan shortcut PO existing.
  // =========================
  {
    key: "open-planning",
    label: "Production Planning",
    description: "Buat target mingguan/bulanan sebelum Production Order.",
    to: "/produksi/production-planning",
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
// SECTION: Helpers angka dan tanggal
// Fungsi:
// - menjaga parsing angka/tanggal tetap toleran terhadap data lama;
// - helper ini tidak melakukan mutasi Firestore.
// Status:
// - aktif dipakai untuk Dashboard.
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
    if (typeof candidate?.toDate === "function") return candidate.toDate();
    if (candidate instanceof Date) return candidate;

    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
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

const isValidSalesStatus = (sale) => {
  const status = String(sale?.status || "").trim().toLowerCase();
  return !["cancelled", "canceled", "dibatalkan", "batal", "void"].includes(status);
};

const buildMonthlySalesChart = (salesList) => {
  const currentYear = new Date().getFullYear();
  const result = MONTH_LABELS.map((month) => ({ month, sales: 0 }));

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
// SECTION: Helper stok Dashboard
// Fungsi:
// - membaca stok dari field baru/lama;
// - hanya untuk indikator stok menipis, tidak melakukan update stok.
// Status:
// - aktif; tidak menyentuh guarded production stock flow.
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

  if (stock <= 0) return { label: "Kosong", color: "red" };
  if (minStock > 0 && stock <= minStock) return { label: "Menipis", color: "gold" };
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
  ];

  return rows
    .filter((item) => isLowStockItem(item))
    .sort((left, right) => {
      const leftGap = left.stock - Math.max(left.minStock, 0);
      const rightGap = right.stock - Math.max(right.minStock, 0);
      return leftGap - rightGap;
    });
};

// =========================
// SECTION: Helper label aktivitas
// Fungsi:
// - mengubah type inventory log menjadi label manusiawi;
// - hanya untuk tampilan aktivitas terbaru.
// Status:
// - aktif dipakai Dashboard.
// =========================
const formatActivityType = (type) => {
  const normalized = String(type || "").toLowerCase();

  if (normalized.includes("purchase")) return { label: "Pembelian", color: "green" };
  if (normalized.includes("sale")) return { label: "Penjualan", color: "blue" };
  if (normalized.includes("return")) return { label: "Retur", color: "orange" };
  if (normalized.includes("adjust")) return { label: "Penyesuaian", color: "gold" };
  if (normalized.includes("production")) return { label: "Produksi", color: "purple" };
  if (normalized.includes("in")) return { label: type || "Masuk", color: "green" };
  if (normalized.includes("out")) return { label: type || "Keluar", color: "red" };

  return { label: type || "-", color: "default" };
};

// =========================
// SECTION: Helper visual Production Planning Focus
// Fungsi:
// - menerjemahkan status planning menjadi label dashboard yang mudah dipahami;
// - menjaga Dashboard tetap read-only karena helper hanya membaca summary service.
// Hubungan Dashboard / Planning:
// - dipakai oleh list Planning Perlu Dikejar agar user tahu deadline dan sisa target.
// Status:
// - aktif; bukan logic stok, bukan logic PO, dan bukan kandidat cleanup.
// =========================
const getPlanningFocusStatusMeta = (plan = {}) => {
  const status = String(plan?.status || "").toLowerCase();
  const remainingQty = getNumericValue(plan?.remainingQty);

  if (status === "completed" || remainingQty <= 0) {
    return { label: "Selesai", color: "green" };
  }

  if (status === "overdue") {
    return { label: "Overdue", color: "red" };
  }

  if (status === "draft") {
    return { label: "On Track", color: "blue" };
  }

  return { label: "Kurang Target", color: "orange" };
};

const getPlanningTargetLabel = (plan = {}) => {
  const targetName =
    plan?.targetItemName ||
    plan?.targetName ||
    plan?.title ||
    plan?.planCode ||
    "Target produksi";
  const variantLabel = plan?.targetVariantLabel || plan?.variantLabel;

  return variantLabel ? [targetName, variantLabel].join(" · ") : targetName;
};

// =========================
// SECTION: Dashboard Page
// Fungsi:
// - pusat ringkasan stok, produksi, penjualan, payroll, dan planning;
// - Dashboard hanya membaca data, tidak mengubah transaksi.
// Status:
// - aktif.
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
  const [productionPlanningSummary, setProductionPlanningSummary] = useState(
    EMPTY_PLANNING_SUMMARY,
  );
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
          planningSummary,
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
          // ACTIVE / GUARDED - summary planning dibuat fallback lokal.
          // Fungsi:
          // - Dashboard tetap tampil walau query production_plans gagal;
          // - hanya membaca data planning, tidak mengubah Planning/PO/Work Log/stok.
          getProductionPlanningDashboardSummary().catch((error) => {
            console.error("Gagal memuat summary production planning:", error);
            return EMPTY_PLANNING_SUMMARY;
          }),
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
        setProductionPlanningSummary(planningSummary || EMPTY_PLANNING_SUMMARY);
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
  // - kartu teratas diprioritaskan untuk indikator harian;
  // - planning tetap punya widget sendiri agar tidak mencampur target dengan stok.
  // Status:
  // - aktif untuk Dashboard.
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
        formatter: (value) => formatCurrencyId(value),
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
  // - menyusun prioritas kerja yang punya count > 0;
  // - planning overdue/kurang target muncul di daftar tindakan.
  // Status:
  // - aktif; link hanya navigasi, bukan mutasi data.
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
        key: "planning-overdue",
        label: "Planning produksi overdue",
        count: productionPlanningSummary.overdueCount || 0,
        description: "Cek target produksi yang melewati deadline dan belum selesai.",
        color: "red",
        to: "/produksi/production-planning",
      },
      {
        key: "planning-behind",
        label: "Planning kurang target",
        count: productionPlanningSummary.behindTargetCount || 0,
        description: "Pantau target mingguan/bulanan yang belum tercapai.",
        color: "orange",
        to: "/produksi/production-planning",
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
    productionPlanningSummary.behindTargetCount,
    productionPlanningSummary.overdueCount,
    readyOrdersCount,
    shortageOrdersCount,
    unpaidPayrollCount,
  ]);

  // =========================
  // SECTION: Secondary summary
  // Fungsi:
  // - memberi konteks tambahan tentang master aktif dan status produksi;
  // - planning overdue ikut muncul sebagai ringkasan tambahan.
  // Status:
  // - aktif; hanya membaca data.
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
      {
        key: "planning-overdue",
        title: "Planning Overdue",
        value: productionPlanningSummary.overdueCount || 0,
        subtitle: "Target lewat deadline",
        icon: <CalendarOutlined />,
      },
    ],
    [inProductionOrdersCount, productionPlanningSummary.overdueCount, totalMaterials, totalProducts],
  );

  // =========================
  // SECTION: Production Planning Focus data
  // Fungsi:
  // - menyiapkan summary dan list urgent dari service planning;
  // - Dashboard tetap read-only, semua progress tetap dihitung oleh service existing.
  // Hubungan Dashboard / Planning:
  // - dipakai untuk section Fokus Target Produksi agar user melihat target yang perlu dikejar.
  // Status:
  // - aktif; tidak mengubah stok, PO, Work Log, payroll, HPP, atau schema Firestore.
  // =========================
  const planningPriorityItems = useMemo(
    () => (Array.isArray(productionPlanningSummary.priorityPlans)
      ? productionPlanningSummary.priorityPlans.slice(0, 3)
      : []),
    [productionPlanningSummary.priorityPlans],
  );

  const hasActiveProductionPlanning = useMemo(() => {
    const activeCount = Number(productionPlanningSummary.activePlanningCount || 0);
    const weeklyCount = Number(productionPlanningSummary.weekly?.count || 0);
    const monthlyCount = Number(productionPlanningSummary.monthly?.count || 0);

    return activeCount > 0 || weeklyCount > 0 || monthlyCount > 0 || planningPriorityItems.length > 0;
  }, [
    planningPriorityItems.length,
    productionPlanningSummary.activePlanningCount,
    productionPlanningSummary.monthly?.count,
    productionPlanningSummary.weekly?.count,
  ]);

  // =========================
  // SECTION: Kolom tabel
  // Fungsi:
  // - kolom stok dan aktivitas terbaru dibuat ringkas agar dashboard tetap ringan.
  // Status:
  // - aktif untuk tampilan dashboard.
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
        value || record?.name || record?.productName || record?.materialName || "-",
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
          productionPlanningSummary.overdueCount || 0,
        )} planning overdue, ${formatNumberId(
          inProgressWorkLogsCount,
        )} work log berjalan, dan ${formatNumberId(
          unpaidPayrollCount,
        )} payroll pending.`
      : "Belum ada item prioritas yang memerlukan tindakan cepat saat ini.";

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="Pusat ringkasan operasional untuk membantu user melihat prioritas kerja harian, status produksi, stok, target planning, dan penjualan."
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
          SECTION: Production Planning Focus
          Fungsi:
          - membuat Dashboard Planning lebih actionable, bukan hanya angka agregat;
          - menampilkan target minggu/bulan dan maksimal 3 planning paling urgent.
          Hubungan Dashboard / Planning:
          - data tetap berasal dari productionPlanningSummary service;
          - link hanya navigasi ke Production Planning / Production Orders.
          Status:
          - aktif; read-only dan tidak mengubah stok, PO, Work Log, payroll, HPP, atau laporan.
      ========================= */}
      <PageSection
        title="Fokus Target Produksi"
        subtitle="Pantau target mingguan/bulanan dan planning yang perlu dikejar."
        extra={
          <Link to="/produksi/production-planning" className="dashboard-section-link">
            Buka Production Planning <ArrowRightOutlined />
          </Link>
        }
      >
        {hasActiveProductionPlanning ? (
          <div className="dashboard-planning-focus">
            <div className="dashboard-planning-summary-stack">
              <div className="dashboard-planning-summary-grid">
                <div className="dashboard-planning-summary-card">
                  <div className="dashboard-planning-card-head">
                    <Space size={8}>
                      <CalendarOutlined />
                      <Text strong>Target Minggu Ini</Text>
                    </Space>
                    <Tag color="blue">
                      {formatNumberId(productionPlanningSummary.weekly?.count || 0)} planning
                    </Tag>
                  </div>

                  <Title level={4} className="dashboard-planning-main-value">
                    {formatQuantityId(productionPlanningSummary.weekly?.actualCompletedQty || 0)} / {formatQuantityId(productionPlanningSummary.weekly?.targetQty || 0)} pcs
                  </Title>

                  <Progress
                    percent={Math.min(Number(productionPlanningSummary.weekly?.progressPercent || 0), 100)}
                    size="small"
                    format={(percent) => formatPercentId(percent)}
                  />

                  <Text className="dashboard-planning-card-note">
                    Sisa {formatQuantityId(productionPlanningSummary.weekly?.remainingQty || 0)} pcs untuk periode minggu berjalan.
                  </Text>
                </div>

                <div className="dashboard-planning-summary-card">
                  <div className="dashboard-planning-card-head">
                    <Space size={8}>
                      <CalendarOutlined />
                      <Text strong>Target Bulan Ini</Text>
                    </Space>
                    <Tag color="purple">
                      {formatNumberId(productionPlanningSummary.monthly?.count || 0)} planning
                    </Tag>
                  </div>

                  <Title level={4} className="dashboard-planning-main-value">
                    {formatQuantityId(productionPlanningSummary.monthly?.actualCompletedQty || 0)} / {formatQuantityId(productionPlanningSummary.monthly?.targetQty || 0)} pcs
                  </Title>

                  <Progress
                    percent={Math.min(Number(productionPlanningSummary.monthly?.progressPercent || 0), 100)}
                    size="small"
                    format={(percent) => formatPercentId(percent)}
                  />

                  <Text className="dashboard-planning-card-note">
                    Sisa {formatQuantityId(productionPlanningSummary.monthly?.remainingQty || 0)} pcs untuk periode bulan berjalan.
                  </Text>
                </div>
              </div>

              <div className="dashboard-planning-alert-grid">
                <div className="dashboard-planning-alert-card dashboard-planning-alert-card--danger">
                  <Text className="dashboard-planning-alert-label">Overdue Planning</Text>
                  <Title level={4} className="dashboard-planning-alert-value">
                    {formatNumberId(productionPlanningSummary.overdueCount || 0)}
                  </Title>
                </div>

                <div className="dashboard-planning-alert-card dashboard-planning-alert-card--warning">
                  <Text className="dashboard-planning-alert-label">Kurang Target</Text>
                  <Title level={4} className="dashboard-planning-alert-value">
                    {formatNumberId(productionPlanningSummary.behindTargetCount || 0)}
                  </Title>
                </div>
              </div>
            </div>

            <div className="dashboard-planning-priority-panel">
              <div className="dashboard-planning-priority-head">
                <Space direction="vertical" size={2}>
                  <Text strong>Planning Perlu Dikejar</Text>
                  <Text className="dashboard-planning-card-note">
                    Diurutkan dari overdue, deadline terdekat, progress terkecil.
                  </Text>
                </Space>
                <Tag color={planningPriorityItems.length > 0 ? "orange" : "green"}>
                  {formatNumberId(planningPriorityItems.length)} prioritas
                </Tag>
              </div>

              {planningPriorityItems.length > 0 ? (
                <div className="dashboard-planning-priority-list">
                  {planningPriorityItems.map((plan) => {
                    const statusMeta = getPlanningFocusStatusMeta(plan);

                    return (
                      <div key={plan.id || plan.planCode} className="dashboard-planning-priority-item">
                        <div className="dashboard-planning-priority-main">
                          <Text strong ellipsis className="dashboard-planning-priority-title">
                            {getPlanningTargetLabel(plan)}
                          </Text>
                          <Text className="dashboard-planning-card-note">
                            Sisa {formatQuantityId(plan.remainingQty || 0)} {plan.targetUnit || "pcs"} · Progress {formatPercentId(plan.progressPercent || 0)}
                          </Text>
                        </div>

                        <div className="dashboard-planning-priority-meta">
                          <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                          <Text className="dashboard-planning-card-note">
                            Deadline {formatDateId(plan.dueDate)}
                          </Text>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="dashboard-planning-priority-empty">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Tidak ada planning urgent. Target aktif masih aman atau sudah selesai."
                  />
                </div>
              )}

              <div className="dashboard-planning-action-row">
                <Link to="/produksi/production-planning" className="dashboard-planning-action-link">
                  Buka Production Planning <ArrowRightOutlined />
                </Link>
                <Link to="/produksi/production-orders" className="dashboard-planning-action-link dashboard-planning-action-link--muted">
                  Buat / cek PO <ArrowRightOutlined />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="dashboard-planning-empty-state">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Belum ada target produksi aktif. Buat planning mingguan/bulanan untuk memantau progress produksi."
            />
            <Link to="/produksi/production-planning" className="dashboard-planning-action-link">
              Buka Production Planning <ArrowRightOutlined />
            </Link>
          </div>
        )}
      </PageSection>

      {/* =========================
          SECTION: KPI Cards
          Tujuan:
          - menampilkan indikator utama yang paling sering dicek user;
          - urutan kartu mengikuti prioritas operasional harian.
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
          - blok kiri fokus prioritas tindakan;
          - blok kanan shortcut operasional dan summary master.
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
          - kiri untuk tren penjualan;
          - kanan untuk daftar item stok yang paling perlu diprioritaskan.
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
          - memberi jejak audit cepat atas transaksi inventaris terbaru;
          - user bisa cocokkan perubahan sistem dengan aktivitas nyata di lapangan.
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
