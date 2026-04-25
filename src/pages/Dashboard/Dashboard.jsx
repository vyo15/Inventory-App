import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Alert,
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
  ArrowRightOutlined,
  BuildOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarCircleOutlined,
  HistoryOutlined,
  ReloadOutlined,
  ToolOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { formatNumberId } from "../../utils/formatters/numberId";
import { getProductionPlanningDashboardSummary } from "../../services/Produksi/productionPlanningService";
import "./Dashboard.css";

const { Text, Title } = Typography;

// =========================
// SECTION: Dashboard limits
// Fungsi:
// - mengunci Dashboard sebagai control center compact sesuai docs project;
// - list tidak boleh panjang supaya Dashboard tidak berubah menjadi laporan besar.
// Hubungan flow:
// - hanya membatasi tampilan read-only, tidak mengubah stok, sales, produksi, payroll, HPP, kas, atau laporan.
// Status:
// - aktif dipakai; bukan legacy dan bukan kandidat cleanup.
// =========================
const MAX_DASHBOARD_LIST_ITEMS = 5;
const MAX_PLANNING_PRIORITY_ITEMS = 3;

const EMPTY_PLANNING_PERIOD_SUMMARY = {
  count: 0,
  targetQty: 0,
  actualCompletedQty: 0,
  remainingQty: 0,
  progressPercent: 0,
  priorityPlans: [],
};

const EMPTY_PLANNING_SUMMARY = {
  weekly: EMPTY_PLANNING_PERIOD_SUMMARY,
  monthly: EMPTY_PLANNING_PERIOD_SUMMARY,
  overdueCount: 0,
  behindTargetCount: 0,
  priorityPlans: [],
};

// =========================
// SECTION: Helpers - parsing data lama/baru
// Fungsi:
// - menjaga Dashboard tetap aman saat field Firestore berbeda antara data lama dan data baru;
// - semua helper hanya membaca data dan tidak melakukan write.
// Hubungan flow:
// - dipakai untuk summary read-only dari Sales, Expense, Inventory Log, PO, Work Log, Payroll, dan Planning.
// Status:
// - aktif sebagai guard kompatibilitas; kandidat cleanup hanya jika schema sudah 100% diseragamkan.
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

const getTransactionDate = (record = {}) => {
  const candidates = [
    record?.date,
    record?.transactionDate,
    record?.paidAt,
    record?.completedAt,
    record?.createdAt,
    record?.timestamp,
    record?.updatedAt,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (typeof candidate?.toDate === "function") return candidate.toDate();
    if (candidate instanceof Date) return candidate;

    if (typeof candidate === "string" || typeof candidate === "number") {
      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return null;
};

const isSameMonth = (date, referenceDate = new Date()) => {
  if (!date) return false;
  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth()
  );
};

const isSameWeek = (date, referenceDate = new Date()) => {
  if (!date) return false;

  const startOfWeek = new Date(referenceDate);
  const day = startOfWeek.getDay() || 7;
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - day + 1);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return date >= startOfWeek && date < endOfWeek;
};

const getFinancialAmount = (record = {}) => {
  const candidates = [
    record?.amount,
    record?.grandTotal,
    record?.totalAmount,
    record?.finalAmount,
    record?.total,
    record?.amountPaid,
  ];

  for (const candidate of candidates) {
    const value = getNumericValue(candidate);
    if (value > 0) return value;
  }

  return 0;
};

const formatCurrency = (value) => `Rp ${formatNumberId(Math.round(value || 0))}`;

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const isCompletedStatus = (value) =>
  ["completed", "complete", "selesai", "done"].includes(normalizeStatus(value));

const isPayrollPending = (record = {}) => {
  const paymentStatus = normalizeStatus(record.paymentStatus);
  const status = normalizeStatus(record.status);
  return paymentStatus === "unpaid" || status === "draft" || status === "confirmed";
};

const isPayrollPaid = (record = {}) => {
  const paymentStatus = normalizeStatus(record.paymentStatus);
  const status = normalizeStatus(record.status);
  return paymentStatus === "paid" || status === "paid";
};

