import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
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
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
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
const MAX_DASHBOARD_ALERT_ITEMS = 6;
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

const isSameDay = (date, referenceDate = new Date()) => {
  if (!date) return false;
  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth() &&
    date.getDate() === referenceDate.getDate()
  );
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

const isCancelledStatus = (value) =>
  ["cancelled", "canceled", "cancel", "dibatalkan", "batal"].includes(normalizeStatus(value));

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

/* =====================================================
SECTION: Dashboard Low Stock Master Threshold — AKTIF
Fungsi:
- Menyusun list Stok Kritis read-only dari Product, Raw Material, dan Semi Finished memakai threshold master masing-masing.

Dipakai oleh:
- Widget Stok Kritis Dashboard dan Restock Assistant khusus bahan baku.

Alasan perubahan:
- Dashboard harus konsisten dengan master page/Stock Report: `availableStock ?? currentStock ?? stock ?? 0` dibandingkan dengan `minStockAlert ?? minStock`, tanpa membaca `variants[].minStockAlert`.

Catatan cleanup:
- Fallback `currentStock`/`stock` bisa diaudit setelah semua collection punya `availableStock` final.

Risiko:
- Jika Semi Finished diberi action restock/purchase otomatis atau threshold varian dipakai lagi, Dashboard berubah dari monitoring read-only menjadi flow transaksi yang tidak disetujui.
===================================================== */
const getItemDisplayName = (item = {}) =>
  item?.name || item?.productName || item?.materialName || "-";

const getItemStock = (item = {}) =>
  getNumericValue(item?.availableStock ?? item?.currentStock ?? item?.stock ?? 0);

const getItemMinStock = (item = {}) =>
  getNumericValue(item?.minStockAlert ?? item?.minStock ?? 0);

const getItemCurrentStock = (item = {}) =>
  getNumericValue(item?.currentStock ?? item?.stock ?? 0);

const getItemReservedStock = (item = {}) =>
  getNumericValue(item?.reservedStock ?? 0);

const getLowStockSeverity = (item = {}) => {
  const stock = getItemStock(item);
  const minStock = getItemMinStock(item);

  if (stock <= 0) return { label: "Kosong", color: "red" };
  if (minStock > 0 && stock <= minStock) return { label: "Menipis", color: "gold" };
  return { label: "Aman", color: "green" };
};

const buildLowStockRows = (products = [], materials = [], semiFinishedMaterials = []) => {
  const rows = [
    ...products.map((item) => ({
      key: `product-${item.id}`,
      id: item.id,
      name: getItemDisplayName(item),
      stock: getItemStock(item),
      minStock: getItemMinStock(item),
      unit: item?.unit || "pcs",
      type: "Produk Jadi",
      sourceType: "product",
      severity: getLowStockSeverity(item),
      to: "/stock-management",
      snapshot: item,
    })),
    ...materials.map((item) => ({
      key: `material-${item.id}`,
      id: item.id,
      name: getItemDisplayName(item),
      stock: getItemStock(item),
      minStock: getItemMinStock(item),
      unit: item?.stockUnit || item?.unit || "pcs",
      type: "Bahan Baku",
      sourceType: "material",
      severity: getLowStockSeverity(item),
      to: "/stock-management",
      snapshot: item,
    })),
    ...semiFinishedMaterials.map((item) => ({
      key: `semi-finished-${item.id}`,
      id: item.id,
      name: getItemDisplayName(item),
      stock: getItemStock(item),
      minStock: getItemMinStock(item),
      unit: item?.unit || "pcs",
      type: "Semi Finished",
      sourceType: "semi_finished",
      severity: getLowStockSeverity(item),
      to: "/produksi/semi-finished-materials",
      snapshot: item,
    })),
  ].filter((item) => item.stock <= 0 || (item.minStock > 0 && item.stock <= item.minStock));

  return rows.sort((left, right) => {
    const leftGap = left.stock - Math.max(left.minStock, 0);
    const rightGap = right.stock - Math.max(right.minStock, 0);
    return leftGap - rightGap;
  });
};

