import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Empty,
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
  DollarCircleOutlined,
  HistoryOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  ToolOutlined,
  WalletOutlined,
  WarningOutlined,
} from "@ant-design/icons";
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
  EMPTY_PLANNING_SUMMARY,
  MAX_DASHBOARD_ALERT_ITEMS,
  MAX_DASHBOARD_LIST_ITEMS,
  formatActivityType,
  formatCurrency,
  formatDashboardDate,
  getFinancialAmount,
  getNumericValue,
  getTransactionDate,
  hasWorkLogCostIssue,
  isCancelledStatus,
  isCompletedStatus,
  isPayrollPaid,
  isPayrollPending,
  isSameDay,
  isSameMonth,
  isSameWeek,
  normalizeStatus,
} from "./helpers/dashboardPageHelpers";
import "./Dashboard.css";

const { Text, Title } = Typography;

const DASHBOARD_TAG_COLORS = Object.freeze({
  danger: "red",
  warning: "gold",
  attention: "orange",
  info: "blue",
  production: "purple",
  payroll: "cyan",
  success: "green",
});

const buildDashboardQuickActions = (role) => [
  {
    key: "sales",
    routeKey: ROUTE_ACCESS_KEYS.SALES,
    label: "Tambah Penjualan",
    description: "Buka halaman Sales untuk input transaksi manual.",
    to: "/sales",
    icon: <PlusCircleOutlined />,
  },
  {
    key: "purchases",
    routeKey: ROUTE_ACCESS_KEYS.PURCHASES,
    label: "Pembelian",
    description: "Buka Purchases untuk restock bahan/barang.",
    to: "/purchases",
    icon: <ShoppingCartOutlined />,
  },
  {
    key: "stock",
    routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
    label: "Cek Stok",
    description: "Buka Stock Management dan audit stok.",
    to: APP_ROUTES.INVENTORY.STOCK_MANAGEMENT,
    icon: <AppstoreOutlined />,
  },
  {
    key: "stock-report",
    routeKey: ROUTE_ACCESS_KEYS.STOCK_REPORT,
    label: "Laporan Stok",
    description: "Buka laporan stok final.",
    to: "/report-stock",
    icon: <BarChartOutlined />,
  },
  {
    key: "planning",
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING,
    label: "Production Planning",
    description: "Pantau target mingguan/bulanan produksi.",
    to: APP_ROUTES.PRODUCTION.PLANNING,
    icon: <ClockCircleOutlined />,
  },
  {
    key: "worklog",
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS,
    label: "Work Log Produksi",
    description: "Cek pekerjaan produksi berjalan.",
    to: APP_ROUTES.PRODUCTION.WORK_LOGS,
    icon: <BuildOutlined />,
  },
  {
    key: "payroll",
    routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS,
    label: "Payroll Produksi",
    description: "Review payroll draft/unpaid.",
    to: APP_ROUTES.PRODUCTION.PAYROLLS,
    icon: <DollarCircleOutlined />,
  },
  {
    key: "cash-in",
    routeKey: ROUTE_ACCESS_KEYS.CASH_IN,
    label: "Kas Masuk",
    description: "Buka pencatatan kas masuk operasional.",
    to: "/cash-in",
    icon: <WalletOutlined />,
  },
  {
    key: "cash-out",
    routeKey: ROUTE_ACCESS_KEYS.CASH_OUT,
    label: "Kas Keluar",
    description: "Buka pencatatan kas keluar/biaya.",
    to: "/cash-out",
    icon: <WalletOutlined />,
  },
].filter(({ routeKey }) => canAccessRoute(routeKey, role));

// IMS NOTE [AKTIF] - Helper Dashboard activity/planning/cost sudah dipusatkan di helpers/dashboardPageHelpers.js
// agar label/status tidak dobel antara page dan helper.
const STOCK_READ_MODEL_WARNING_KEYS = new Set([
  "stock_item_read_models_empty_fallback",
  "stock_item_read_models_issue_query_fallback",
  "stock_item_read_models_fallback",
  "stock_issues",
  "stock_read_models",
]);

