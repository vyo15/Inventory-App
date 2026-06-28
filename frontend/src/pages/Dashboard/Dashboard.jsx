import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Drawer,
  Progress,
  Space,
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
  PlusCircleOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  WalletOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import EmptyStateBlock from "../../components/Layout/Feedback/EmptyStateBlock";
import PageHeader from "../../components/Layout/Page/PageHeader";
import useAuth from "../../hooks/useAuth";
import PageSection from "../../components/Layout/Page/PageSection";
import DataLoadingState from "../../components/Layout/Feedback/DataLoadingState";
import ImsNotice from "../../components/Layout/Feedback/ImsNotice";
import { formatNumberId } from "../../utils/formatters/numberId";
import { canAccessRoute, ROUTE_ACCESS_KEYS } from "../../utils/auth/roleAccess";
import { APP_ROUTES } from "../../config/appRoutes";
import {
  createEmptyDashboardData,
  normalizeDashboardData,
  readDashboardData,
} from "../../services/Dashboard/dashboardService";
import {
  DASHBOARD_PRIORITY,
  EMPTY_PLANNING_SUMMARY,
  MAX_DASHBOARD_ALERT_ITEMS,
  MAX_DASHBOARD_LIST_ITEMS,
  buildCashTrendSeries,
  buildSalesTrendSeries,
  buildTopSellingProducts,
  countDashboardAlertCategories,
  formatActivityType,
  formatCurrency,
  formatDashboardDate,
  formatDashboardLoadWarning,
  getFinancialAmount,
  getNumericValue,
  getTransactionDate,
  hasWorkLogCostIssue,
  isCancelledStatus,
  isCompletedStatus,
  isPayrollPending,
  isSameDay,
  isSameMonth,
  isSameWeek,
  normalizeStatus,
  sortDashboardAlertItems,
} from "./helpers/dashboardPageHelpers";
import "./Dashboard.css";

const { Text, Title } = Typography;

const DASHBOARD_TAG_COLORS = Object.freeze({
  danger: "red",
  warning: "gold",
  info: "blue",
  success: "green",
});

const INITIAL_SETUP_DISMISSED_STORAGE_KEY = "ims.dashboard.initialSetup.dismissed";

const INITIAL_SETUP_PHASES = Object.freeze([
  {
    key: "foundation",
    label: "Fase 1 · Fondasi",
    description: "Siapkan struktur dasar sebelum membuat master dan transaksi.",
  },
  {
    key: "operational-master",
    label: "Fase 2 · Master Operasional",
    description: "Lengkapi item, sumber restock, dan resep produksi.",
  },
  {
    key: "go-live",
    label: "Fase 3 · Go-Live",
    description: "Pastikan stok awal tercatat dan buat backup baseline.",
  },
]);