// =========================
// SECTION: Helpers - stok kritis
// Fungsi:
// - Dashboard memakai availableStock lebih dulu agar tidak misleading saat ada reserved stock;
// - fallback currentStock/stock tetap ada untuk kompatibilitas data lama.
// Hubungan flow:
// - hanya membaca master stok; tidak memanggil helper mutasi dan tidak mengubah stock.
// Status:
// - aktif dipakai; legacy fallback boleh dibersihkan setelah schema stok lama tidak dipakai.
// =========================
const getItemDisplayName = (item = {}) =>
  item?.name || item?.productName || item?.materialName || "-";

const getItemStock = (item = {}) =>
  getNumericValue(item?.availableStock ?? item?.currentStock ?? item?.stock ?? 0);

const getItemMinStock = (item = {}) =>
  getNumericValue(item?.minStockAlert ?? item?.minStock ?? 0);

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
      to: "/stock-management",
    })),
    ...materials.map((item) => ({
      key: `material-${item.id}`,
      name: getItemDisplayName(item),
      stock: getItemStock(item),
      minStock: getItemMinStock(item),
      unit: item?.unit || "pcs",
      type: "Bahan Baku",
      severity: getLowStockSeverity(item),
      to: "/stock-management",
    })),
  ].filter((item) => item.stock <= 0 || (item.minStock > 0 && item.stock <= item.minStock));

  return rows.sort((left, right) => {
    const leftGap = left.stock - Math.max(left.minStock, 0);
    const rightGap = right.stock - Math.max(right.minStock, 0);
    return leftGap - rightGap;
  });
};

// =========================
// SECTION: Helpers - HPP/cost guard
// Fungsi:
// - mendeteksi Work Log completed yang punya cost 0 supaya Dashboard memberi catatan kecil;
// - tidak mengisi ulang cost dan tidak memproses ulang Work Log.
// Hubungan flow:
// - menjaga Dashboard tidak misleading terhadap HPP; source final tetap halaman HPP/Profit Loss.
// Status:
// - aktif sebagai warning read-only; bukan legacy dan bukan proses auto posting.
// =========================
const hasWorkLogCostIssue = (workLog = {}) => {
  if (!isCompletedStatus(workLog.status)) return false;

  const materialCost = getNumericValue(workLog.materialCostActual);
  const laborCost = getNumericValue(workLog.laborCostActual);
  const totalCost = getNumericValue(workLog.totalCostActual);
  const costPerGoodUnit = getNumericValue(workLog.costPerGoodUnit);
  const goodQty = getNumericValue(workLog.goodQty ?? workLog.actualGoodQty ?? workLog.outputGoodQty);

  return (
    materialCost <= 0 ||
    laborCost <= 0 ||
    totalCost <= 0 ||
    (goodQty > 0 && costPerGoodUnit <= 0)
  );
};

// =========================
// SECTION: Helpers - activity & planning
// Fungsi:
// - mengubah log teknis menjadi label operasional compact;
// - normalisasi planning hanya untuk tampilan read-only.
// Hubungan flow:
// - activity feed membaca inventory_logs, planning membaca service summary; keduanya tidak menulis data.
// Status:
// - aktif dipakai; bukan legacy.
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

  return { label: type || "Aktivitas", color: "default" };
};

const normalizePlanningPeriodSummary = (summary = {}) => ({
  count: getNumericValue(summary.count),
  targetQty: getNumericValue(summary.targetQty),
  actualCompletedQty: getNumericValue(summary.actualCompletedQty),
  remainingQty: getNumericValue(summary.remainingQty),
  progressPercent: Math.max(0, Math.min(getNumericValue(summary.progressPercent), 999)),
  priorityPlans: Array.isArray(summary.priorityPlans) ? summary.priorityPlans : [],
});

const normalizePlanningDashboardSummary = (summary = EMPTY_PLANNING_SUMMARY) => ({
  weekly: normalizePlanningPeriodSummary(summary.weekly),
  monthly: normalizePlanningPeriodSummary(summary.monthly),
  overdueCount: getNumericValue(summary.overdueCount),
  behindTargetCount: getNumericValue(summary.behindTargetCount),
  priorityPlans: Array.isArray(summary.priorityPlans) ? summary.priorityPlans : [],
});

