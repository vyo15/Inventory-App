import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  message,
  Card,
  Col,
  Empty,
  Progress,
  Row,
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
import PageSection from "../../components/Layout/Page/PageSection";
import DataLoadingState from "../../components/Layout/Feedback/DataLoadingState";
import { formatNumberId } from "../../utils/formatters/numberId";
import {
  createEmptyDashboardData,
  normalizeDashboardData,
  readDashboardData,
} from "../../services/Dashboard/dashboardService";
import {
  EMPTY_PLANNING_SUMMARY,
  MAX_DASHBOARD_ALERT_ITEMS,
  MAX_DASHBOARD_LIST_ITEMS,
  MAX_PLANNING_PRIORITY_ITEMS,
  buildRestockRoute,
  formatActivityType,
  formatCurrency,
  formatDashboardDate,
  getFinancialAmount,
  getNumericValue,
  getPlanningItemName,
  getPlanningStatusMeta,
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

const buildDashboardQuickActions = () => [
  {
    key: "sales",
    label: "Tambah Penjualan",
    description: "Buka halaman Sales untuk input transaksi manual.",
    to: "/sales",
    icon: <PlusCircleOutlined />,
  },
  {
    key: "purchases",
    label: "Pembelian",
    description: "Buka Purchases untuk restock bahan/barang.",
    to: "/purchases",
    icon: <ShoppingCartOutlined />,
  },
  {
    key: "stock",
    label: "Cek Stok",
    description: "Buka Stock Management dan audit stok.",
    to: "/stock-management",
    icon: <AppstoreOutlined />,
  },
  {
    key: "stock-report",
    label: "Laporan Stok",
    description: "Buka laporan stok final.",
    to: "/report-stock",
    icon: <BarChartOutlined />,
  },
  {
    key: "planning",
    label: "Production Planning",
    description: "Pantau target mingguan/bulanan produksi.",
    to: "/produksi/production-planning",
    icon: <ClockCircleOutlined />,
  },
  {
    key: "worklog",
    label: "Work Log Produksi",
    description: "Cek pekerjaan produksi berjalan.",
    to: "/produksi/work-log-produksi",
    icon: <BuildOutlined />,
  },
  {
    key: "payroll",
    label: "Payroll Produksi",
    description: "Review payroll draft/unpaid.",
    to: "/produksi/payroll-produksi",
    icon: <DollarCircleOutlined />,
  },
  {
    key: "cash-in",
    label: "Kas Masuk",
    description: "Buka pencatatan kas masuk operasional.",
    to: "/cash-in",
    icon: <WalletOutlined />,
  },
  {
    key: "cash-out",
    label: "Kas Keluar",
    description: "Buka pencatatan kas keluar/biaya.",
    to: "/cash-out",
    icon: <WalletOutlined />,
  },
];

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

const getSafeExternalHttpUrl = (value) => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  try {
    const parsedUrl = new URL(rawValue);
    return ["http:", "https:"].includes(parsedUrl.protocol) ? parsedUrl.href : "";
  } catch {
    return "";
  }
};

const hasSafeExternalHttpUrl = (value) => Boolean(getSafeExternalHttpUrl(value));