/* =====================================================
SECTION: Dashboard Business Alert Stock Audit — AKTIF
Fungsi:
- Menyusun audit stok read-only untuk stok minus dan reserved stock tidak wajar tanpa mengubah stok.

Dipakai oleh:
- KPI Data Perlu Dicek dan section Data Perlu Dicek pada Dashboard.

Alasan perubahan:
- Owner perlu melihat exception ERP lintas menu tanpa membuka Stock Management satu per satu.

Catatan cleanup:
- Validasi reserved stock bisa dipindah ke helper/service read model jika schema stok sudah stabil penuh.

Risiko:
- Jika audit ini dijadikan mutasi otomatis, stok fisik/reserved bisa rusak dan report tidak sinkron.
===================================================== */
const buildStockAuditRows = (products = [], materials = [], semiFinishedMaterials = []) => {
  const mapRows = (items = [], type = "Item", sourceType = "item", to = "/stock-management") =>
    items.map((item) => {
      const stock = getItemStock(item);
      const currentStock = getItemCurrentStock(item);
      const reservedStock = getItemReservedStock(item);
      const minStock = getItemMinStock(item);

      return {
        key: `${sourceType}-${item.id}`,
        id: item.id,
        name: getItemDisplayName(item),
        type,
        sourceType,
        unit: item?.stockUnit || item?.unit || "pcs",
        stock,
        currentStock,
        reservedStock,
        minStock,
        to,
        isNegativeStock: stock < 0 || currentStock < 0,
        isReservedOverrun: reservedStock > 0 && (reservedStock > Math.max(currentStock, 0) || stock < 0),
      };
    });

  return [
    ...mapRows(products, "Produk Jadi", "product", "/stock-management"),
    ...mapRows(materials, "Bahan Baku", "material", "/stock-management"),
    ...mapRows(semiFinishedMaterials, "Semi Finished", "semi_finished", "/produksi/semi-finished-materials"),
  ].filter((item) => item.isNegativeStock || item.isReservedOverrun);
};

// =========================
// SECTION: Helpers - Restock Assistant
// Fungsi:
// - membaca purchase terakhir untuk bahan baku stok kritis secara null-safe;
// - menyediakan supplier terakhir, harga terakhir, dan link produk terakhir untuk action Dashboard.
// Hubungan flow:
// - Dashboard hanya membaca purchases/raw_materials dan menyiapkan navigasi/prefill;
// - tidak membuat purchase otomatis, tidak mengubah stok, kas, supplier, atau laporan.
// Status:
// - aktif dipakai oleh section Stok Kritis; bukan legacy.
// =========================
const getRestockLink = (...values) => {
  const validValue = values.find((value) => String(value || "").trim());
  return validValue ? String(validValue).trim() : "";
};

const getLatestPurchaseForMaterial = (purchases = [], materialId = "") => {
  const targetId = String(materialId || "").trim();
  if (!targetId || !Array.isArray(purchases)) return null;

  return purchases
    .filter((purchase) => (
      normalizeStatus(purchase?.type) === "material" &&
      String(purchase?.itemId || "").trim() === targetId
    ))
    .sort((left, right) => {
      const rightDate = getTransactionDate(right)?.getTime() || 0;
      const leftDate = getTransactionDate(left)?.getTime() || 0;
      return rightDate - leftDate;
    })[0] || null;
};

const getPurchaseProductLink = (purchase = null) => {
  if (!purchase || typeof purchase !== "object") return "";

  return getRestockLink(
    purchase?.productLink,
    purchase?.purchaseProductLink,
    purchase?.restockProductLink,
  );
};

const getPurchaseLastUnitPrice = (purchase = null) => {
  if (!purchase || typeof purchase !== "object") return 0;

  return getNumericValue(
    purchase?.actualUnitCost ??
      purchase?.unitCost ??
      purchase?.lastPurchasePrice ??
      purchase?.restockReferencePrice ??
      0,
  );
};

