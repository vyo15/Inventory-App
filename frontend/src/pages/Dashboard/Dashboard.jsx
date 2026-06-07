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

/* =====================================================
SECTION: Dashboard Quick Actions — AKTIF / GUARDED
Fungsi:
- Menyediakan shortcut navigasi ke route existing agar user cepat berpindah menu tanpa membuat/mengubah data.

Dipakai oleh:
- Section Aksi Cepat pada Dashboard.

Alasan perubahan:
- Dashboard diarahkan menjadi business control center yang membantu navigasi lintas modul ERP IMS.

Catatan cleanup:
- Jika role/action matrix makin detail, daftar ini bisa dibaca dari config route yang sudah ter-guard, bukan ditulis manual.

Risiko:
- Jika quick action berubah menjadi submit/create otomatis, Dashboard melanggar prinsip read-only dan bisa membuat transaksi/stok/kas dobel.
===================================================== */
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
  const hasStockReadModelFallback = uniqueFailedReads.some((key) => STOCK_READ_MODEL_WARNING_KEYS.has(key));

  if (hasStockReadModelFallback) {
    return "Data stok lokal belum siap atau layanan lokal belum mengembalikan data stok lengkap. Dashboard tetap memakai data aman agar monitoring tidak kosong. Jika warning berulang, buka Database Center lalu jalankan audit/perbaikan stok.";
  }

  return "Sebagian data Dashboard belum siap. Data lain tetap ditampilkan untuk monitoring; cek layanan lokal, koneksi jaringan, atau status runtime modul bila warning berulang.";
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

  // =========================
  // SECTION: Load Dashboard data
  // Fungsi:
  // - meminta dashboardData final dari dashboardService agar page fokus ke rendering UI;
  // - tombol refresh memanggil fungsi yang sama tanpa melakukan write ke collection mana pun.
  // Hubungan flow:
  // - membaca stok, PO, Work Log, Payroll, Income/Expense, Inventory Log, dan Planning sebagai ringkasan operasional.
  // Status:
  // - aktif dipakai; tidak ada write/backfill lama di blok ini.
  // =========================
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

  /* =====================================================
  SECTION: Dashboard Business Alerts — AKTIF / GUARDED
  Fungsi:
  - Merangkum exception lintas stok, produksi, payroll, dan HPP agar Dashboard menjadi control center read-only.

  Dipakai oleh:
  - KPI Data Perlu Dicek dan section Data Perlu Dicek.

  Alasan perubahan:
  - User perlu tahu data/flow yang bermasalah tanpa membuka semua menu IMS satu per satu.

  Catatan cleanup:
  - Alert yang membutuhkan source belum stabil harus tetap menjadi cleanup candidate, bukan dibuat sebagai angka final.

  Risiko:
  - Jika alert dipakai sebagai dasar write otomatis, stok, payroll, HPP, atau report bisa tidak sinkron.
  ===================================================== */
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
        color: "red",
        type: "Stock",
        to: negativeStockRows[0].to,
      });
    }

    if (reservedOverrunRows.length > 0) {
      items.push({
        key: "reserved-overrun",
        label: "Reserved tidak wajar",
        count: reservedOverrunRows.length,
        description: `${reservedOverrunRows[0].name}: reserved ${formatNumberId(reservedOverrunRows[0].reservedStock)} ${reservedOverrunRows[0].unit}.`,
        color: "orange",
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
        color: "gold",
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
        color: "red",
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
        color: planningSummary.overdueCount > 0 ? "red" : "gold",
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
        color: "purple",
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
        color: "cyan",
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

  /* =====================================================
  SECTION: Dashboard KPI Strip — AKTIF
  Fungsi:
  - Mengumpulkan KPI ringkas sales, kas, stok, produksi, payroll, dan alert tanpa menulis data.
  - Menyediakan status kecil per KPI yang membutuhkan perhatian tanpa memakai aksen warna besar pada card.

  Dipakai oleh:
  - Section Ringkasan Hari Ini pada Dashboard.

  Alasan perubahan:
  - Card KPI dibuat netral agar dashboard terlihat lebih profesional; penanda kondisi cukup memakai badge kecil.

  Catatan cleanup:
  - Sales dan cash masih dibaca dari data operasional existing; standardisasi data ringkasan bisa menjadi task terpisah jika data membesar.

  Risiko:
  - Menjumlahkan sales dengan incomes/revenues sebagai angka kas yang sama akan double count dan membuat Profit Loss tidak sinkron.
  ===================================================== */
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

  // =========================
  // SECTION: Prioritas Hari Ini
  // Fungsi:
  // - menyusun maksimal 5 prioritas actionable tanpa menampilkan info dobel;
  // - setiap item hanya navigasi ke menu terkait dan tidak melakukan update data.
  // Hubungan flow:
  // - menggabungkan sinyal stok, PO, planning, Work Log, dan Payroll sebagai control center harian.
  // Status:
  // - aktif dipakai; bukan data historis.
  // =========================
  const priorityItems = useMemo(() => {
    const items = [
      {
        key: "stock-critical",
        label: "Stok kritis perlu dicek",
        count: lowStockTotal,
        description: "Gunakan available stock agar stok reserved tidak terlihat aman palsu.",
        color: "gold",
        icon: <WarningOutlined />,
        to: "/stock-management",
      },
      {
        key: "po-shortage",
        label: "PO shortage",
        count: productionSummary.shortageOrders,
        description: "Cek kebutuhan material/BOM sebelum produksi dimulai.",
        color: "red",
        icon: <ToolOutlined />,
        to: "/produksi/production-orders",
      },
      {
        key: "planning-risk",
        label: "Planning perlu dikejar",
        count: planningSummary.overdueCount || planningSummary.behindTargetCount,
        description: "Overdue atau target belum tercapai berdasarkan Work Log completed.",
        color: planningSummary.overdueCount > 0 ? "red" : "gold",
        icon: <ClockCircleOutlined />,
        to: "/produksi/production-planning",
      },
      {
        key: "po-ready",
        label: "PO siap produksi",
        count: productionSummary.readyOrders,
        description: "Antrian ini sudah siap diproses ke Work Log.",
        color: "blue",
        icon: <CheckCircleOutlined />,
        to: "/produksi/production-orders",
      },
      {
        key: "worklog-running",
        label: "Work Log berjalan",
        count: productionSummary.runningWorkLogs,
        description: "Review pekerjaan yang belum ditutup agar biaya dan output final jelas.",
        color: "purple",
        icon: <BuildOutlined />,
        to: "/produksi/work-log-produksi",
      },
      {
        key: "payroll-pending",
        label: "Payroll pending",
        count: payrollSummary.pendingCount,
        description: "Cek payroll draft/confirmed/unpaid sebelum pembayaran final.",
        color: "cyan",
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
    { key: "shortage", label: "PO Shortage", value: productionSummary.shortageOrders, color: "red" },
    { key: "ready", label: "PO Siap", value: productionSummary.readyOrders, color: "blue" },
    { key: "running", label: "Work Log Jalan", value: productionSummary.runningWorkLogs, color: "purple" },
    { key: "completed", label: "Completed Minggu Ini", value: productionSummary.completedWorkLogs, color: "green" },
    { key: "payroll", label: "Payroll Pending", value: payrollSummary.pendingCount, color: "cyan" },
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

  // =========================
  // SECTION: Restock Assistant Actions
  // Fungsi:
  // - membuka link produk terakhir, prefill halaman Purchases, dan membuka Supplier terfilter;
  // - semua action aman untuk HashRouter karena route internal memakai useNavigate.
  // Hubungan flow:
  // - action Dashboard hanya navigasi/prefill, tidak menulis database lokal dan tidak membuat transaksi otomatis.
  // Status:
  // - aktif dipakai oleh Stok Kritis; bukan kandidat cleanup selama Restock Assistant aktif.
  // =========================
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
      {/* =====================================================
          SECTION: Ringkasan Hari Ini — AKTIF
          Fungsi:
          - Menampilkan KPI compact sales, kas, stok, produksi, payroll, dan data perlu dicek.

          Dipakai oleh:
          - Dashboard control center.

          Alasan perubahan:
          - Owner perlu membaca kondisi bisnis utama dalam sekali lihat tanpa membuka report penuh.

          Catatan cleanup:
          - Sales dan cash dapat dipindahkan ke data ringkasan jika volume data makin besar.

          Risiko:
          - Jika KPI dianggap laporan final, angka bisa disalahartikan karena Dashboard hanya monitoring read-only.
      ===================================================== */}
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

      {/* =====================================================
          SECTION: Aksi Cepat — AKTIF / GUARDED
          Fungsi:
          - Menyediakan shortcut navigasi ke route existing tanpa create/update/delete data.

          Dipakai oleh:
          - User Dashboard untuk berpindah ke Sales, Purchases, Stock, Produksi, Payroll, dan Cash.

          Alasan perubahan:
          - Dashboard sebagai control center perlu mempercepat perpindahan menu ERP IMS.

          Catatan cleanup:
          - Daftar route bisa disatukan dengan config navigasi jika nanti role-aware quick action dibutuhkan.

          Risiko:
          - Jika action diubah menjadi auto-submit, Dashboard akan melanggar read-only dan bisa membuat data dobel.
      ===================================================== */}
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

      {/* =====================================================
          SECTION: Data Perlu Dicek — AKTIF / GUARDED
          Fungsi:
          - Menampilkan exception lintas modul secara compact dan read-only.

          Dipakai oleh:
          - Owner/admin untuk audit cepat stok, produksi, payroll, dan HPP.

          Alasan perubahan:
          - Dashboard perlu menunjukkan masalah operasional yang butuh perhatian sebelum menjadi bug laporan.

          Catatan cleanup:
          - Alert tambahan seperti return/cash anomaly hanya ditambahkan jika source datanya sudah jelas.

          Risiko:
          - Alert yang terlalu banyak atau tidak akurat bisa membuat Dashboard terlihat seperti report besar dan membingungkan user.
      ===================================================== */}
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

      {/* =========================
          SECTION 1: Prioritas Hari Ini
          Fungsi:
          - menampilkan action card paling penting saja;
          - seluruh action hanya Link navigasi, bukan write data.
          Status: aktif dipakai untuk Dashboard read-only; bukan data historis.
      ========================= */}
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

      {/* =========================
          SECTION 2: Fokus Produksi
          Fungsi:
          - merangkum progress planning dan status produksi tanpa tabel besar;
          - planning priority dibatasi 3 item sesuai guard docs.
          Status: aktif read-only; tidak mengubah Planning, PO, Work Log, Payroll, atau HPP.
      ========================= */}
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
                      Sisa {formatNumberId(plan.remainingQty)} {plan.targetUnit || "pcs"} - Progress {formatNumberId(Math.round(plan.progressPercent || 0))}% - Deadline {formatDashboardDate(plan.dueDate)}
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
        {/* =========================
            SECTION 3: Stok Kritis
            Fungsi:
            - mengganti tabel stok menjadi compact list maksimal 5 item;
            - memakai availableStock agar tidak misleading saat ada reserved stock.
            Status: aktif read-only; tidak mengubah Stock Management atau Inventory helper.
        ========================= */}
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
                            <Tag color="blue">Harga terakhir {formatCurrency(item.lastPurchasePrice)}</Tag>
                          ) : null}
                        </Space>
                        {/* =========================
                            SECTION: Restock Assistant Actions per bahan
                            Fungsi: memberi shortcut buka link produk, buat pembelian, dan bandingkan supplier.
                            Hubungan flow: tombol hanya membuka link/navigasi; transaksi baru tetap dibuat manual di Purchases.
                            Status: aktif dipakai; bukan auto-purchase dan bukan mutasi stok.
                        ========================= */}
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

        {/* =========================
            SECTION 4: Keuangan Ringkas
            Fungsi:
            - menampilkan angka kas/expense yang sudah diakui secara ringkas;
            - memberi catatan agar Dashboard tidak dianggap pengganti Profit Loss final.
            Status: aktif read-only; tidak mengubah Profit Loss, Cash In, Cash Out, atau payroll expense.
        ========================= */}
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
                  message={`${formatNumberId(payrollSummary.pendingCount)} payroll masih pending (${formatCurrency(payrollSummary.pendingAmount)}).`}
                />
              ) : null}

              {payrollSummary.paidCount > 0 ? (
                <Alert
                  type={payrollSummary.payrollExpenseCount > 0 ? "success" : "warning"}
                  showIcon
                  message={
                    payrollSummary.payrollExpenseCount > 0
                      ? `Payroll paid bulan ini tercatat ${formatNumberId(payrollSummary.payrollExpenseCount)} kali di Cash Out: ${formatCurrency(payrollSummary.payrollExpenseThisMonth)}. Hindari input ulang manual.`
                      : "Ada payroll paid bulan ini, tetapi expense payroll belum terlihat. Cek Cash Out sebelum membaca Profit Loss."
                  }
                />
              ) : null}

              {productionSummary.costIssueCount > 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  message={`${formatNumberId(productionSummary.costIssueCount)} Work Log completed punya cost 0. Cek HPP/cost material sebelum analisis.`}
                />
              ) : null}
            </div>
          </PageSection>
        </Col>
      </Row>

      {/* =========================
          SECTION 5: Aktivitas Terbaru
          Fungsi:
          - menampilkan feed inventory log terbaru tanpa tabel besar dan tanpa horizontal scroll;
          - maksimal 5 item agar Dashboard tetap compact.
          Status: aktif read-only; tidak mengubah inventory_logs.
      ========================= */}
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