const Dashboard = () => {
  const navigate = useNavigate();
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
  }, []);

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
  const quickActions = useMemo(() => buildDashboardQuickActions(), []);

  const planningPriorityItems = planningSummary.priorityPlans
    .filter((plan) => !isCompletedStatus(plan.status) && !isCancelledStatus(plan.status))
    .slice(0, MAX_PLANNING_PRIORITY_ITEMS);

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
        label: "Stok kritis",
        count: lowStockTotal,
        description: "Ada item kosong/menipis berdasarkan threshold master.",
        color: DASHBOARD_TAG_COLORS.warning,
        type: "Stock",
        to: "/stock-management",
      });
    }

    if (productionSummary.shortageOrders > 0) {
      items.push({
        key: "po-shortage-alert",
        label: "PO shortage",
        count: productionSummary.shortageOrders,
        description: "Material/BOM perlu dicek sebelum produksi berjalan.",
        color: DASHBOARD_TAG_COLORS.danger,
        type: "Production",
        to: "/produksi/production-orders",
      });
    }

    if (planningSummary.overdueCount > 0 || planningSummary.behindTargetCount > 0) {
      items.push({
        key: "planning-alert",
        label: "Planning perlu dicek",
        count: planningSummary.overdueCount + planningSummary.behindTargetCount,
        description: "Ada planning overdue atau tertinggal target.",
        color: planningSummary.overdueCount > 0 ? DASHBOARD_TAG_COLORS.danger : DASHBOARD_TAG_COLORS.warning,
        type: "Production",
        to: "/produksi/production-planning",
      });
    }

    if (productionSummary.costIssueCount > 0) {
      items.push({
        key: "hpp-cost-alert",
        label: "Cost/HPP kosong",
        count: productionSummary.costIssueCount,
        description: "Work Log completed punya cost actual 0.",
        color: DASHBOARD_TAG_COLORS.production,
        type: "HPP",
        to: "/produksi/analisis-hpp",
      });
    }

    if (payrollSummary.pendingCount > 0) {
      items.push({
        key: "payroll-pending-alert",
        label: "Payroll pending",
        count: payrollSummary.pendingCount,
        description: `${formatCurrency(payrollSummary.pendingAmount)} masih perlu review/pembayaran.`,
        color: DASHBOARD_TAG_COLORS.payroll,
        type: "Payroll",
        to: "/produksi/payroll-produksi",
      });
    }

    return items.slice(0, MAX_DASHBOARD_ALERT_ITEMS);
  }, [
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
      label: "Sales Bulan Ini",
      value: formatCurrency(salesSummary.monthAmount),
      detail: `${formatNumberId(salesSummary.monthCount)} bulan ini · ${formatCurrency(salesSummary.todayAmount)} hari ini`,
      tone: "primary",
    },
    {
      key: "cash-in",
      label: "Kas Masuk",
      value: formatCurrency(financeSummary.recognizedIncome),
      detail: "revenues + incomes bulan ini",
      tone: "success",
    },
    {
      key: "cash-out",
      label: "Kas Keluar",
      value: formatCurrency(financeSummary.expenseThisMonth),
      detail: "expenses bulan ini",
      tone: "danger",
    },
    {
      key: "net-cash",
      label: "Net Kas Operasional",
      value: formatCurrency(financeSummary.netOperational),
      detail: "monitoring, bukan laba final",
      tone: financeSummary.netOperational < 0 ? "danger" : "success",
      statusLabel: financeSummary.netOperational < 0 ? "Perlu Dicek" : null,
      statusTone: "warning",
    },
    {
      key: "stock-critical",
      label: "Stok Kritis",
      value: lowStockTotalLabel,
      detail: stockIssueHasMore ? "minimal item issue termuat" : "produk, bahan, semi finished",
      tone: lowStockTotal > 0 ? "warning" : "success",
      statusLabel: lowStockTotal > 0 ? "Kritis" : null,
      statusTone: "warning",
    },
    {
      key: "production-watch",
      label: "Produksi Dicek",
      value: formatNumberId(productionSummary.shortageOrders + planningSummary.overdueCount + planningSummary.behindTargetCount),
      detail: "shortage/overdue/behind target",
      tone: productionSummary.shortageOrders + planningSummary.overdueCount > 0 ? "danger" : "primary",
      statusLabel: productionSummary.shortageOrders + planningSummary.overdueCount > 0 ? "Perlu Dicek" : null,
      statusTone: "warning",
    },
    {
      key: "payroll-pending",
      label: "Payroll Pending",
      value: formatNumberId(payrollSummary.pendingCount),
      detail: formatCurrency(payrollSummary.pendingAmount),
      tone: payrollSummary.pendingCount > 0 ? "warning" : "success",
      statusLabel: payrollSummary.pendingCount > 0 ? "Pending" : null,
      statusTone: "warning",
    },
    {
      key: "data-watch",
      label: "Data Perlu Dicek",
      value: formatNumberId(businessAlertTotal),
      detail: "exception lintas modul",
      tone: businessAlertTotal > 0 ? "warning" : "success",
      statusLabel: businessAlertTotal > 0 ? "Perlu Dicek" : null,
      statusTone: "warning",
    },
  ], [
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
        label: "Stok kritis perlu dicek",
        count: lowStockTotal,
        description: "Gunakan available stock agar stok reserved tidak terlihat aman palsu.",
        color: DASHBOARD_TAG_COLORS.warning,
        icon: <WarningOutlined />,
        to: "/stock-management",
      },
      {
        key: "po-shortage",
        label: "PO shortage",
        count: productionSummary.shortageOrders,
        description: "Cek kebutuhan material/BOM sebelum produksi dimulai.",
        color: DASHBOARD_TAG_COLORS.danger,
        icon: <ToolOutlined />,
        to: "/produksi/production-orders",
      },
      {
        key: "planning-risk",
        label: "Planning perlu dikejar",
        count: planningSummary.overdueCount || planningSummary.behindTargetCount,
        description: "Overdue atau target belum tercapai berdasarkan Work Log completed.",
        color: planningSummary.overdueCount > 0 ? DASHBOARD_TAG_COLORS.danger : DASHBOARD_TAG_COLORS.warning,
        icon: <ClockCircleOutlined />,
        to: "/produksi/production-planning",
      },
      {
        key: "po-ready",
        label: "PO siap produksi",
        count: productionSummary.readyOrders,
        description: "Antrian ini sudah siap diproses ke Work Log.",
        color: DASHBOARD_TAG_COLORS.info,
        icon: <CheckCircleOutlined />,
        to: "/produksi/production-orders",
      },
      {
        key: "worklog-running",
        label: "Work Log berjalan",
        count: productionSummary.runningWorkLogs,
        description: "Review pekerjaan yang belum ditutup agar biaya dan output final jelas.",
        color: DASHBOARD_TAG_COLORS.production,
        icon: <BuildOutlined />,
        to: "/produksi/work-log-produksi",
      },
      {
        key: "payroll-pending",
        label: "Payroll pending",
        count: payrollSummary.pendingCount,
        description: "Cek payroll draft/confirmed/unpaid sebelum pembayaran final.",
        color: DASHBOARD_TAG_COLORS.payroll,
        icon: <DollarCircleOutlined />,
        to: "/produksi/payroll-produksi",
      },
    ];

    return items.filter((item) => item.count > 0).slice(0, MAX_DASHBOARD_LIST_ITEMS);
  }, [
    lowStockTotal,
    payrollSummary.pendingCount,
    planningSummary.behindTargetCount,
    planningSummary.overdueCount,
    productionSummary.readyOrders,
    productionSummary.runningWorkLogs,
    productionSummary.shortageOrders,
  ]);

  const productionStatusItems = [
    { key: "shortage", label: "PO Shortage", value: productionSummary.shortageOrders, color: DASHBOARD_TAG_COLORS.danger },
    { key: "ready", label: "PO Siap", value: productionSummary.readyOrders, color: DASHBOARD_TAG_COLORS.info },
    { key: "running", label: "Work Log Jalan", value: productionSummary.runningWorkLogs, color: DASHBOARD_TAG_COLORS.production },
    { key: "completed", label: "Completed Minggu Ini", value: productionSummary.completedWorkLogs, color: DASHBOARD_TAG_COLORS.success },
    { key: "payroll", label: "Payroll Pending", value: payrollSummary.pendingCount, color: DASHBOARD_TAG_COLORS.payroll },
  ];

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
  const openRestockProductLink = (productLink) => {
    const safeProductLink = getSafeExternalHttpUrl(productLink);

    if (!safeProductLink) {
      message.warning("Link produk tidak valid. Hanya URL http/https yang bisa dibuka dari Dashboard.");
      return;
    }

    window.open(safeProductLink, "_blank", "noopener,noreferrer");
  };

  const goToRestockPurchase = (item) => {
    navigate(buildRestockRoute("/purchases", {
      materialId: item.id,
      supplierId: item.restockSupplierId,
      productLink: getSafeExternalHttpUrl(item.restockProductLink),
      source: "dashboard-restock",
    }));
  };

  const goToSupplierComparison = (item) => {
    navigate(buildRestockRoute("/suppliers", {
      materialId: item.id,
      supplierId: item.restockSupplierId,
    }));
  };

  return (
    <div className="dashboard-page">
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

      {loadWarning ? <Alert type="warning" showIcon message={loadWarning} /> : null}

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
      {}
      <PageSection
        title="Ringkasan Hari Ini"
        subtitle="KPI utama harian."
      >
        <div className="dashboard-kpi-grid">
          {kpiItems.map((item) => (
            <div key={item.key} className={`dashboard-kpi-card dashboard-kpi-card-${item.tone}`}>
              <div className="dashboard-kpi-card-heading">
                <Text className="dashboard-card-label">{item.label}</Text>
                {item.statusLabel ? (
                  <Tag className={`dashboard-kpi-status dashboard-kpi-status-${item.statusTone || "neutral"}`}>
                    {item.statusLabel}
                  </Tag>
                ) : null}
              </div>
              <Title level={4} className="dashboard-card-value">
                {item.value}
              </Title>
              <Text className="dashboard-muted-text">{item.detail}</Text>
            </div>
          ))}
        </div>
      </PageSection>

      {}
      <PageSection
        title="Aksi Cepat"
        subtitle="Akses menu utama."
      >
        <div className="dashboard-quick-action-grid">
          {quickActions.map((action) => (
            <Link key={action.key} to={action.to} className="dashboard-quick-action-card">
              <div className="dashboard-quick-action-icon">{action.icon}</div>
              <div className="dashboard-list-card-content">
                <Text strong>{action.label}</Text>
                <Text className="dashboard-muted-text">{action.description}</Text>
              </div>
              <ArrowRightOutlined className="dashboard-action-arrow" />
            </Link>
          ))}
        </div>
      </PageSection>

      {}
      <PageSection
        title="Data Perlu Dicek"
        subtitle="Prioritas operasional."
      >
        {businessAlertItems.length > 0 ? (
          <div className="dashboard-alert-grid">
            {businessAlertItems.map((item) => (
              <Link key={item.key} to={item.to} className="dashboard-alert-card">
                <div className="dashboard-list-card-content">
                  <Space size={8} wrap>
                    <Tag color={item.color}>{item.type}</Tag>
                    <Tag color={item.color}>{formatNumberId(item.count)}</Tag>
                    <Text strong>{item.label}</Text>
                  </Space>
                  <Text className="dashboard-muted-text">{item.description}</Text>
                </div>
                <ArrowRightOutlined className="dashboard-action-arrow" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty-wrap dashboard-empty-compact">
            <Empty description="Belum ada data kritis yang perlu dicek." />
          </div>
        )}
      </PageSection>
      <PageSection
        title="Prioritas Hari Ini"
        subtitle="Fokus harian."
      >
        {priorityItems.length > 0 ? (
          <div className="dashboard-priority-grid">
            {priorityItems.map((item) => (
              <Link key={item.key} to={item.to} className="dashboard-priority-card">
                <div className="dashboard-priority-icon">{item.icon}</div>
                <div className="dashboard-priority-content">
                  <Space size={8} wrap>
                    <Tag color={item.color}>{formatNumberId(item.count)}</Tag>
                    <Text strong>{item.label}</Text>
                  </Space>
                  <Text className="dashboard-muted-text">{item.description}</Text>
                </div>
                <ArrowRightOutlined className="dashboard-action-arrow" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty-wrap dashboard-empty-compact">
            <Empty description="Belum ada prioritas harian yang perlu ditindak." />
          </div>
        )}
      </PageSection>
      <PageSection
        title="Fokus Produksi"
        subtitle="Target dan risiko produksi."
        extra={
          <Link to="/produksi/production-planning" className="dashboard-section-extra">
            Buka Planning <ArrowRightOutlined />
          </Link>
        }
      >
        <Row gutter={[14, 14]}>
          {[
            { key: "weekly", label: "Target Minggu Ini", data: planningSummary.weekly },
            { key: "monthly", label: "Target Bulan Ini", data: planningSummary.monthly },
          ].map((item) => (
            <Col xs={24} lg={8} key={item.key}>
              <Card className="dashboard-compact-card" bordered={false}>
                <Space direction="vertical" size={8} className="dashboard-full-width">
                  <Text className="dashboard-card-label">{item.label}</Text>
                  <Title level={4} className="dashboard-card-value">
                    {formatNumberId(item.data.actualCompletedQty)} / {formatNumberId(item.data.targetQty)} pcs
                  </Title>
                  <Progress
                    percent={Math.min(Math.round(item.data.progressPercent || 0), 100)}
                    size="small"
                    status={item.data.progressPercent >= 100 ? "success" : "active"}
                  />
                  <Text className="dashboard-muted-text">
                    Sisa {formatNumberId(item.data.remainingQty)} pcs dari {formatNumberId(item.data.count)} planning.
                  </Text>
                </Space>
              </Card>
            </Col>
          ))}

          <Col xs={24} lg={8}>
            <Card className="dashboard-compact-card dashboard-risk-card" bordered={false}>
              <Space direction="vertical" size={8} className="dashboard-full-width">
                <Text className="dashboard-card-label">Status Produksi</Text>
                <div className="dashboard-chip-list">
                  {productionStatusItems.map((item) => (
                    <Tag key={item.key} color={item.color} className="dashboard-status-chip">
                      {item.label}: {formatNumberId(item.value)}
                    </Tag>
                  ))}
                </div>
                <Text className="dashboard-muted-text">
                  Ringkasan ini hanya monitoring. Proses tetap dilakukan dari menu produksi terkait.
                </Text>
              </Space>
            </Card>
          </Col>
        </Row>

        <div className="dashboard-card-list dashboard-section-gap">
          {planningPriorityItems.length > 0 ? (
            planningPriorityItems.map((plan) => {
              const statusMeta = getPlanningStatusMeta(plan.status);
              return (
                <Link
                  key={plan.id || plan.planCode}
                  to="/produksi/production-planning"
                  className="dashboard-list-card"
                >
                  <div className="dashboard-list-card-content">
                    <Space size={8} wrap>
                      <Text strong>{getPlanningItemName(plan)}</Text>
                      {plan.targetVariantLabel ? <Tag>{plan.targetVariantLabel}</Tag> : null}
                      <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                    </Space>
                    <Text className="dashboard-muted-text">
                      Sisa {formatNumberId(plan.remainingQty)} {plan.targetUnit || "pcs"} - Progress{" "}
                      {formatNumberId(Math.round(plan.progressPercent || 0))}% - Deadline{" "}
                      {formatDashboardDate(plan.dueDate)}
                    </Text>
                  </div>
                  <ArrowRightOutlined className="dashboard-action-arrow" />
                </Link>
              );
            })
          ) : (
            <div className="dashboard-empty-wrap dashboard-empty-compact">
              <Empty description="Belum ada planning produksi yang perlu dikejar." />
            </div>
          )}
        </div>
      </PageSection>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <PageSection
            title="Stok Kritis"
            subtitle="Stok paling urgent."
            extra={<Text className="dashboard-section-extra">{lowStockTotalLabel} total</Text>}
          >
            {criticalStockPreview.length > 0 ? (
              <div className="dashboard-card-list">
                {criticalStockPreview.map((item) => {
                  const isMaterialRestock = item.sourceType === "material";

                  if (!isMaterialRestock) {
                    return (
                      <Link key={item.key} to={item.to} className="dashboard-list-card">
                        <div className="dashboard-list-card-content">
                          <Space size={8} wrap>
                            <Text strong>{item.name}</Text>
                            <Tag color={item.severity.color}>{item.severity.label}</Tag>
                            <Tag>{item.type}</Tag>
                          </Space>
                          <Text className="dashboard-muted-text">
                            Available {formatNumberId(item.stock)} {item.unit} - Min {formatNumberId(item.minStock)} {item.unit}
                          </Text>
                          {item.affectedVariantSummary ? (
                            <Text className="dashboard-muted-text">{item.affectedVariantSummary}</Text>
                          ) : null}
                        </div>
                        <ArrowRightOutlined className="dashboard-action-arrow" />
                      </Link>
                    );
                  }

                  return (
                    <div key={item.key} className="dashboard-list-card dashboard-readonly-card dashboard-restock-card">
                      <div className="dashboard-list-card-content">
                        <Space size={8} wrap>
                          <Text strong>{item.name}</Text>
                          <Tag color={item.severity.color}>{item.severity.label}</Tag>
                          <Tag>{item.type}</Tag>
                        </Space>
                        <Text className="dashboard-muted-text">
                          Available {formatNumberId(item.stock)} {item.unit} - Min {formatNumberId(item.minStock)} {item.unit}
                        </Text>
                        {item.affectedVariantSummary ? (
                          <Text className="dashboard-muted-text">{item.affectedVariantSummary}</Text>
                        ) : null}
                        <Space size={8} wrap>
                          <Text className="dashboard-muted-text">
                            {item.restockSupplierName ? `Supplier terakhir: ${item.restockSupplierName}` : "Belum ada supplier terakhir"}
                          </Text>
                          {item.lastPurchasePrice > 0 ? (
                            <Tag color={DASHBOARD_TAG_COLORS.info}>Harga terakhir {formatCurrency(item.lastPurchasePrice)}</Tag>
                          ) : null}
                        </Space>
                        {}
                        <Space size={8} wrap className="dashboard-restock-actions">
                          <Button
                            size="small"
                            disabled={!hasSafeExternalHttpUrl(item.restockProductLink)}
                            onClick={() => openRestockProductLink(item.restockProductLink)}
                          >
                            Buka Link Produk
                          </Button>
                          <Button
                            size="small"
                            type="primary"
                            icon={<ShoppingCartOutlined />}
                            onClick={() => goToRestockPurchase(item)}
                          >
                            Buat Pembelian
                          </Button>
                          <Button size="small" onClick={() => goToSupplierComparison(item)}>
                            Bandingkan Supplier
                          </Button>
                        </Space>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="dashboard-empty-wrap dashboard-empty-compact">
                <Empty description="Belum ada stok kritis." />
              </div>
            )}
          </PageSection>
        </Col>
        <Col xs={24} xl={12}>
          <PageSection
            title="Keuangan Ringkas"
            subtitle="Kas bulan berjalan."
          >
            <div className="dashboard-metric-grid">
              <div className="dashboard-metric-card">
                <Text className="dashboard-card-label">Pemasukan Diakui</Text>
                <Title level={4} className="dashboard-card-value">
                  {formatCurrency(financeSummary.recognizedIncome)}
                </Title>
                <Text className="dashboard-muted-text">Kas masuk bulan ini.</Text>
              </div>
              <div className="dashboard-metric-card">
                <Text className="dashboard-card-label">Pengeluaran</Text>
                <Title level={4} className="dashboard-card-value">
                  {formatCurrency(financeSummary.expenseThisMonth)}
                </Title>
                <Text className="dashboard-muted-text">Kas keluar bulan ini.</Text>
              </div>
              <div className="dashboard-metric-card">
                <Text className="dashboard-card-label">Selisih Ringkas</Text>
                <Title level={4} className="dashboard-card-value">
                  {formatCurrency(financeSummary.netOperational)}
                </Title>
                <Text className="dashboard-muted-text">Ringkasan cepat.</Text>
              </div>
            </div>

            <div className="dashboard-note-stack">
              {payrollSummary.pendingCount > 0 ? (
                <Alert
                  type="info"
                  showIcon
                  message={`${formatNumberId(
                    payrollSummary.pendingCount,
                  )} payroll masih pending (${formatCurrency(payrollSummary.pendingAmount)}).`}
                />
              ) : null}

              {payrollSummary.paidCount > 0 ? (
                <Alert
                  type={payrollSummary.payrollExpenseCount > 0 ? "success" : "warning"}
                  showIcon
                  message={
                    payrollSummary.payrollExpenseCount > 0
                      ? [
                          `Payroll paid bulan ini tercatat ${formatNumberId(
                            payrollSummary.payrollExpenseCount,
                          )} kali di Cash Out:`,
                          `${formatCurrency(payrollSummary.payrollExpenseThisMonth)}.`,
                          "Hindari input ulang manual.",
                        ].join(" ")
                      : "Ada payroll paid bulan ini, tetapi expense payroll belum terlihat. Cek Cash Out sebelum membaca Profit Loss."
                  }
                />
              ) : null}

              {productionSummary.costIssueCount > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message={`${formatNumberId(
                    productionSummary.costIssueCount,
                  )} Work Log completed punya cost 0. Cek HPP/cost material sebelum analisis.`}
                />
              ) : null}
            </div>
          </PageSection>
        </Col>
      </Row>
      <PageSection
        title="Aktivitas Terbaru"
        subtitle="Mutasi stok terakhir."
        extra={
          <Space size={8}>
            <HistoryOutlined className="dashboard-section-icon" />
            <Text className="dashboard-section-extra">
              {formatNumberId(recentActivities.length)} aktivitas
            </Text>
          </Space>
        }
      >
        {recentActivities.length > 0 ? (
          <div className="dashboard-card-list">
            {recentActivities.slice(0, MAX_DASHBOARD_LIST_ITEMS).map((item) => {
              const activity = formatActivityType(item.type);
              const activityDate = getTransactionDate(item);
              const quantity = Math.abs(getNumericValue(item.quantityChange ?? item.quantity ?? 0));
              return (
                <div key={item.id} className="dashboard-list-card dashboard-readonly-card">
                  <div className="dashboard-list-card-content">
                    <Space size={8} wrap>
                      <Tag color={activity.color}>{activity.label}</Tag>
                      <Text strong>
                        {item.itemName || item.name || item.productName || item.materialName || "Item"}
                      </Text>
                    </Space>
                    <Text className="dashboard-muted-text">
                      Qty {formatNumberId(quantity)} - {item.note || item.reference || "Tidak ada catatan"}
                    </Text>
                  </div>
                  <Text className="dashboard-date-text">
                    {activityDate ? formatDashboardDate(activityDate) : "-"}
                  </Text>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-empty-wrap dashboard-empty-compact">
            <Empty description="Belum ada aktivitas yang bisa ditampilkan." />
          </div>
        )}
      </PageSection>
        </>
      )}
    </div>
  );
};

export default Dashboard;