const readInitialSetupDismissed = () => {
  try {
    return window.localStorage.getItem(INITIAL_SETUP_DISMISSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

const writeInitialSetupDismissed = (dismissed) => {
  try {
    if (dismissed) {
      window.localStorage.setItem(INITIAL_SETUP_DISMISSED_STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(INITIAL_SETUP_DISMISSED_STORAGE_KEY);
    }
  } catch {
    // Preferensi UI tidak boleh mengganggu Dashboard jika storage browser tidak tersedia.
  }
};

const DASHBOARD_CHART_SIZE = Object.freeze({
  width: 760,
  height: 200,
  left: 28,
  right: 20,
  top: 24,
  bottom: 30,
});

const formatCompactCurrency = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(getNumericValue(value)));

const buildDashboardQuickActions = (role) => [
  {
    key: "sales",
    routeKey: ROUTE_ACCESS_KEYS.SALES,
    label: "Tambah Penjualan",
    description: "Catat transaksi penjualan baru.",
    to: "/sales",
    icon: <PlusCircleOutlined />,
  },
  {
    key: "purchases",
    routeKey: ROUTE_ACCESS_KEYS.PURCHASES,
    label: "Tambah Pembelian",
    description: "Catat pembelian dan penambahan stok.",
    to: "/purchases",
    icon: <ShoppingCartOutlined />,
  },
  {
    key: "stock",
    routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
    label: "Cek Stok",
    description: "Periksa stok tersedia dan stok yang telah dipesan.",
    to: APP_ROUTES.INVENTORY.STOCK_MANAGEMENT,
    icon: <AppstoreOutlined />,
  },
  {
    key: "stock-report",
    routeKey: ROUTE_ACCESS_KEYS.STOCK_REPORT,
    label: "Laporan Stok",
    description: "Lihat laporan stok untuk pemeriksaan lanjutan.",
    to: "/report-stock",
    icon: <BarChartOutlined />,
  },
  {
    key: "planning",
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING,
    label: "Perencanaan Produksi",
    description: "Pantau target mingguan dan bulanan produksi.",
    to: APP_ROUTES.PRODUCTION.PLANNING,
    icon: <ClockCircleOutlined />,
  },
  {
    key: "worklog",
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS,
    label: "Work Log Produksi",
    description: "Pantau pekerjaan produksi yang sedang berjalan.",
    to: APP_ROUTES.PRODUCTION.WORK_LOGS,
    icon: <BuildOutlined />,
  },
  {
    key: "payroll",
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS,
    label: "Payroll Produksi",
    description: "Tinjau payroll yang belum dibayar.",
    to: APP_ROUTES.PRODUCTION.PAYROLLS,
    icon: <DollarCircleOutlined />,
  },
  {
    key: "cash-in",
    routeKey: ROUTE_ACCESS_KEYS.CASH_IN,
    label: "Kas Masuk",
    description: "Catat dan tinjau pemasukan operasional.",
    to: "/cash-in",
    icon: <WalletOutlined />,
  },
  {
    key: "cash-out",
    routeKey: ROUTE_ACCESS_KEYS.CASH_OUT,
    label: "Kas Keluar",
    description: "Catat dan tinjau biaya operasional.",
    to: "/cash-out",
    icon: <WalletOutlined />,
  },
].filter(({ routeKey }) => canAccessRoute(routeKey, role));

const buildInitialSetupSteps = (readiness = {}) => {
  const flags = readiness?.flags || {};
  const counts = readiness?.counts || {};
  const diagnostics = readiness?.diagnostics || {};
  const categoryTotal = Object.values(counts.categoriesByType || {})
    .reduce((total, value) => total + getNumericValue(value), 0);

  return [
    {
      key: "categoriesReady",
      phase: "foundation",
      label: "Kategori & Kelompok",
      description: `${formatNumberId(categoryTotal)} kategori aktif untuk bentuk produk, jenis bunga, dan bahan.`,
      to: "/categories",
    },
    {
      key: "productionStepsReady",
      phase: "foundation",
      label: "Tahapan Produksi",
      description: `${formatNumberId(counts.productionSteps)} tahapan aktif untuk BOM dan Work Log.`,
      to: APP_ROUTES.PRODUCTION.STEPS,
    },
    {
      key: "productionEmployeesReady",
      phase: "foundation",
      label: "Karyawan Produksi",
      description: `${formatNumberId(counts.productionEmployees)} operator aktif untuk Work Log dan payroll.`,
      to: APP_ROUTES.PRODUCTION.EMPLOYEES,
    },
    {
      key: "masterItemsReady",
      phase: "operational-master",
      label: "Master Produk dan Bahan",
      description: `${formatNumberId(counts.products)} produk · ${formatNumberId(counts.rawMaterials)} bahan · ${formatNumberId(counts.semiFinished)} komponen.`,
      to: "/master-data",
    },
    {
      key: "supplierCatalogReady",
      phase: "operational-master",
      label: "Supplier & Katalog Restock",
      description: `${formatNumberId(counts.suppliers)} supplier · ${formatNumberId(counts.supplierOffers)} penawaran aktif.`,
      to: "/suppliers",
    },
    {
      key: "productionBomsReady",
      phase: "operational-master",
      label: "BOM / Resep Produksi",
      description: `${formatNumberId(counts.productionBoms)} BOM aktif sebagai dasar kebutuhan material.`,
      to: APP_ROUTES.PRODUCTION.BOMS,
    },
    {
      key: "openingStockReady",
      phase: "go-live",
      label: "Stok Awal Tercatat",
      description: diagnostics.positiveStockWithoutHistory
        ? `${formatNumberId(diagnostics.positiveStockWithoutHistoryItems)} item memiliki stok positif tanpa histori transaksi atau penyesuaian resmi.`
        : getNumericValue(counts.positiveStockItems) > 0
          ? `${formatNumberId(counts.positiveStockItems)} item memiliki stok dengan histori resmi.`
          : "Semua master masih dimulai dari stok 0; tidak ada opening stock yang perlu dicatat.",
      to: APP_ROUTES.INVENTORY.STOCK_MANAGEMENT,
      warning: Boolean(diagnostics.positiveStockWithoutHistory),
    },
    {
      key: "baselineBackupReady",
      phase: "go-live",
      label: "Backup Baseline Setup",
      description: diagnostics.latestVerifiedBackupAt
        ? `Backup verified terakhir: ${formatDashboardDate(diagnostics.latestVerifiedBackupAt)}.`
        : "Buat backup verified setelah seluruh master dan stok awal selesai diperiksa.",
      to: "/utilities/reset-maintenance-data",
    },
  ].map((step, index) => ({
    ...step,
    order: index + 1,
    complete: Boolean(flags[step.key]),
  }));
};

const buildInitialSetupPhaseGroups = (steps = []) => INITIAL_SETUP_PHASES.map((phase) => ({
  ...phase,
  steps: steps.filter((step) => step.phase === phase.key),
}));

const buildChartGeometry = (series = []) => {
  const {
    width,
    height,
    left,
    right,
    top,
    bottom,
  } = DASHBOARD_CHART_SIZE;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const amounts = series.map((item) => Math.max(getNumericValue(item.amount), 0));
  const maxAmount = Math.max(...amounts, 0);
  const step = series.length > 1 ? chartWidth / (series.length - 1) : chartWidth;
  const points = series.map((item, index) => {
    const x = left + (step * index);
    const ratio = maxAmount > 0 ? Math.max(getNumericValue(item.amount), 0) / maxAmount : 0;
    const y = top + chartHeight - (ratio * chartHeight);
    return {
      ...item,
      x,
      y,
    };
  });
  const pointString = points.map((item) => `${item.x},${item.y}`).join(" ");
  const areaPointString = points.length > 0
    ? `${left},${height - bottom} ${pointString} ${width - right},${height - bottom}`
    : "";
  const peak = points.reduce(
    (currentPeak, item) =>
      getNumericValue(item.amount) > getNumericValue(currentPeak?.amount) ? item : currentPeak,
    null,
  );

  return {
    areaPointString,
    maxAmount,
    peak,
    pointString,
    points,
  };
};

const DashboardMiniTrend = ({ series = [], label }) => {
  const maxAbsoluteAmount = Math.max(
    ...series.map((item) => Math.abs(getNumericValue(item.amount))),
    1,
  );

  return (
    <div className="dashboard-hero-trend" aria-label={label}>
      <div className="dashboard-hero-trend-bars" aria-hidden="true">
        {series.map((item) => {
          const amount = getNumericValue(item.amount);
          const isZero = amount === 0;
          const barHeight = isZero
            ? 8
            : Math.max(Math.round((Math.abs(amount) / maxAbsoluteAmount) * 100), 8);

          return (
            <span
              key={item.key}
              className={isZero ? "is-zero" : amount < 0 ? "is-negative" : "is-positive"}
              style={{ height: `${barHeight}%` }}
              title={`${item.label}: ${formatCurrency(amount)}`}
            />
          );
        })}
      </div>
      <Text>{label}</Text>
    </div>
  );
};

const DashboardSalesChart = ({ series = [] }) => {
  const geometry = useMemo(() => buildChartGeometry(series), [series]);
  const totalAmount = series.reduce(
    (total, item) => total + getNumericValue(item.amount),
    0,
  );
  const hasData = geometry.maxAmount > 0;

  return (
    <div className="dashboard-insight-card dashboard-sales-chart-card">
      <div className="dashboard-insight-heading">
        <div>
          <Title level={4}>Tren Penjualan 30 Hari</Title>
          <Text>Nilai penjualan harian dari transaksi yang sudah tercatat.</Text>
        </div>
        <div className="dashboard-insight-total">
          <strong>{formatCurrency(totalAmount)}</strong>
          <small>total 30 hari</small>
        </div>
      </div>

      {hasData ? (
        <>
          <div className="dashboard-sales-chart-wrap">
            <svg
              viewBox={`0 0 ${DASHBOARD_CHART_SIZE.width} ${DASHBOARD_CHART_SIZE.height}`}
              role="img"
              aria-label="Grafik nilai penjualan harian selama 30 hari terakhir"
              preserveAspectRatio="none"
            >
              <line
                className="dashboard-sales-chart-grid"
                x1={DASHBOARD_CHART_SIZE.left}
                x2={DASHBOARD_CHART_SIZE.width - DASHBOARD_CHART_SIZE.right}
                y1={DASHBOARD_CHART_SIZE.height - DASHBOARD_CHART_SIZE.bottom}
                y2={DASHBOARD_CHART_SIZE.height - DASHBOARD_CHART_SIZE.bottom}
              />
              <line
                className="dashboard-sales-chart-grid is-secondary"
                x1={DASHBOARD_CHART_SIZE.left}
                x2={DASHBOARD_CHART_SIZE.width - DASHBOARD_CHART_SIZE.right}
                y1={DASHBOARD_CHART_SIZE.top + ((DASHBOARD_CHART_SIZE.height - DASHBOARD_CHART_SIZE.top - DASHBOARD_CHART_SIZE.bottom) / 2)}
                y2={DASHBOARD_CHART_SIZE.top + ((DASHBOARD_CHART_SIZE.height - DASHBOARD_CHART_SIZE.top - DASHBOARD_CHART_SIZE.bottom) / 2)}
              />
              <polygon
                className="dashboard-sales-chart-area"
                points={geometry.areaPointString}
              />
              <polyline
                className="dashboard-sales-chart-line"
                points={geometry.pointString}
              />
              {geometry.peak ? (
                <circle
                  className="dashboard-sales-chart-peak"
                  cx={geometry.peak.x}
                  cy={geometry.peak.y}
                  r="5"
                >
                  <title>
                    Puncak {geometry.peak.label}: {formatCurrency(geometry.peak.amount)}
                  </title>
                </circle>
              ) : null}
              {geometry.points.length > 0 ? (
                <circle
                  className="dashboard-sales-chart-latest"
                  cx={geometry.points[geometry.points.length - 1].x}
                  cy={geometry.points[geometry.points.length - 1].y}
                  r="4"
                >
                  <title>
                    Hari terakhir {geometry.points[geometry.points.length - 1].label}:{" "}
                    {formatCurrency(geometry.points[geometry.points.length - 1].amount)}
                  </title>
                </circle>
              ) : null}
            </svg>
          </div>
          <div className="dashboard-chart-legend">
            <span>
              <i className="is-primary" />
              Penjualan harian
            </span>
            <span>
              <i className="is-gold" />
              Puncak {geometry.peak?.label || "-"} · {formatCompactCurrency(geometry.peak?.amount || 0)}
            </span>
          </div>
        </>
      ) : (
        <div className="dashboard-empty-wrap dashboard-empty-chart">
          <EmptyStateBlock compact description="Belum ada penjualan dalam 30 hari terakhir." />
        </div>
      )}
    </div>
  );
};

const DashboardTopProducts = ({ products = [] }) => (
  <div className="dashboard-insight-card dashboard-top-products-card">
    <div className="dashboard-insight-heading">
      <div>
        <Title level={4}>Produk Terlaris</Title>
        <Text>Bulan berjalan berdasarkan jumlah item penjualan.</Text>
      </div>
    </div>

    {products.length > 0 ? (
      <div className="dashboard-top-products-list">
        {products.map((item) => (
          <div key={item.key} className="dashboard-top-product-row">
            <span className={`dashboard-top-product-rank${item.rank === 1 ? " is-first" : ""}`}>
              {item.rank}
            </span>
            <div>
              <div className="dashboard-top-product-copy">
                <strong>{item.name}</strong>
                <span>{formatNumberId(item.quantity)} {item.unit}</span>
              </div>
              <div className="dashboard-top-product-track" aria-hidden="true">
                <span style={{ width: `${item.sharePercent}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="dashboard-empty-wrap dashboard-empty-chart">
        <EmptyStateBlock compact description="Belum ada item penjualan bulan ini." />
      </div>
    )}
  </div>
);

const Dashboard = () => {
  const { profile } = useAuth();
  const activeRole = profile?.role;
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadWarning, setLoadWarning] = useState("");
  const [isInitialSetupOpen, setIsInitialSetupOpen] = useState(false);
  const dashboardReadInFlightRef = useRef(false);
  const initialSetupAutoOpenEvaluatedRef = useRef(false);
  const [dashboardData, setDashboardData] = useState(() => createEmptyDashboardData());

  const loadDashboardData = useCallback(async () => {
    if (dashboardReadInFlightRef.current) {
      return;
    }

    dashboardReadInFlightRef.current = true;

    try {
      setLoading(true);
      setLoadWarning("");

      const {
        dashboardData: nextDashboardData,
        failedReads = [],
      } = await readDashboardData({
        maxListItems: MAX_DASHBOARD_LIST_ITEMS,
        role: activeRole,
      });
      const safeFailedReads = Array.isArray(failedReads) ? failedReads : [];

      setDashboardData(normalizeDashboardData(nextDashboardData));

      if (safeFailedReads.length > 0) {
        console.warn("Sebagian data Dashboard gagal dimuat:", safeFailedReads);
        setLoadWarning(formatDashboardLoadWarning(safeFailedReads, activeRole));
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Gagal memuat dashboard:", error);
      setDashboardData((currentDashboardData) => normalizeDashboardData(currentDashboardData));
      setLoadWarning(
        "Sebagian data Dashboard gagal dimuat. Periksa layanan lokal atau koneksi jaringan, lalu gunakan Muat Ulang.",
      );
    } finally {
      dashboardReadInFlightRef.current = false;
      setLoading(false);
    }
  }, [activeRole]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const safeDashboardData = normalizeDashboardData(dashboardData);
  const {
    lowStockRows,
    criticalStockPreview,
    recentActivities,
    productionOrders,
    workLogs,
    payrolls,
    expenses,
    incomes,
    sales,
    stockAuditRows,
    stockIssueMeta = {},
    planningSummary = EMPTY_PLANNING_SUMMARY,
    setupReadiness,
  } = safeDashboardData;

  const lowStockTotal = lowStockRows.length;
  const stockIssueHasMore = Boolean(stockIssueMeta?.hasMore || stockIssueMeta?.isLimited);
  const lowStockTotalLabel = stockIssueHasMore
    ? `${formatNumberId(lowStockTotal)}+`
    : formatNumberId(lowStockTotal);
  const quickActions = useMemo(() => buildDashboardQuickActions(activeRole), [activeRole]);
  const canViewFinance = canAccessRoute(ROUTE_ACCESS_KEYS.MONEY_MOVEMENT_LEDGER, activeRole);
  const canViewSales = canAccessRoute(ROUTE_ACCESS_KEYS.SALES, activeRole);
  const canViewStock = canAccessRoute(ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT, activeRole);
  const canViewPlanning = canAccessRoute(ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING, activeRole);
  const canViewProductionSummary = canViewPlanning
    || canAccessRoute(ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS, activeRole)
    || canAccessRoute(ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS, activeRole);
  const canViewInitialSetup = canAccessRoute(ROUTE_ACCESS_KEYS.RESET_MAINTENANCE, activeRole);
  const initialSetupSteps = useMemo(
    () => buildInitialSetupSteps(setupReadiness || {}),
    [setupReadiness],
  );
  const showInitialSetup = canViewInitialSetup
    && setupReadiness
    && setupReadiness.isComplete !== true;
  const initialSetupPhaseGroups = useMemo(
    () => buildInitialSetupPhaseGroups(initialSetupSteps),
    [initialSetupSteps],
  );
  const nextInitialSetupStep = initialSetupSteps.find((step) => !step.complete) || null;
  const completedInitialSetupSteps = getNumericValue(
    setupReadiness?.progress?.completedRequiredSteps,
  );
  const requiredInitialSetupSteps = getNumericValue(
    setupReadiness?.progress?.requiredStepCount,
  );

  useEffect(() => {
    if (!showInitialSetup) {
      setIsInitialSetupOpen(false);
      initialSetupAutoOpenEvaluatedRef.current = false;

      if (setupReadiness?.isComplete === true) {
        writeInitialSetupDismissed(false);
      }
      return;
    }

    if (initialSetupAutoOpenEvaluatedRef.current) {
      return;
    }

    initialSetupAutoOpenEvaluatedRef.current = true;
    if (!readInitialSetupDismissed()) {
      setIsInitialSetupOpen(true);
    }
  }, [showInitialSetup, setupReadiness?.isComplete]);

  const openInitialSetup = () => {
    setIsInitialSetupOpen(true);
  };

  const closeInitialSetup = () => {
    writeInitialSetupDismissed(true);
    setIsInitialSetupOpen(false);
  };

  const productionSummary = useMemo(() => {
    const shortageOrders = productionOrders.filter(
      (item) => normalizeStatus(item.status) === "shortage",
    ).length;
    const readyOrders = productionOrders.filter(
      (item) => normalizeStatus(item.status) === "ready",
    ).length;
    const runningWorkLogs = workLogs.filter(
      (item) => normalizeStatus(item.status) === "in_progress",
    ).length;
    const completedWorkLogs = workLogs.filter(
      (item) => isCompletedStatus(item.status) && isSameWeek(getTransactionDate(item)),
    ).length;
    const costIssueCount = workLogs.filter((item) => hasWorkLogCostIssue(item)).length;

    return {
      shortageOrders,
      readyOrders,
      runningWorkLogs,
      completedWorkLogs,
      costIssueCount,
    };
  }, [productionOrders, workLogs]);

  const payrollSummary = useMemo(() => {
    const pendingPayrolls = payrolls.filter((item) => isPayrollPending(item));

    return {
      pendingCount: pendingPayrolls.length,
      pendingAmount: pendingPayrolls.reduce(
        (total, item) => total + getFinancialAmount(item),
        0,
      ),
    };
  }, [payrolls]);

  const salesSummary = useMemo(() => {
    const validSales = sales.filter((item) => !isCancelledStatus(item.status));
    const salesToday = validSales.filter((item) => isSameDay(getTransactionDate(item)));
    const salesThisMonth = validSales.filter((item) => isSameMonth(getTransactionDate(item)));

    return {
      todayCount: salesToday.length,
      todayAmount: salesToday.reduce((total, item) => total + getFinancialAmount(item), 0),
      monthCount: salesThisMonth.length,
      monthAmount: salesThisMonth.reduce((total, item) => total + getFinancialAmount(item), 0),
    };
  }, [sales]);

  const financeSummary = useMemo(() => {
    const recognizedIncome = incomes
      .filter((item) => isSameMonth(getTransactionDate(item)))
      .reduce((total, item) => total + getFinancialAmount(item), 0);

    const expenseThisMonth = expenses
      .filter((item) => isSameMonth(getTransactionDate(item)))
      .reduce((total, item) => total + getFinancialAmount(item), 0);

    return {
      recognizedIncome,
      expenseThisMonth,
      netOperational: recognizedIncome - expenseThisMonth,
    };
  }, [expenses, incomes]);

  const salesTrendSeries = useMemo(
    () => buildSalesTrendSeries(sales, { days: 30 }),
    [sales],
  );
  const salesMiniTrendSeries = useMemo(
    () => buildSalesTrendSeries(sales, { days: 7 }),
    [sales],
  );
  const cashMiniTrendSeries = useMemo(
    () => buildCashTrendSeries(incomes, expenses, { days: 7 }),
    [expenses, incomes],
  );
  const topSellingProducts = useMemo(
    () => buildTopSellingProducts(sales, { limit: 5 }),
    [sales],
  );

  const productionAttentionCount =
    productionSummary.shortageOrders
    + planningSummary.overdueCount
    + planningSummary.behindTargetCount;

  const businessAlertItems = useMemo(() => {
    const negativeStockRows = stockAuditRows.filter((item) => item.isNegativeStock);
    const reservedOverrunRows = stockAuditRows.filter((item) => item.isReservedOverrun);
    const items = [];

    if (negativeStockRows.length > 0) {
      items.push({
        key: "negative-stock",
        routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
        label: "Stok minus",
        count: negativeStockRows.length,
        description: `${negativeStockRows[0].name} memiliki stok minus dan perlu diaudit.`,
        priority: DASHBOARD_PRIORITY.CRITICAL,
        icon: <WarningOutlined />,
        to: negativeStockRows[0].to,
      });
    }

    if (reservedOverrunRows.length > 0) {
      items.push({
        key: "reserved-overrun",
        routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
        label: "Stok dipesan melebihi stok",
        count: reservedOverrunRows.length,
        description: `${reservedOverrunRows[0].name}: dipesan ${formatNumberId(
          reservedOverrunRows[0].reservedStock,
        )} ${reservedOverrunRows[0].unit}.`,
        priority: DASHBOARD_PRIORITY.CRITICAL,
        icon: <AppstoreOutlined />,
        to: reservedOverrunRows[0].to,
      });
    }

    if (lowStockTotal > 0) {
      items.push({
        key: "low-stock",
        routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
        label: "Stok kosong atau menipis",
        count: lowStockTotal,
        description: "Periksa stok tersedia terhadap batas minimum setiap item.",
        priority: DASHBOARD_PRIORITY.HIGH,
        icon: <AppstoreOutlined />,
        to: APP_ROUTES.INVENTORY.STOCK_MANAGEMENT,
      });
    }

    if (productionSummary.shortageOrders > 0) {
      items.push({
        key: "po-shortage-alert",
        routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS,
        label: "Order produksi kekurangan bahan",
        count: productionSummary.shortageOrders,
        description: "Periksa kebutuhan material dan BOM sebelum produksi dimulai.",
        priority: DASHBOARD_PRIORITY.CRITICAL,
        icon: <ToolOutlined />,
        to: APP_ROUTES.PRODUCTION.ORDERS,
      });
    }

    if (planningSummary.overdueCount > 0 || planningSummary.behindTargetCount > 0) {
      const priority = planningSummary.overdueCount > 0
        ? DASHBOARD_PRIORITY.HIGH
        : DASHBOARD_PRIORITY.NORMAL;
      items.push({
        key: "planning-alert",
        routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING,
        label: planningSummary.overdueCount > 0
          ? "Perencanaan produksi terlambat"
          : "Target produksi tertinggal",
        count: planningSummary.overdueCount + planningSummary.behindTargetCount,
        description: "Tinjau target dan hasil Work Log yang sudah diselesaikan.",
        priority,
        icon: <ClockCircleOutlined />,
        to: APP_ROUTES.PRODUCTION.PLANNING,
      });
    }

    if (productionSummary.costIssueCount > 0) {
      items.push({
        key: "hpp-cost-alert",
        routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_HPP_ANALYSIS,
        label: "Biaya aktual belum lengkap",
        count: productionSummary.costIssueCount,
        description: "Work Log selesai masih memiliki biaya aktual atau HPP bernilai nol.",
        priority: DASHBOARD_PRIORITY.HIGH,
        icon: <BarChartOutlined />,
        to: APP_ROUTES.PRODUCTION.HPP_ANALYSIS,
      });
    }

    if (payrollSummary.pendingCount > 0) {
      items.push({
        key: "payroll-pending-alert",
        routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS,
        label: "Payroll belum dibayar",
        count: payrollSummary.pendingCount,
        description: `${formatCurrency(payrollSummary.pendingAmount)} masih perlu ditinjau atau dibayar.`,
        priority: DASHBOARD_PRIORITY.NORMAL,
        icon: <DollarCircleOutlined />,
        to: APP_ROUTES.PRODUCTION.PAYROLLS,
      });
    }

    return sortDashboardAlertItems(
      items.filter(({ routeKey }) => canAccessRoute(routeKey, activeRole)),
    ).slice(0, MAX_DASHBOARD_ALERT_ITEMS);
  }, [
    activeRole,
    lowStockTotal,
    payrollSummary.pendingAmount,
    payrollSummary.pendingCount,
    planningSummary.behindTargetCount,
    planningSummary.overdueCount,
    productionSummary.costIssueCount,
    productionSummary.shortageOrders,
    stockAuditRows,
  ]);

  const businessAlertCategoryCount = countDashboardAlertCategories(businessAlertItems);

  const kpiItems = useMemo(() => [
    {
      key: "sales-month",
      routeKey: ROUTE_ACCESS_KEYS.SALES,
      label: "Penjualan Bulan Ini",
      value: formatCurrency(salesSummary.monthAmount),
      detail: `${formatNumberId(salesSummary.monthCount)} transaksi · ${formatCurrency(salesSummary.todayAmount)} hari ini`,
      tone: "primary",
      icon: <ShoppingCartOutlined />,
    },
    {
      key: "stock-critical",
      routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
      label: "Stok Perlu Dicek",
      value: lowStockTotalLabel,
      detail: stockIssueHasMore
        ? "minimal item bermasalah yang berhasil dimuat"
        : "produk, bahan baku, dan produk setengah jadi",
      tone: lowStockTotal > 0 ? "warning" : "success",
      statusLabel: lowStockTotal > 0 ? "Perlu dicek" : null,
      icon: <AppstoreOutlined />,
    },
    {
      key: "production-watch",
      routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS,
      label: "Produksi Perlu Dicek",
      value: formatNumberId(productionAttentionCount),
      detail: "kekurangan bahan, terlambat, atau di bawah target",
      tone:
        productionSummary.shortageOrders + planningSummary.overdueCount > 0
          ? "danger"
          : productionAttentionCount > 0
            ? "warning"
            : "primary",
      statusLabel: productionAttentionCount > 0 ? "Perlu dicek" : null,
      icon: <ToolOutlined />,
    },
    {
      key: "payroll-pending",
      routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS,
      label: "Payroll Belum Dibayar",
      value: formatNumberId(payrollSummary.pendingCount),
      detail: formatCurrency(payrollSummary.pendingAmount),
      tone: payrollSummary.pendingCount > 0 ? "warning" : "success",
      statusLabel: payrollSummary.pendingCount > 0 ? "Belum dibayar" : null,
      icon: <WalletOutlined />,
    },
    {
      key: "data-watch",
      routeKey: ROUTE_ACCESS_KEYS.DASHBOARD,
      label: "Kategori Perlu Dicek",
      value: formatNumberId(businessAlertCategoryCount),
      detail: "kategori aktif lintas modul",
      tone: businessAlertCategoryCount > 0 ? "warning" : "success",
      statusLabel: businessAlertCategoryCount > 0 ? "Perlu dicek" : null,
      icon: <WarningOutlined />,
    },
  ].filter(({ routeKey }) => canAccessRoute(routeKey, activeRole)), [
    activeRole,
    businessAlertCategoryCount,
    lowStockTotal,
    lowStockTotalLabel,
    payrollSummary.pendingAmount,
    payrollSummary.pendingCount,
    planningSummary.overdueCount,
    productionAttentionCount,
    productionSummary.shortageOrders,
    salesSummary.monthAmount,
    salesSummary.monthCount,
    salesSummary.todayAmount,
    stockIssueHasMore,
  ]);

  const priorityItems = businessAlertItems.slice(0, MAX_DASHBOARD_LIST_ITEMS);

  const productionStatusItems = [
    {
      key: "shortage",
      routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS,
      label: "Order kekurangan bahan",
      value: productionSummary.shortageOrders,
      color: DASHBOARD_TAG_COLORS.danger,
    },
    {
      key: "ready",
      routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS,
      label: "Order siap",
      value: productionSummary.readyOrders,
      color: DASHBOARD_TAG_COLORS.info,
    },
    {
      key: "running",
      routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS,
      label: "Work Log berjalan",
      value: productionSummary.runningWorkLogs,
      color: DASHBOARD_TAG_COLORS.info,
    },
    {
      key: "completed",
      routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS,
      label: "Selesai minggu ini",
      value: productionSummary.completedWorkLogs,
      color: DASHBOARD_TAG_COLORS.success,
    },
    {
      key: "payroll",
      routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS,
      label: "Payroll belum dibayar",
      value: payrollSummary.pendingCount,
      color: DASHBOARD_TAG_COLORS.warning,
    },
  ].filter(({ routeKey }) => canAccessRoute(routeKey, activeRole));

  const heroKpiKeys = new Set(
    canViewFinance
      ? ["sales-month", "stock-critical", "production-watch", "payroll-pending"]
      : ["sales-month", "stock-critical", "production-watch", "data-watch"],
  );
  const heroKpiItems = kpiItems.filter((item) => heroKpiKeys.has(item.key));
  const denseQuickActionKeys = ["sales", "purchases", "stock", "worklog"];
  const denseQuickActions = denseQuickActionKeys
    .map((key) => quickActions.find((item) => item.key === key))
    .filter(Boolean);
  const denseActivityRows = recentActivities.slice(0, MAX_DASHBOARD_LIST_ITEMS);
  const compactExceptionItems = businessAlertItems.slice(0, 3);
  const showSecondarySummary = canViewProductionSummary || canViewStock;

  const lastUpdatedText = loading
    ? "Memuat..."
    : lastUpdated
      ? lastUpdated.toLocaleString("id-ID", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "Belum dimuat";
  const isInitialDashboardLoading = loading && !lastUpdated;

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan operasional, tren, dan prioritas hari ini."
        extra={
          <Space size={10} wrap>
            {showInitialSetup ? (
              <Button
                size="small"
                icon={<DatabaseOutlined />}
                className="dashboard-setup-trigger"
                onClick={openInitialSetup}
                aria-label={`Setup Database Awal, ${completedInitialSetupSteps} dari ${requiredInitialSetupSteps} selesai`}
              >
                <span>Setup Awal</span>
                <span className="dashboard-setup-trigger-progress">
                  {formatNumberId(completedInitialSetupSteps)}/{formatNumberId(requiredInitialSetupSteps)}
                </span>
              </Button>
            ) : null}
            <Text className="dashboard-section-extra">Terakhir diperbarui: {lastUpdatedText}</Text>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={loading}
              disabled={loading}
              onClick={loadDashboardData}
            >
              Muat Ulang
            </Button>
          </Space>
        }
      />

      {loadWarning ? <ImsNotice variant="data-quality" compact title={loadWarning} /> : null}

      <Drawer
        title={
          <div className="dashboard-setup-drawer-title">
            <span className="dashboard-setup-drawer-title-icon"><DatabaseOutlined /></span>
            <span>
              <strong>Setup Database Awal</strong>
              <small>Urutan aman sebelum transaksi harian dimulai.</small>
            </span>
          </div>
        }
        open={Boolean(showInitialSetup && isInitialSetupOpen)}
        onClose={closeInitialSetup}
        placement="right"
        width={500}
        rootClassName="dashboard-setup-drawer-root"
        className="dashboard-setup-drawer"
        destroyOnHidden
        extra={
          <Tag color="blue" className="dashboard-setup-drawer-progress-tag">
            {formatNumberId(completedInitialSetupSteps)}/{formatNumberId(requiredInitialSetupSteps)} selesai
          </Tag>
        }
        footer={
          <div className="dashboard-setup-drawer-footer">
            <Text>Checklist hanya membaca data dan tidak membuat transaksi otomatis.</Text>
            <Button onClick={closeInitialSetup}>Sembunyikan sementara</Button>
          </div>
        }
      >
        {showInitialSetup ? (
          <div className="dashboard-setup-drawer-content">
            <section className="dashboard-setup-summary">
              <div className="dashboard-setup-summary-topline">
                <span>Progress setup</span>
                <strong>{formatNumberId(completedInitialSetupSteps)} dari {formatNumberId(requiredInitialSetupSteps)} selesai</strong>
              </div>
              <Progress
                percent={getNumericValue(setupReadiness?.progress?.percent)}
                showInfo={false}
                size="small"
              />
              {nextInitialSetupStep ? (
                <div className="dashboard-setup-next-step">
                  <span>Langkah berikutnya</span>
                  <strong>{nextInitialSetupStep.order}. {nextInitialSetupStep.label}</strong>
                  <Text>{nextInitialSetupStep.description}</Text>
                  <Link
                    to={nextInitialSetupStep.to}
                    className="dashboard-setup-next-action"
                    onClick={closeInitialSetup}
                  >
                    Isi sekarang <ArrowRightOutlined />
                  </Link>
                </div>
              ) : null}
            </section>

            <div className="dashboard-setup-phase-list">
              {initialSetupPhaseGroups.map((phase) => (
                <section key={phase.key} className="dashboard-setup-phase">
                  <div className="dashboard-setup-phase-heading">
                    <strong>{phase.label}</strong>
                    <small>{phase.description}</small>
                  </div>
                  <div className="dashboard-setup-step-list">
                    {phase.steps.map((step) => (
                      <Link
                        key={step.key}
                        to={step.to}
                        onClick={closeInitialSetup}
                        className={`dashboard-setup-step ${step.complete ? "is-complete" : step.warning ? "is-warning" : "is-pending"}`}
                      >
                        <span className="dashboard-setup-step-number">{step.order}</span>
                        <span className="dashboard-setup-step-copy">
                          <strong>{step.label}</strong>
                          <small>{step.description}</small>
                        </span>
                        <span className="dashboard-setup-step-status">
                          {step.complete ? <CheckCircleOutlined /> : step.warning ? <WarningOutlined /> : <ClockCircleOutlined />}
                          <span>{step.complete ? "Siap" : step.warning ? "Perlu audit" : "Belum siap"}</span>
                        </span>
                        <ArrowRightOutlined className="dashboard-setup-step-arrow" />
                      </Link>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : null}
      </Drawer>

      {isInitialDashboardLoading ? (
        <PageSection title="Menyiapkan Dashboard" subtitle="Memuat ringkasan operasional terbaru.">
          <DataLoadingState
            variant="table"
            rows={5}
            columns={4}
            message="Menyiapkan data Dashboard..."
            minHeight={260}
          />
        </PageSection>
      ) : (
        <>
          <section className="dashboard-overview-grid" aria-label="Ringkasan utama Dashboard">
            {canViewFinance ? (
              <div className="dashboard-card dashboard-hero-card">
                <div className="dashboard-hero-topline">
                  <Text className="dashboard-hero-eyebrow">NET KAS OPERASIONAL</Text>
                  <Tag className="dashboard-hero-period">
                    {new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                  </Tag>
                </div>
                <Title level={2} className="dashboard-hero-value">
                  {formatCurrency(financeSummary.netOperational)}
                </Title>
                <Text className="dashboard-hero-note">
                  Monitoring bulan berjalan, bukan laba final.
                </Text>
                <DashboardMiniTrend
                  series={cashMiniTrendSeries}
                  label="Net kas harian · 7 hari terakhir"
                />
                <div className="dashboard-hero-mini-stats">
                  <div>
                    <Text>Kas masuk</Text>
                    <strong>{formatCurrency(financeSummary.recognizedIncome)}</strong>
                  </div>
                  <div>
                    <Text>Kas keluar</Text>
                    <strong>{formatCurrency(financeSummary.expenseThisMonth)}</strong>
                  </div>
                  <div>
                    <Text>Penjualan hari ini</Text>
                    <strong>{formatCurrency(salesSummary.todayAmount)}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="dashboard-card dashboard-hero-card dashboard-hero-operational">
                <div className="dashboard-hero-topline">
                  <Text className="dashboard-hero-eyebrow">NILAI PENJUALAN HARI INI</Text>
                  <Tag className="dashboard-hero-period">
                    {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long" })}
                  </Tag>
                </div>
                <Title level={2} className="dashboard-hero-value">
                  {formatCurrency(salesSummary.todayAmount)}
                </Title>
                <Text className="dashboard-hero-note">
                  {formatNumberId(salesSummary.todayCount)} transaksi tercatat hari ini.
                </Text>
                <DashboardMiniTrend
                  series={salesMiniTrendSeries}
                  label="Penjualan harian · 7 hari terakhir"
                />
                <div className="dashboard-hero-mini-stats">
                  <div>
                    <Text>Penjualan bulan ini</Text>
                    <strong>{formatCurrency(salesSummary.monthAmount)}</strong>
                  </div>
                  <div>
                    <Text>Stok perlu dicek</Text>
                    <strong>{lowStockTotalLabel} item</strong>
                  </div>
                  <div>
                    <Text>Temuan produksi</Text>
                    <strong>{formatNumberId(productionAttentionCount)}</strong>
                  </div>
                </div>
              </div>
            )}

            <div className="dashboard-kpi-grid">
              {heroKpiItems.map((item) => (
                <div
                  key={item.key}
                  className={`dashboard-card dashboard-kpi dashboard-kpi-${item.tone}`}
                >
                  <div className="dashboard-kpi-topline">
                    <span className="dashboard-kpi-icon">{item.icon}</span>
                    {item.statusLabel ? <Tag>{item.statusLabel}</Tag> : null}
                  </div>
                  <Text className="dashboard-kpi-label">{item.label}</Text>
                  <Title level={3}>{item.value}</Title>
                  <Text className="dashboard-kpi-detail">{item.detail}</Text>
                </div>
              ))}
            </div>

            <div className="dashboard-card dashboard-priority-card">
              <div className="dashboard-section-heading">
                <div>
                  <Title level={4}>Prioritas Hari Ini</Title>
                  <Text>Diurutkan berdasarkan tingkat dampak.</Text>
                </div>
                <Tag color={priorityItems.length > 0 ? "gold" : "green"}>
                  {formatNumberId(priorityItems.length)} kategori
                </Tag>
              </div>

              <div className="dashboard-priority-list">
                {priorityItems.slice(0, 3).map((item) => (
                  <Link key={item.key} to={item.to} className="dashboard-priority-row">
                    <span className="dashboard-priority-icon">{item.icon}</span>
                    <span className="dashboard-priority-copy">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <Tag color={item.priority.color}>{item.priority.label}</Tag>
                  </Link>
                ))}
                {priorityItems.length === 0 ? (
                  <div className="dashboard-empty-wrap dashboard-empty-compact">
                    <EmptyStateBlock compact description="Tidak ada temuan yang perlu diprioritaskan hari ini." />
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {canViewSales ? (
            <section className="dashboard-insight-grid" aria-label="Insight penjualan">
              <DashboardSalesChart series={salesTrendSeries} />
              <DashboardTopProducts products={topSellingProducts} />
            </section>
          ) : null}

          <section className="dashboard-main-grid" aria-label="Aktivitas dan aksi cepat">
            <div className="dashboard-card dashboard-activity-card">
              <div className="dashboard-section-heading">
                <div>
                  <Title level={4}>Aktivitas Stok Terbaru</Title>
                  <Text>Perubahan stok terbaru dari transaksi dan penyesuaian.</Text>
                </div>
                <Tag color="blue">{formatNumberId(denseActivityRows.length)} aktivitas</Tag>
              </div>

              {denseActivityRows.length > 0 ? (
                <div className="dashboard-dense-table-wrap">
                  <div className="dashboard-dense-table dashboard-dense-table-head" role="row">
                    <span>Aktivitas</span>
                    <span>Sumber</span>
                    <span>Perubahan</span>
                    <span>Nilai</span>
                    <span>Waktu</span>
                  </div>
                  {denseActivityRows.map((item) => {
                    const activity = formatActivityType(item.type);
                    const activityDate = getTransactionDate(item);
                    const quantityChange = getNumericValue(item.quantityChange ?? item.quantity ?? 0);
                    const absoluteQuantity = Math.abs(quantityChange);
                    const activityName =
                      item.itemName
                      || item.name
                      || item.productName
                      || item.materialName
                      || "Aktivitas stok";
                    const changePrefix = quantityChange > 0 ? "+" : quantityChange < 0 ? "-" : "";
                    const activityValue = getFinancialAmount(item);

                    return (
                      <div
                        key={item.id || `${activityName}-${activityDate || "unknown"}`}
                        className="dashboard-dense-table dashboard-dense-table-row"
                        role="row"
                      >
                        <span className="dashboard-dense-activity-name">
                          <span className="dashboard-dense-activity-icon"><HistoryOutlined /></span>
                          <strong>{activityName}</strong>
                        </span>
                        <span className="dashboard-dense-field" data-label="Sumber">
                          <Tag color={activity.color}>{activity.label}</Tag>
                        </span>
                        <span className="dashboard-dense-field" data-label="Perubahan">
                          {absoluteQuantity > 0
                            ? `${changePrefix}${formatNumberId(absoluteQuantity)} ${item.unit || "unit"}`
                            : "-"}
                        </span>
                        <span className="dashboard-dense-field" data-label="Nilai">
                          {activityValue > 0 ? formatCurrency(activityValue) : "-"}
                        </span>
                        <span className="dashboard-dense-field" data-label="Waktu">
                          {activityDate ? formatDashboardDate(activityDate) : "-"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="dashboard-empty-wrap">
                  <EmptyStateBlock compact description="Belum ada aktivitas yang bisa ditampilkan." />
                </div>
              )}
            </div>

            <aside className="dashboard-side-stack">
              <div className="dashboard-card dashboard-side-card">
                <div className="dashboard-section-heading">
                  <div>
                    <Title level={4}>Aksi Cepat</Title>
                    <Text>Tautan sesuai akses pengguna.</Text>
                  </div>
                </div>
                <div className="dashboard-action-list">
                  {denseQuickActions.map((action) => {
                    const shortDescriptions = {
                      sales: "Catat transaksi",
                      purchases: "Tambah stok",
                      stock: "Periksa stok",
                      worklog: "Pantau produksi",
                    };

                    return (
                      <Link key={action.key} to={action.to} className="dashboard-action-row">
                        <span className="dashboard-action-icon">{action.icon}</span>
                        <span>
                          <strong>{action.key === "worklog" ? "Work Log" : action.label}</strong>
                          <small>{shortDescriptions[action.key]}</small>
                        </span>
                        <ArrowRightOutlined />
                      </Link>
                    );
                  })}
                  {denseQuickActions.length === 0 ? (
                    <div className="dashboard-empty-wrap dashboard-empty-compact">
                      <EmptyStateBlock compact description="Tidak ada aksi cepat yang tersedia." />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="dashboard-card dashboard-side-card">
                <div className="dashboard-section-heading">
                  <div>
                    <Title level={4}>Temuan Aktif</Title>
                    <Text>Kategori yang perlu ditindaklanjuti.</Text>
                  </div>
                  <Tag color={businessAlertCategoryCount > 0 ? "gold" : "green"}>
                    {formatNumberId(businessAlertCategoryCount)}
                  </Tag>
                </div>
                <div className="dashboard-exception-list">
                  {compactExceptionItems.map((item) => (
                    <Link key={item.key} to={item.to}>
                      <strong>{item.label}</strong>
                      <span>{formatNumberId(item.count)} item</span>
                      <Tag color={item.priority.color}>{item.priority.label}</Tag>
                    </Link>
                  ))}
                  {compactExceptionItems.length === 0 ? (
                    <Text className="dashboard-muted-text">Tidak ada temuan aktif.</Text>
                  ) : null}
                </div>
              </div>
            </aside>
          </section>

          {showSecondarySummary ? (
            <section className="dashboard-secondary-grid" aria-label="Ringkasan lanjutan">
              {canViewProductionSummary ? (
                <div className="dashboard-card dashboard-secondary-card">
                  <div className="dashboard-section-heading">
                    <div>
                      <Title level={4}>Fokus Produksi</Title>
                      <Text>Target dan risiko produksi.</Text>
                    </div>
                    {canViewPlanning ? (
                      <Link to={APP_ROUTES.PRODUCTION.PLANNING}>
                        Buka perencanaan <ArrowRightOutlined />
                      </Link>
                    ) : null}
                  </div>
                  <div className="dashboard-production-grid">
                    {[
                      { key: "weekly", label: "Target Minggu Ini", data: planningSummary.weekly },
                      { key: "monthly", label: "Target Bulan Ini", data: planningSummary.monthly },
                    ].map((item) => (
                      <div key={item.key} className="dashboard-production-item">
                        <Text>{item.label}</Text>
                        <strong>
                          {formatNumberId(item.data.actualCompletedQty)} /{" "}
                          {formatNumberId(item.data.targetQty)} pcs
                        </strong>
                        <Progress
                          percent={Math.min(Math.round(item.data.progressPercent || 0), 100)}
                          size="small"
                        />
                      </div>
                    ))}
                    <div className="dashboard-production-item">
                      <Text>Status Produksi</Text>
                      <div className="dashboard-chip-list">
                        {productionStatusItems.slice(0, 4).map((item) => (
                          <Tag key={item.key} color={item.color}>
                            {item.label}: {formatNumberId(item.value)}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {canViewStock ? (
                <div className="dashboard-card dashboard-secondary-card">
                  <div className="dashboard-section-heading">
                    <div>
                      <Title level={4}>Stok Kritis</Title>
                      <Text>Diurutkan dari kondisi paling kritis.</Text>
                    </div>
                    <Tag color={lowStockTotal > 0 ? "red" : "green"}>
                      {lowStockTotalLabel} total
                    </Tag>
                  </div>
                  <div className="dashboard-stock-list">
                    {criticalStockPreview.slice(0, 4).map((item) => (
                      <Link
                        key={item.key}
                        to={item.to}
                        className={`dashboard-stock-row${
                          getNumericValue(item?.severity?.rank) <= 2 ? " is-critical" : ""
                        }`}
                      >
                        <span className="dashboard-action-icon"><AppstoreOutlined /></span>
                        <span>
                          <strong>{item.name}</strong>
                          <small>
                            Tersedia {formatNumberId(item.stock)} {item.unit} · batas minimum{" "}
                            {formatNumberId(item.minStock)} {item.unit}
                          </small>
                        </span>
                        <Tag color={item.severity.color}>{item.severity.label}</Tag>
                      </Link>
                    ))}
                    {criticalStockPreview.length === 0 ? (
                      <Text className="dashboard-muted-text">Belum ada stok kritis.</Text>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
};

export default Dashboard;
