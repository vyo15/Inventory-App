import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Progress,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  DollarCircleOutlined,
  HistoryOutlined,
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
import {
  buildInitialSetupPhaseGroups,
  buildInitialSetupSteps,
  readInitialSetupDismissed,
  writeInitialSetupDismissed,
} from "./helpers/dashboardInitialSetupHelpers";
import buildDashboardQuickActions from "./components/dashboardQuickActions";
import DashboardInitialSetupDrawer from "./components/DashboardInitialSetupDrawer";
import {
  DashboardMiniTrend,
  DashboardSalesChart,
  DashboardTopProducts,
} from "./components/DashboardVisuals";
import "./Dashboard.css";

const { Text, Title } = Typography;

const DASHBOARD_TAG_COLORS = Object.freeze({
  danger: "red",
  warning: "gold",
  info: "blue",
  success: "green",
});

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

      <DashboardInitialSetupDrawer
        open={Boolean(showInitialSetup && isInitialSetupOpen)}
        completedSteps={completedInitialSetupSteps}
        requiredSteps={requiredInitialSetupSteps}
        progressPercent={setupReadiness?.progress?.percent}
        nextStep={nextInitialSetupStep}
        phaseGroups={initialSetupPhaseGroups}
        onClose={closeInitialSetup}
      />

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