const getPlanningStatusMeta = (status) => {
  const normalized = normalizeStatus(status || "active");

  if (normalized === "completed") return { label: "Selesai", color: "green" };
  if (normalized === "overdue") return { label: "Overdue", color: "red" };
  if (normalized === "cancelled") return { label: "Dibatalkan", color: "default" };
  if (normalized === "draft") return { label: "Draft", color: "blue" };

  return { label: "Kurang Target", color: "gold" };
};

const getPlanningItemName = (plan = {}) =>
  plan.targetItemName || plan.title || plan.planCode || "Planning produksi";

const formatDashboardDate = (value) => {
  const date = getTransactionDate({ date: value });
  if (!date) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadWarning, setLoadWarning] = useState("");
  const [dashboardData, setDashboardData] = useState({
    lowStockRows: [],
    recentActivities: [],
    productionOrders: [],
    workLogs: [],
    payrolls: [],
    expenses: [],
    incomes: [],
    revenues: [],
    planningSummary: EMPTY_PLANNING_SUMMARY,
  });

  // =========================
  // SECTION: Load Dashboard data
  // Fungsi:
  // - mengambil snapshot read-only untuk 5 section Dashboard;
  // - tombol refresh memanggil fungsi yang sama tanpa melakukan write ke collection mana pun.
  // Hubungan flow:
  // - membaca stok, PO, Work Log, Payroll, Income/Expense, Inventory Log, dan Planning sebagai ringkasan operasional.
  // Status:
  // - aktif dipakai; tidak ada legacy write/backfill di blok ini.
  // =========================
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadWarning("");

      const recentActivitiesQuery = query(
        collection(db, "inventory_logs"),
        orderBy("timestamp", "desc"),
        limit(MAX_DASHBOARD_LIST_ITEMS),
      );

      const [
        productsSnap,
        materialsSnap,
        recentActivitiesSnap,
        productionOrdersSnap,
        workLogsSnap,
        payrollsSnap,
        expensesSnap,
        incomesSnap,
        revenuesSnap,
        planningSummary,
      ] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "raw_materials")),
        getDocs(recentActivitiesQuery),
        getDocs(collection(db, "production_orders")),
        getDocs(collection(db, "production_work_logs")),
        getDocs(collection(db, "production_payrolls")),
        getDocs(collection(db, "expenses")),
        getDocs(collection(db, "incomes")),
        getDocs(collection(db, "revenues")),
        getProductionPlanningDashboardSummary().catch((error) => {
          console.warn("Gagal memuat summary production planning:", error);
          return EMPTY_PLANNING_SUMMARY;
        }),
      ]);

      const products = productsSnap.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      const materials = materialsSnap.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      setDashboardData({
        lowStockRows: buildLowStockRows(products, materials),
        recentActivities: recentActivitiesSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        })),
        productionOrders: productionOrdersSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        })),
        workLogs: workLogsSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        })),
        payrolls: payrollsSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        })),
        expenses: expensesSnap.docs.map((docItem) => ({
          id: docItem.id,
          ...docItem.data(),
        })),
        incomes: incomesSnap.docs.map((docItem) => ({
          id: docItem.id,
          sourceCollection: "incomes",
          ...docItem.data(),
        })),
        revenues: revenuesSnap.docs.map((docItem) => ({
          id: docItem.id,
          sourceCollection: "revenues",
          ...docItem.data(),
        })),
        planningSummary: normalizePlanningDashboardSummary(planningSummary),
      });
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Gagal memuat dashboard:", error);
      setLoadWarning("Sebagian data Dashboard gagal dimuat. Cek koneksi atau index Firestore, lalu refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const {
    lowStockRows,
    recentActivities,
    productionOrders,
    workLogs,
    payrolls,
    expenses,
    incomes,
    revenues,
    planningSummary,
  } = dashboardData;

  const lowStockTotal = lowStockRows.length;
  const criticalStockPreview = lowStockRows.slice(0, MAX_DASHBOARD_LIST_ITEMS);
  const planningPriorityItems = planningSummary.priorityPlans
    .filter((plan) => !["completed", "cancelled"].includes(normalizeStatus(plan.status)))
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

  // =========================
  // SECTION: Prioritas Hari Ini
  // Fungsi:
  // - menyusun maksimal 5 prioritas actionable tanpa menampilkan info dobel;
  // - setiap item hanya navigasi ke menu terkait dan tidak melakukan update data.
  // Hubungan flow:
  // - menggabungkan sinyal stok, PO, planning, Work Log, dan Payroll sebagai control center harian.
  // Status:
  // - aktif dipakai; bukan legacy.
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

  return (
    <div className="dashboard-page">
      <PageHeader
        title="Dashboard"
        subtitle="Pusat kontrol harian yang ringkas, read-only, dan tidak mengubah stok, kas, produksi, payroll, HPP, atau laporan."
        extra={<Text className="dashboard-section-extra">Terakhir diperbarui: {lastUpdatedText}</Text>}
        actions={[
          {
            key: "refresh-dashboard",
            label: "Refresh",
            icon: <ReloadOutlined />,
            onClick: loadDashboardData,
          },
        ]}
      />

      {loadWarning ? <Alert type="warning" showIcon message={loadWarning} /> : null}

      {/* =========================
          SECTION 1: Prioritas Hari Ini
          Fungsi:
          - menampilkan action card paling penting saja;
          - seluruh action hanya Link navigasi, bukan write data.
          Status: aktif dipakai untuk Dashboard read-only; bukan legacy.
      ========================= */}
      <PageSection
        title="Prioritas Hari Ini"
        subtitle="Maksimal 5 hal yang perlu dicek lebih dulu agar operasional tidak putus."
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
        subtitle="Target produksi, status PO/Work Log, dan planning yang paling perlu dikejar."
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
            subtitle="Item kosong/menipis paling urgent. Maksimal 5 item agar tidak menjadi laporan stok penuh."
            extra={<Text className="dashboard-section-extra">{formatNumberId(lowStockTotal)} total</Text>}
          >
            {criticalStockPreview.length > 0 ? (
              <div className="dashboard-card-list">
                {criticalStockPreview.map((item) => (
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
                    </div>
                    <ArrowRightOutlined className="dashboard-action-arrow" />
                  </Link>
                ))}
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
            subtitle="Ringkasan bulan berjalan. Profit Loss tetap source final laporan laba/rugi."
          >
            <div className="dashboard-metric-grid">
              <div className="dashboard-metric-card">
                <Text className="dashboard-card-label">Pemasukan Diakui</Text>
                <Title level={4} className="dashboard-card-value">
                  {formatCurrency(financeSummary.recognizedIncome)}
                </Title>
                <Text className="dashboard-muted-text">Dari revenues + incomes bulan ini.</Text>
              </div>
              <div className="dashboard-metric-card">
                <Text className="dashboard-card-label">Pengeluaran</Text>
                <Title level={4} className="dashboard-card-value">
                  {formatCurrency(financeSummary.expenseThisMonth)}
                </Title>
                <Text className="dashboard-muted-text">Dari expenses bulan ini.</Text>
              </div>
              <div className="dashboard-metric-card">
                <Text className="dashboard-card-label">Selisih Ringkas</Text>
                <Title level={4} className="dashboard-card-value">
                  {formatCurrency(financeSummary.netOperational)}
                </Title>
                <Text className="dashboard-muted-text">Monitoring cepat, bukan laporan final.</Text>
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
                      ? `Payroll paid sudah punya ${formatNumberId(payrollSummary.payrollExpenseCount)} expense payroll. Bulan ini: ${formatCurrency(payrollSummary.payrollExpenseThisMonth)}. Jangan hitung payroll manual lagi di Profit Loss agar tidak dobel.`
                      : "Ada payroll paid, tetapi expense payroll belum terlihat. Cek Cash Out sebelum membaca Profit Loss."
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
        subtitle="Feed mutasi inventory terbaru untuk audit cepat, bukan laporan detail."
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
    </div>
  );
};

export default Dashboard;