const formatDashboardLoadWarning = (failedReads = []) => {
  if (!Array.isArray(failedReads) || failedReads.length === 0) return "";

  const uniqueFailedReads = [...new Set(failedReads.filter(Boolean))];
  const hasStockReadModelFallback = uniqueFailedReads.some((key) =>
    STOCK_READ_MODEL_WARNING_KEYS.has(key),
  );

  if (hasStockReadModelFallback) {
    return [
      "Data stok lokal belum siap atau layanan lokal belum mengembalikan data stok lengkap.",
      "Dashboard tetap memakai data aman agar monitoring tidak kosong.",
      "Jika warning berulang, buka Database Center lalu jalankan audit/perbaikan stok.",
    ].join(" ");
  }

  return [
    "Sebagian data Dashboard belum siap.",
    "Data lain tetap ditampilkan untuk monitoring; cek layanan lokal, koneksi jaringan,",
    "atau status modul aplikasi bila warning berulang.",
  ].join(" ");
};

const Dashboard = () => {
  const { profile } = useAuth();
  const activeRole = profile?.role;
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadWarning, setLoadWarning] = useState("");
  const dashboardReadInFlightRef = useRef(false);
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
        setLoadWarning(formatDashboardLoadWarning(safeFailedReads));
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Gagal memuat dashboard:", error);
      setDashboardData((currentDashboardData) => normalizeDashboardData(currentDashboardData));
      setLoadWarning("Sebagian data Dashboard gagal dimuat. Cek layanan lokal atau koneksi jaringan, lalu refresh.");
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
    revenues,
    sales,
    stockAuditRows,
    stockIssueMeta = {},
    planningSummary = EMPTY_PLANNING_SUMMARY,
  } = safeDashboardData;

  const lowStockTotal = lowStockRows.length;
  const stockIssueHasMore = Boolean(stockIssueMeta?.hasMore || stockIssueMeta?.isLimited);
  const lowStockTotalLabel = stockIssueHasMore ? `${formatNumberId(lowStockTotal)}+` : formatNumberId(lowStockTotal);
  const quickActions = useMemo(() => buildDashboardQuickActions(activeRole), [activeRole]);


  const productionSummary = useMemo(() => {
    const shortageOrders = productionOrders.filter((item) => normalizeStatus(item.status) === "shortage").length;
    const readyOrders = productionOrders.filter((item) => normalizeStatus(item.status) === "ready").length;
    const runningWorkLogs = workLogs.filter((item) => normalizeStatus(item.status) === "in_progress").length;
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
    const paidPayrolls = payrolls.filter((item) => isPayrollPaid(item));
    const payrollExpenses = expenses.filter(
      (item) => normalizeStatus(item.sourceModule) === "production_payroll",
    );

    return {
      pendingCount: pendingPayrolls.length,
      pendingAmount: pendingPayrolls.reduce((total, item) => total + getFinancialAmount(item), 0),
      paidCount: paidPayrolls.length,
      payrollExpenseCount: payrollExpenses.length,
      payrollExpenseThisMonth: payrollExpenses
        .filter((item) => isSameMonth(getTransactionDate(item)))
        .reduce((total, item) => total + getFinancialAmount(item), 0),
    };
  }, [expenses, payrolls]);

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
    const recognizedIncome = [...incomes, ...revenues]
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
  }, [expenses, incomes, revenues]);

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
        description: `${negativeStockRows[0].name} perlu dicek di Stock Management.`,
        color: DASHBOARD_TAG_COLORS.danger,
        type: "Stock",
        to: negativeStockRows[0].to,
      });
    }

    if (reservedOverrunRows.length > 0) {
      items.push({
        key: "reserved-overrun",
        routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
        label: "Reserved tidak wajar",
        count: reservedOverrunRows.length,
        description: `${reservedOverrunRows[0].name}: reserved ${formatNumberId(
          reservedOverrunRows[0].reservedStock,
        )} ${reservedOverrunRows[0].unit}.`,
        color: DASHBOARD_TAG_COLORS.attention,
        type: "Stock",
        to: reservedOverrunRows[0].to,
      });
    }

    if (lowStockTotal > 0) {
      items.push({
        key: "low-stock",
        routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
        label: "Stok kritis",
        count: lowStockTotal,
        description: "Ada item kosong/menipis berdasarkan threshold master.",
        color: DASHBOARD_TAG_COLORS.warning,
        type: "Stock",
        to: APP_ROUTES.INVENTORY.STOCK_MANAGEMENT,
      });
    }

    if (productionSummary.shortageOrders > 0) {
      items.push({
        key: "po-shortage-alert",
        routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS,
        label: "PO shortage",
        count: productionSummary.shortageOrders,
        description: "Material/BOM perlu dicek sebelum produksi berjalan.",
        color: DASHBOARD_TAG_COLORS.danger,
        type: "Production",
        to: APP_ROUTES.PRODUCTION.ORDERS,
      });
    }

    if (planningSummary.overdueCount > 0 || planningSummary.behindTargetCount > 0) {
      items.push({
        key: "planning-alert",
        routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING,
        label: "Planning perlu dicek",
        count: planningSummary.overdueCount + planningSummary.behindTargetCount,
        description: "Ada planning overdue atau tertinggal target.",
        color: planningSummary.overdueCount > 0 ? DASHBOARD_TAG_COLORS.danger : DASHBOARD_TAG_COLORS.warning,
        type: "Production",
        to: APP_ROUTES.PRODUCTION.PLANNING,
      });
    }

    if (productionSummary.costIssueCount > 0) {
      items.push({
        key: "hpp-cost-alert",
        routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_HPP_ANALYSIS,
        label: "Cost/HPP kosong",
        count: productionSummary.costIssueCount,
        description: "Work Log completed punya cost actual 0.",
        color: DASHBOARD_TAG_COLORS.production,
        type: "HPP",
        to: APP_ROUTES.PRODUCTION.HPP_ANALYSIS,
      });
    }

    if (payrollSummary.pendingCount > 0) {
      items.push({
        key: "payroll-pending-alert",
        routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS,
        label: "Payroll pending",
        count: payrollSummary.pendingCount,
        description: `${formatCurrency(payrollSummary.pendingAmount)} masih perlu review/pembayaran.`,
        color: DASHBOARD_TAG_COLORS.payroll,
        type: "Payroll",
        to: APP_ROUTES.PRODUCTION.PAYROLLS,
      });
    }

    return items
      .filter(({ routeKey }) => canAccessRoute(routeKey, activeRole))
      .slice(0, MAX_DASHBOARD_ALERT_ITEMS);
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

  const businessAlertTotal = businessAlertItems.reduce((total, item) => total + getNumericValue(item.count), 0);

  const kpiItems = useMemo(() => [
    {
      key: "sales-month",
      routeKey: ROUTE_ACCESS_KEYS.SALES,
      label: "Sales Bulan Ini",
      value: formatCurrency(salesSummary.monthAmount),
      detail: `${formatNumberId(salesSummary.monthCount)} bulan ini · ${formatCurrency(salesSummary.todayAmount)} hari ini`,
      tone: "primary",
    },
    {
      key: "cash-in",
      routeKey: ROUTE_ACCESS_KEYS.CASH_IN,
      label: "Kas Masuk",
      value: formatCurrency(financeSummary.recognizedIncome),
      detail: "revenues + incomes bulan ini",
      tone: "success",
    },
    {
      key: "cash-out",
      routeKey: ROUTE_ACCESS_KEYS.CASH_OUT,
      label: "Kas Keluar",
      value: formatCurrency(financeSummary.expenseThisMonth),
      detail: "expenses bulan ini",
      tone: "danger",
    },
    {
      key: "net-cash",
      routeKey: ROUTE_ACCESS_KEYS.MONEY_MOVEMENT_LEDGER,
      label: "Net Kas Operasional",
      value: formatCurrency(financeSummary.netOperational),
      detail: "monitoring, bukan laba final",
      tone: financeSummary.netOperational < 0 ? "danger" : "success",
      statusLabel: financeSummary.netOperational < 0 ? "Perlu Dicek" : null,
      statusTone: "warning",
    },
    {
      key: "stock-critical",
      routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
      label: "Stok Kritis",
      value: lowStockTotalLabel,
      detail: stockIssueHasMore ? "minimal item issue termuat" : "produk, bahan, semi finished",
      tone: lowStockTotal > 0 ? "warning" : "success",
      statusLabel: lowStockTotal > 0 ? "Kritis" : null,
      statusTone: "warning",
    },
    {
      key: "production-watch",
      routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS,
      label: "Produksi Dicek",
      value: formatNumberId(productionSummary.shortageOrders + planningSummary.overdueCount + planningSummary.behindTargetCount),
      detail: "shortage/overdue/behind target",
      tone: productionSummary.shortageOrders + planningSummary.overdueCount > 0 ? "danger" : "primary",
      statusLabel: productionSummary.shortageOrders + planningSummary.overdueCount > 0 ? "Perlu Dicek" : null,
      statusTone: "warning",
    },
    {
      key: "payroll-pending",
      routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS,
      label: "Payroll Pending",
      value: formatNumberId(payrollSummary.pendingCount),
      detail: formatCurrency(payrollSummary.pendingAmount),
      tone: payrollSummary.pendingCount > 0 ? "warning" : "success",
      statusLabel: payrollSummary.pendingCount > 0 ? "Pending" : null,
      statusTone: "warning",
    },
    {
      key: "data-watch",
      routeKey: ROUTE_ACCESS_KEYS.DASHBOARD,
      label: "Data Perlu Dicek",
      value: formatNumberId(businessAlertTotal),
      detail: "exception lintas modul",
      tone: businessAlertTotal > 0 ? "warning" : "success",
      statusLabel: businessAlertTotal > 0 ? "Perlu Dicek" : null,
      statusTone: "warning",
    },
  ].filter(({ routeKey }) => canAccessRoute(routeKey, activeRole)), [
    activeRole,
    businessAlertTotal,
    financeSummary.expenseThisMonth,
    financeSummary.netOperational,
    financeSummary.recognizedIncome,
    lowStockTotal,
    lowStockTotalLabel,
    payrollSummary.pendingAmount,
    payrollSummary.pendingCount,
    planningSummary.behindTargetCount,
    planningSummary.overdueCount,
    productionSummary.shortageOrders,
    salesSummary.monthAmount,
    stockIssueHasMore,
    salesSummary.monthCount,
    salesSummary.todayAmount,
  ]);
  const priorityItems = useMemo(() => {
    const items = [
      {
        key: "stock-critical",
        routeKey: ROUTE_ACCESS_KEYS.STOCK_MANAGEMENT,
        label: "Stok kritis perlu dicek",
        count: lowStockTotal,
        description: "Gunakan available stock agar stok reserved tidak terlihat aman palsu.",
        color: DASHBOARD_TAG_COLORS.warning,
        icon: <WarningOutlined />,
        to: APP_ROUTES.INVENTORY.STOCK_MANAGEMENT,
      },
      {
        key: "po-shortage",
        routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS,
        label: "PO shortage",
        count: productionSummary.shortageOrders,
        description: "Cek kebutuhan material/BOM sebelum produksi dimulai.",
        color: DASHBOARD_TAG_COLORS.danger,
        icon: <ToolOutlined />,
        to: APP_ROUTES.PRODUCTION.ORDERS,
      },
      {
        key: "planning-risk",
        routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PLANNING,
        label: "Planning perlu dikejar",
        count: planningSummary.overdueCount || planningSummary.behindTargetCount,
        description: "Overdue atau target belum tercapai berdasarkan Work Log completed.",
        color: planningSummary.overdueCount > 0 ? DASHBOARD_TAG_COLORS.danger : DASHBOARD_TAG_COLORS.warning,
        icon: <ClockCircleOutlined />,
        to: APP_ROUTES.PRODUCTION.PLANNING,
      },
      {
        key: "po-ready",
        routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS,
        label: "PO siap produksi",
        count: productionSummary.readyOrders,
        description: "Antrian ini sudah siap diproses ke Work Log.",
        color: DASHBOARD_TAG_COLORS.info,
        icon: <CheckCircleOutlined />,
        to: APP_ROUTES.PRODUCTION.ORDERS,
      },
      {
        key: "worklog-running",
        routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS,
        label: "Work Log berjalan",
        count: productionSummary.runningWorkLogs,
        description: "Review pekerjaan yang belum ditutup agar biaya dan output final jelas.",
        color: DASHBOARD_TAG_COLORS.production,
        icon: <BuildOutlined />,
        to: APP_ROUTES.PRODUCTION.WORK_LOGS,
      },
      {
        key: "payroll-pending",
        routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS,
        label: "Payroll pending",
        count: payrollSummary.pendingCount,
        description: "Cek payroll draft/confirmed/unpaid sebelum pembayaran final.",
        color: DASHBOARD_TAG_COLORS.payroll,
        icon: <DollarCircleOutlined />,
        to: APP_ROUTES.PRODUCTION.PAYROLLS,
      },
    ];

    return items
      .filter((item) => item.count > 0 && canAccessRoute(item.routeKey, activeRole))
      .slice(0, MAX_DASHBOARD_LIST_ITEMS);
  }, [
    activeRole,
    lowStockTotal,
    payrollSummary.pendingCount,
    planningSummary.behindTargetCount,
    planningSummary.overdueCount,
    productionSummary.readyOrders,
    productionSummary.runningWorkLogs,
    productionSummary.shortageOrders,
  ]);

  const productionStatusItems = [
    { key: "shortage", routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS, label: "PO Shortage", value: productionSummary.shortageOrders, color: DASHBOARD_TAG_COLORS.danger },
    { key: "ready", routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_ORDERS, label: "PO Siap", value: productionSummary.readyOrders, color: DASHBOARD_TAG_COLORS.info },
    { key: "running", routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS, label: "Work Log Jalan", value: productionSummary.runningWorkLogs, color: DASHBOARD_TAG_COLORS.production },
    { key: "completed", routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_WORK_LOGS, label: "Completed Minggu Ini", value: productionSummary.completedWorkLogs, color: DASHBOARD_TAG_COLORS.success },
    { key: "payroll", routeKey: ROUTE_ACCESS_KEYS.PRODUCTION_PAYROLLS, label: "Payroll Pending", value: payrollSummary.pendingCount, color: DASHBOARD_TAG_COLORS.payroll },
  ].filter(({ routeKey }) => canAccessRoute(routeKey, activeRole));

  const heroKpiKeys = new Set(["sales-month", "stock-critical", "production-watch", "payroll-pending"]);
  const heroKpiItems = kpiItems.filter((item) => heroKpiKeys.has(item.key));
  const denseQuickActionKeys = ["sales", "purchases", "stock", "worklog"];
  const denseQuickActions = denseQuickActionKeys
    .map((key) => quickActions.find((item) => item.key === key))
    .filter(Boolean);
  const denseActivityRows = recentActivities.slice(0, MAX_DASHBOARD_LIST_ITEMS);
  const compactExceptionItems = businessAlertItems.slice(0, 3);

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
    <div className="dashboard-page dashboard-bento-page">
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan operasional harian."
        extra={
          <Space size={10} wrap>
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
          <section className="dashboard-bento-overview" aria-label="Ringkasan utama dashboard">
            <div className="dashboard-bento-cash-card">
              <div className="dashboard-bento-card-topline">
                <Text className="dashboard-bento-eyebrow">NET KAS OPERASIONAL</Text>
                <Tag className="dashboard-bento-period-tag">
                  {new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                </Tag>
              </div>
              <Title level={2} className="dashboard-bento-cash-value">
                {formatCurrency(financeSummary.netOperational)}
              </Title>
              <Text className="dashboard-bento-cash-note">Monitoring bulan berjalan, bukan laba final.</Text>
              <div className="dashboard-bento-mini-stats">
                <div>
                  <Text>Kas masuk</Text>
                  <strong>{formatCurrency(financeSummary.recognizedIncome)}</strong>
                </div>
                <div>
                  <Text>Kas keluar</Text>
                  <strong>{formatCurrency(financeSummary.expenseThisMonth)}</strong>
                </div>
                <div>
                  <Text>Sales hari ini</Text>
                  <strong>{formatCurrency(salesSummary.todayAmount)}</strong>
                </div>
              </div>
            </div>

            <div className="dashboard-bento-kpi-grid">
              {heroKpiItems.map((item) => (
                <div key={item.key} className={`dashboard-bento-kpi dashboard-bento-kpi-${item.tone}`}>
                  <div className="dashboard-bento-kpi-heading">
                    <Text>{item.label}</Text>
                    {item.statusLabel ? <Tag>{item.statusLabel}</Tag> : null}
                  </div>
                  <Title level={3}>{item.value}</Title>
                  <Text>{item.detail}</Text>
                </div>
              ))}
            </div>

            <div className="dashboard-bento-priority-card">
              <div className="dashboard-bento-section-heading">
                <div>
                  <Title level={4}>Prioritas Hari Ini</Title>
                  <Text>Exception paling penting.</Text>
                </div>
                <Tag color={businessAlertTotal > 0 ? "orange" : "green"}>
                  {formatNumberId(priorityItems.length)} aktif
                </Tag>
              </div>

              <div className="dashboard-bento-priority-list">
                {priorityItems.slice(0, 3).map((item, index) => (
                  <Link key={item.key} to={item.to} className="dashboard-bento-priority-row">
                    <span className="dashboard-bento-priority-icon">{item.icon}</span>
                    <span className="dashboard-bento-priority-copy">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <Tag color={item.color}>{index === 0 ? "P0" : "P1"}</Tag>
                  </Link>
                ))}
                {priorityItems.length === 0 ? (
                  <div className="dashboard-empty-wrap dashboard-empty-compact">
                    <Empty description="Tidak ada prioritas kritis hari ini." />
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section className="dashboard-bento-main-grid" aria-label="Aktivitas dan aksi cepat">
            <div className="dashboard-bento-activity-card">
              <div className="dashboard-bento-section-heading">
                <div>
                  <Title level={4}>Transaksi dan Aktivitas Terbaru</Title>
                  <Text>Informasi utama dibuat lebih dominan untuk scanning cepat.</Text>
                </div>
                <Tag color="blue">{formatNumberId(denseActivityRows.length)} aktivitas</Tag>
              </div>

              {denseActivityRows.length > 0 ? (
                <div className="dashboard-dense-table-wrap">
                  <div className="dashboard-dense-table dashboard-dense-table-head" role="row">
                    <span>Aktivitas</span>
                    <span>Modul</span>
                    <span>Perubahan</span>
                    <span>Nilai</span>
                    <span>Status</span>
                    <span>Waktu</span>
                  </div>
                  {denseActivityRows.map((item) => {
                    const activity = formatActivityType(item.type);
                    const activityDate = getTransactionDate(item);
                    const quantityChange = getNumericValue(item.quantityChange ?? item.quantity ?? 0);
                    const absoluteQuantity = Math.abs(quantityChange);
                    const activityName = item.itemName || item.name || item.productName || item.materialName || "Aktivitas stok";
                    const activityModule = activity.label || "Stok";
                    const changePrefix = quantityChange > 0 ? "+" : quantityChange < 0 ? "-" : "";
                    const activityValue = getFinancialAmount(item);
                    return (
                      <div key={item.id || `${activityName}-${activityDate || "unknown"}`} className="dashboard-dense-table" role="row">
                        <span className="dashboard-dense-activity-name">
                          <span className="dashboard-dense-activity-icon"><HistoryOutlined /></span>
                          <strong>{activityName}</strong>
                        </span>
                        <span>{activityModule}</span>
                        <span>{absoluteQuantity > 0 ? `${changePrefix}${formatNumberId(absoluteQuantity)} ${item.unit || "unit"}` : "-"}</span>
                        <span>{activityValue > 0 ? formatCurrency(activityValue) : "-"}</span>
                        <span><Tag color={activity.color}>{activity.label}</Tag></span>
                        <span>{activityDate ? formatDashboardDate(activityDate) : "-"}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="dashboard-empty-wrap">
                  <Empty description="Belum ada aktivitas yang bisa ditampilkan." />
                </div>
              )}
            </div>

            <aside className="dashboard-bento-side-stack">
              <div className="dashboard-bento-side-card">
                <div className="dashboard-bento-section-heading">
                  <div>
                    <Title level={4}>Aksi Cepat</Title>
                    <Text>Shortcut sesuai role.</Text>
                  </div>
                </div>
                <div className="dashboard-bento-action-list">
                  {denseQuickActions.map((action) => {
                    const shortDescriptions = {
                      sales: "Input transaksi",
                      purchases: "Restock barang",
                      stock: "Audit stok",
                      worklog: "Produksi berjalan",
                    };
                    return (
                      <Link key={action.key} to={action.to} className="dashboard-bento-action-row">
                        <span className="dashboard-bento-action-icon">{action.icon}</span>
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
                      <Empty description="Tidak ada shortcut untuk role ini." />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="dashboard-bento-side-card">
                <div className="dashboard-bento-section-heading">
                  <div>
                    <Title level={4}>Exception Aktif</Title>
                    <Text>Ringkasan cepat.</Text>
                  </div>
                  <Tag color={businessAlertTotal > 0 ? "red" : "green"}>{formatNumberId(businessAlertTotal)}</Tag>
                </div>
                <div className="dashboard-bento-exception-list">
                  {compactExceptionItems.map((item, index) => (
                    <Link key={item.key} to={item.to}>
                      <strong>{item.label}</strong>
                      <span>{formatNumberId(item.count)} item</span>
                      <Tag color={item.color}>{index === 0 ? "P0" : "P1"}</Tag>
                    </Link>
                  ))}
                  {compactExceptionItems.length === 0 ? (
                    <Text className="dashboard-muted-text">Tidak ada exception aktif.</Text>
                  ) : null}
                </div>
              </div>
            </aside>
          </section>

          <section className="dashboard-bento-secondary-grid" aria-label="Ringkasan lanjutan">
            <div className="dashboard-bento-secondary-card">
              <div className="dashboard-bento-section-heading">
                <div>
                  <Title level={4}>Fokus Produksi</Title>
                  <Text>Target dan risiko produksi.</Text>
                </div>
                <Link to={APP_ROUTES.PRODUCTION.PLANNING}>Buka Planning <ArrowRightOutlined /></Link>
              </div>
              <div className="dashboard-bento-production-grid">
                {[
                  { key: "weekly", label: "Target Minggu Ini", data: planningSummary.weekly },
                  { key: "monthly", label: "Target Bulan Ini", data: planningSummary.monthly },
                ].map((item) => (
                  <div key={item.key} className="dashboard-bento-production-item">
                    <Text>{item.label}</Text>
                    <strong>{formatNumberId(item.data.actualCompletedQty)} / {formatNumberId(item.data.targetQty)} pcs</strong>
                    <Progress percent={Math.min(Math.round(item.data.progressPercent || 0), 100)} size="small" />
                  </div>
                ))}
                <div className="dashboard-bento-production-item">
                  <Text>Status Produksi</Text>
                  <div className="dashboard-chip-list">
                    {productionStatusItems.slice(0, 4).map((item) => (
                      <Tag key={item.key} color={item.color}>{item.label}: {formatNumberId(item.value)}</Tag>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="dashboard-bento-secondary-card">
              <div className="dashboard-bento-section-heading">
                <div>
                  <Title level={4}>Stok Kritis</Title>
                  <Text>Item paling urgent.</Text>
                </div>
                <Tag color={lowStockTotal > 0 ? "red" : "green"}>{lowStockTotalLabel} total</Tag>
              </div>
              <div className="dashboard-bento-stock-list">
                {criticalStockPreview.slice(0, 4).map((item) => (
                  <Link key={item.key} to={item.to} className="dashboard-bento-stock-row">
                    <span className="dashboard-bento-action-icon"><AppstoreOutlined /></span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>Available {formatNumberId(item.stock)} {item.unit} · minimum {formatNumberId(item.minStock)} {item.unit}</small>
                    </span>
                    <Tag color={item.severity.color}>{item.severity.label}</Tag>
                  </Link>
                ))}
                {criticalStockPreview.length === 0 ? (
                  <Text className="dashboard-muted-text">Belum ada stok kritis.</Text>
                ) : null}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Dashboard;