const buildRestockAssistantRows = (lowStockRows = [], purchases = []) => (
  lowStockRows.map((item) => {
    if (item.sourceType !== "material") return item;

    const latestPurchase = getLatestPurchaseForMaterial(purchases, item.id);
    const supplierId = String(
      latestPurchase?.supplierId ||
        latestPurchase?.supplierRefId ||
        latestPurchase?.supplierReferenceId ||
        item.snapshot?.supplierId ||
        "",
    ).trim();
    const supplierName = String(
      latestPurchase?.supplierName ||
        latestPurchase?.supplierLabel ||
        latestPurchase?.supplierStoreName ||
        item.snapshot?.supplierName ||
        "",
    ).trim();
    const productLink = getPurchaseProductLink(latestPurchase);

    return {
      ...item,
      latestPurchase,
      restockSupplierId: supplierId,
      restockSupplierName: supplierName,
      restockProductLink: productLink,
      lastPurchasePrice: getPurchaseLastUnitPrice(latestPurchase),
    };
  })
);

const buildRestockRoute = (basePath, params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (String(value || "").trim()) {
      searchParams.set(key, String(value).trim());
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
};

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
    description: "Buka laporan stok final read-only.",
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

// =========================
// SECTION: AKTIF + GUARDED - targeted purchase lookup Dashboard
// Fungsi:
// - mengambil histori purchases hanya untuk bahan baku stok kritis yang tampil di Restock Assistant;
// - mengganti full read collection purchases agar Dashboard lebih ringan saat data real mulai banyak.
// Hubungan flow:
// - Dashboard tetap read-only; data ini hanya untuk supplier/link/harga terakhir sebagai bantuan navigasi;
// - tidak membuat purchase otomatis, tidak mengubah stok, kas, supplier, laporan, atau expense.
// Status:
// - AKTIF dipakai oleh loadDashboardData.
// - GUARDED karena hanya membaca itemId dari baris stok kritis yang sudah terpilih.
// - LEGACY: purchase lama yang belum menyimpan itemId standar bisa tidak ikut lookup ringan ini.
// - CLEANUP CANDIDATE jika nanti dibuat read model/latest purchase service khusus Dashboard.
// =========================
const fetchPurchaseRecordsForRestockRows = async (lowStockRows = []) => {
  const materialIds = [...new Set(
    lowStockRows
      .filter((item) => item.sourceType === "material")
      .map((item) => String(item.id || "").trim())
      .filter(Boolean),
  )].slice(0, MAX_DASHBOARD_LIST_ITEMS);

  if (!materialIds.length) return [];

  const purchaseRecordsQuery = query(
    collection(db, "purchases"),
    where("itemId", "in", materialIds),
  );

  const purchaseRecordsSnapshot = await getDocs(purchaseRecordsQuery);

  return purchaseRecordsSnapshot.docs.map((docItem) => ({
    id: docItem.id,
    ...docItem.data(),
  }));
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

const mapSnapshotDocs = (snapshot) => snapshot.docs.map((docItem) => ({
  id: docItem.id,
  ...docItem.data(),
}));

const readDashboardSnapshot = async (key, requestPromise) => {
  try {
    return { key, data: mapSnapshotDocs(await requestPromise), error: null };
  } catch (error) {
    console.warn(`Gagal memuat data Dashboard: ${key}`, error);
    return { key, data: [], error };
  }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadWarning, setLoadWarning] = useState("");
  const [dashboardData, setDashboardData] = useState({
    lowStockRows: [],
    purchaseRecords: [],
    recentActivities: [],
    productionOrders: [],
    workLogs: [],
    payrolls: [],
    expenses: [],
    incomes: [],
    revenues: [],
    sales: [],
    stockAuditRows: [],
    planningSummary: EMPTY_PLANNING_SUMMARY,
  });

  // =========================
  // SECTION: Load Dashboard data
  // Fungsi:
  // - mengambil snapshot read-only untuk Dashboard control center compact;
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

      const dashboardReads = await Promise.all([
        readDashboardSnapshot("products", getDocs(collection(db, "products"))),
        readDashboardSnapshot("raw_materials", getDocs(collection(db, "raw_materials"))),
        readDashboardSnapshot("semi_finished_materials", getDocs(collection(db, "semi_finished_materials"))),
        readDashboardSnapshot("inventory_logs", getDocs(recentActivitiesQuery)),
        readDashboardSnapshot("production_orders", getDocs(collection(db, "production_orders"))),
        readDashboardSnapshot("production_work_logs", getDocs(collection(db, "production_work_logs"))),
        readDashboardSnapshot("production_payrolls", getDocs(collection(db, "production_payrolls"))),
        readDashboardSnapshot("expenses", getDocs(collection(db, "expenses"))),
        readDashboardSnapshot("incomes", getDocs(collection(db, "incomes"))),
        readDashboardSnapshot("revenues", getDocs(collection(db, "revenues"))),
        readDashboardSnapshot("sales", getDocs(collection(db, "sales"))),
      ]);

      const dataByKey = dashboardReads.reduce((accumulator, item) => {
        accumulator[item.key] = item.data;
        return accumulator;
      }, {});

      const failedReads = dashboardReads.filter((item) => item.error).map((item) => item.key);

      const planningSummary = await getProductionPlanningDashboardSummary().catch((error) => {
        console.warn("Gagal memuat summary production planning:", error);
        failedReads.push("production_planning_summary");
        return EMPTY_PLANNING_SUMMARY;
      });

      const products = dataByKey.products || [];
      const materials = dataByKey.raw_materials || [];
      const semiFinishedMaterials = dataByKey.semi_finished_materials || [];
      const lowStockRows = buildLowStockRows(products, materials, semiFinishedMaterials);
      const stockAuditRows = buildStockAuditRows(products, materials, semiFinishedMaterials);

      let purchaseRecords = [];
      try {
        purchaseRecords = await fetchPurchaseRecordsForRestockRows(
          lowStockRows.slice(0, MAX_DASHBOARD_LIST_ITEMS),
        );
      } catch (error) {
        console.warn("Gagal memuat lookup purchase Restock Assistant:", error);
        failedReads.push("purchases_restock_lookup");
      }

      setDashboardData({
        lowStockRows,
        purchaseRecords,
        stockAuditRows,
        recentActivities: dataByKey.inventory_logs || [],
        productionOrders: dataByKey.production_orders || [],
        workLogs: dataByKey.production_work_logs || [],
        payrolls: dataByKey.production_payrolls || [],
        expenses: dataByKey.expenses || [],
        incomes: (dataByKey.incomes || []).map((item) => ({
          ...item,
          sourceCollection: "incomes",
        })),
        revenues: (dataByKey.revenues || []).map((item) => ({
          ...item,
          sourceCollection: "revenues",
        })),
        sales: dataByKey.sales || [],
        planningSummary: normalizePlanningDashboardSummary(planningSummary),
      });

      if (failedReads.length > 0) {
        setLoadWarning(`Sebagian data Dashboard gagal dimuat: ${failedReads.join(", ")}. Data lain tetap ditampilkan sebagai monitoring read-only.`);
      }

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
    purchaseRecords,
    recentActivities,
    productionOrders,
    workLogs,
    payrolls,
    expenses,
    incomes,
    revenues,
    sales,
    stockAuditRows,
    planningSummary,
  } = dashboardData;

  const lowStockTotal = lowStockRows.length;
  const quickActions = useMemo(() => buildDashboardQuickActions(), []);

  // =========================
  // SECTION: Restock Assistant - stok kritis
  // Fungsi:
  // - memperkaya item stok menipis dengan purchase terakhir untuk tombol restock cepat;
  // - action hanya navigasi/prefill atau membuka link eksternal.
  // Hubungan flow:
  // - Dashboard tetap read-only; stok/kas hanya berubah setelah user menyimpan transaksi di Purchases.
  // Status:
  // - aktif dipakai oleh section Stok Kritis; bukan legacy dan bukan auto-purchase.
  // =========================
  const criticalStockPreview = useMemo(
    () => buildRestockAssistantRows(
      lowStockRows.slice(0, MAX_DASHBOARD_LIST_ITEMS),
      purchaseRecords,
    ),
    [lowStockRows, purchaseRecords],
  );
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

  Dipakai oleh:
  - Section Ringkasan Hari Ini pada Dashboard.

  Alasan perubahan:
  - Dashboard perlu memberi gambaran bisnis sekali lihat, tetapi tetap bukan laporan final.

  Catatan cleanup:
  - Sales dan cash masih dibaca dari collection operasional existing; standardisasi read model bisa menjadi task terpisah jika data membesar.

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
    },
    {
      key: "stock-critical",
      label: "Stok Kritis",
      value: formatNumberId(lowStockTotal),
      detail: "produk, bahan, semi finished",
      tone: lowStockTotal > 0 ? "warning" : "success",
    },
    {
      key: "production-watch",
      label: "Produksi Dicek",
      value: formatNumberId(productionSummary.shortageOrders + planningSummary.overdueCount + planningSummary.behindTargetCount),
      detail: "shortage/overdue/behind target",
      tone: productionSummary.shortageOrders + planningSummary.overdueCount > 0 ? "danger" : "primary",
    },
    {
      key: "payroll-pending",
      label: "Payroll Pending",
      value: formatNumberId(payrollSummary.pendingCount),
      detail: formatCurrency(payrollSummary.pendingAmount),
      tone: payrollSummary.pendingCount > 0 ? "warning" : "success",
    },
    {
      key: "data-watch",
      label: "Data Perlu Dicek",
      value: formatNumberId(businessAlertTotal),
      detail: "exception lintas modul",
      tone: businessAlertTotal > 0 ? "warning" : "success",
    },
  ], [
    businessAlertTotal,
    financeSummary.expenseThisMonth,
    financeSummary.netOperational,
    financeSummary.recognizedIncome,
    lowStockTotal,
    payrollSummary.pendingAmount,
    payrollSummary.pendingCount,
    planningSummary.behindTargetCount,
    planningSummary.overdueCount,
    productionSummary.shortageOrders,
    salesSummary.monthAmount,
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

  // =========================
  // SECTION: Restock Assistant Actions
  // Fungsi:
  // - membuka link produk terakhir, prefill halaman Purchases, dan membuka Supplier terfilter;
  // - semua action aman untuk HashRouter karena route internal memakai useNavigate.
  // Hubungan flow:
  // - action Dashboard hanya navigasi/prefill, tidak menulis Firestore dan tidak membuat transaksi otomatis.
  // Status:
  // - aktif dipakai oleh Stok Kritis; bukan kandidat cleanup selama Restock Assistant aktif.
  // =========================
  const openRestockProductLink = (productLink) => {
    if (!productLink) return;
    window.open(productLink, "_blank", "noopener,noreferrer");
  };

  const goToRestockPurchase = (item) => {
    navigate(buildRestockRoute("/purchases", {
      materialId: item.id,
      supplierId: item.restockSupplierId,
      productLink: item.restockProductLink,
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
        subtitle="Pusat kontrol harian yang ringkas, read-only, dan tidak mengubah stok, kas, produksi, payroll, HPP, atau laporan."
        extra={
          <Space size={10} wrap>
            <Text className="dashboard-section-extra">Terakhir diperbarui: {lastUpdatedText}</Text>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={loading}
              onClick={loadDashboardData}
            >
              Muat Ulang
            </Button>
          </Space>
        }
      />

      {loadWarning ? <Alert type="warning" showIcon message={loadWarning} /> : null}

      {/* =====================================================
          SECTION: Ringkasan Hari Ini — AKTIF
          Fungsi:
          - Menampilkan KPI compact sales, kas, stok, produksi, payroll, dan data perlu dicek.

          Dipakai oleh:
          - Dashboard control center.

          Alasan perubahan:
          - Owner perlu membaca kondisi bisnis utama dalam sekali lihat tanpa membuka report penuh.

          Catatan cleanup:
          - Sales dan cash dapat dipindahkan ke read model jika volume data makin besar.

          Risiko:
          - Jika KPI dianggap laporan final, angka bisa disalahartikan karena Dashboard hanya monitoring read-only.
      ===================================================== */}
      <PageSection
        title="Ringkasan Hari Ini"
        subtitle="KPI compact lintas sales, kas, stok, dan produksi. Profit Loss tetap laporan final."
      >
        <div className="dashboard-kpi-grid">
          {kpiItems.map((item) => (
            <div key={item.key} className={`dashboard-kpi-card dashboard-kpi-card-${item.tone}`}>
              <Text className="dashboard-card-label">{item.label}</Text>
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
        subtitle="Shortcut navigasi saja. Tidak ada transaksi, mutasi stok, kas, produksi, atau payroll yang dibuat dari Dashboard."
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
        subtitle="Exception paling penting dari stok, produksi, HPP, dan payroll. Maksimal ringkas agar tidak menjadi laporan penuh."
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
                            disabled={!item.restockProductLink}
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
