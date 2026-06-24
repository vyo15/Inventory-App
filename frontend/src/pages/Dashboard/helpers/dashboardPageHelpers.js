import { formatCurrencyId } from '../../../utils/formatters/currencyId';
import { canAccessRoute, ROUTE_ACCESS_KEYS } from '../../../utils/auth/roleAccess';


export const filterDashboardQuickActionsByRole = (actions = [], role) =>
  actions.filter(({ routeKey }) => canAccessRoute(routeKey, role));

export const MAX_DASHBOARD_LIST_ITEMS = 5;
export const MAX_DASHBOARD_ALERT_ITEMS = 8;
export const MAX_PLANNING_PRIORITY_ITEMS = 3;

export const DASHBOARD_PRIORITY = Object.freeze({
  CRITICAL: Object.freeze({ label: 'P0', rank: 0, color: 'red' }),
  HIGH: Object.freeze({ label: 'P1', rank: 1, color: 'gold' }),
  NORMAL: Object.freeze({ label: 'P2', rank: 2, color: 'blue' }),
});

const STOCK_READ_MODEL_WARNING_KEYS = new Set([
  'stock_item_read_models_empty_fallback',
  'stock_item_read_models_issue_query_fallback',
  'stock_item_read_models_fallback',
  'stock_issues',
  'stock_read_models',
]);

export const formatDashboardLoadWarning = (failedReads = [], role) => {
  if (!Array.isArray(failedReads) || failedReads.length === 0) return '';

  const uniqueFailedReads = [...new Set(failedReads.filter(Boolean))];
  const hasStockReadModelFallback = uniqueFailedReads.some((key) =>
    STOCK_READ_MODEL_WARNING_KEYS.has(key));

  if (hasStockReadModelFallback) {
    const followUp = canAccessRoute(ROUTE_ACCESS_KEYS.RESET_MAINTENANCE, role)
      ? 'Jika peringatan berulang, buka Database Center lalu jalankan audit/perbaikan stok.'
      : 'Jika peringatan berulang, hubungi Administrator agar audit/perbaikan stok dapat dijalankan.';

    return [
      'Data stok lokal belum siap atau layanan lokal belum mengembalikan data stok lengkap.',
      'Dashboard tetap memakai data aman agar monitoring tidak kosong.',
      followUp,
    ].join(' ');
  }

  return [
    'Sebagian data Dashboard belum siap.',
    'Data lain tetap ditampilkan untuk monitoring; periksa layanan lokal, koneksi jaringan,',
    'atau status modul aplikasi bila peringatan berulang.',
  ].join(' ');
};

export const EMPTY_PLANNING_PERIOD_SUMMARY = {
  count: 0,
  targetQty: 0,
  actualCompletedQty: 0,
  remainingQty: 0,
  progressPercent: 0,
  priorityPlans: [],
};

export const EMPTY_PLANNING_SUMMARY = {
  weekly: EMPTY_PLANNING_PERIOD_SUMMARY,
  monthly: EMPTY_PLANNING_PERIOD_SUMMARY,
  overdueCount: 0,
  behindTargetCount: 0,
  priorityPlans: [],
};

export const getNumericValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export const sortDashboardAlertItems = (items = []) => [...items].sort((left, right) => {
  const rankDifference = getNumericValue(left?.priority?.rank) - getNumericValue(right?.priority?.rank);
  if (rankDifference !== 0) return rankDifference;

  const countDifference = getNumericValue(right?.count) - getNumericValue(left?.count);
  if (countDifference !== 0) return countDifference;

  return String(left?.label || '').localeCompare(String(right?.label || ''), 'id');
});

export const countDashboardAlertCategories = (items = []) =>
  items.filter((item) => getNumericValue(item?.count) > 0).length;

export const getTransactionDate = (record = {}) => {
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

    if (typeof candidate?.toDate === 'function') return candidate.toDate();
    if (candidate instanceof Date) return candidate;

    if (typeof candidate === 'string' || typeof candidate === 'number') {
      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return null;
};

export const isSameDay = (date, referenceDate = new Date()) => {
  if (!date) return false;
  return (
    date.getFullYear() === referenceDate.getFullYear() &&
    date.getMonth() === referenceDate.getMonth() &&
    date.getDate() === referenceDate.getDate()
  );
};

export const isSameMonth = (date, referenceDate = new Date()) => {
  if (!date) return false;
  return date.getFullYear() === referenceDate.getFullYear() && date.getMonth() === referenceDate.getMonth();
};

export const isSameWeek = (date, referenceDate = new Date()) => {
  if (!date) return false;

  const startOfWeek = new Date(referenceDate);
  const day = startOfWeek.getDay() || 7;
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - day + 1);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return date >= startOfWeek && date < endOfWeek;
};

export const getFinancialAmount = (record = {}) => {
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

export const formatCurrency = (value) => formatCurrencyId(Math.round(value || 0));

export const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

export const isCancelledStatus = (value) =>
  ['cancelled', 'canceled', 'cancel', 'dibatalkan', 'batal'].includes(normalizeStatus(value));

export const isCompletedStatus = (value) => ['completed', 'complete', 'selesai', 'done'].includes(normalizeStatus(value));

export const isPayrollPending = (record = {}) => {
  const paymentStatus = normalizeStatus(record.paymentStatus);
  const status = normalizeStatus(record.status);
  return paymentStatus === 'unpaid' || status === 'draft' || status === 'confirmed';
};

const startOfLocalDay = (value = new Date()) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

const getLocalDayKey = (value) => {
  const date = startOfLocalDay(value);
  if (!date) return '';
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const buildDailyBuckets = (days, referenceDate) => {
  const safeDays = Math.max(Math.floor(getNumericValue(days)), 1);
  const endDate = startOfLocalDay(referenceDate) || startOfLocalDay(new Date());
  const buckets = [];

  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(endDate);
    date.setDate(endDate.getDate() - offset);
    buckets.push({
      key: getLocalDayKey(date),
      date,
      label: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
      amount: 0,
      count: 0,
    });
  }

  return buckets;
};

export const buildSalesTrendSeries = (
  sales = [],
  { days = 30, referenceDate = new Date() } = {},
) => {
  const buckets = buildDailyBuckets(days, referenceDate);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  sales
    .filter((sale) => !isCancelledStatus(sale?.status))
    .forEach((sale) => {
      const saleDate = getTransactionDate(sale);
      const bucket = bucketMap.get(getLocalDayKey(saleDate));
      if (!bucket) return;

      bucket.amount += getFinancialAmount(sale);
      bucket.count += 1;
    });

  return buckets;
};

export const buildCashTrendSeries = (
  incomes = [],
  expenses = [],
  { days = 7, referenceDate = new Date() } = {},
) => {
  const buckets = buildDailyBuckets(days, referenceDate);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  incomes.forEach((income) => {
    const bucket = bucketMap.get(getLocalDayKey(getTransactionDate(income)));
    if (!bucket) return;
    bucket.amount += getFinancialAmount(income);
    bucket.count += 1;
  });

  expenses.forEach((expense) => {
    const bucket = bucketMap.get(getLocalDayKey(getTransactionDate(expense)));
    if (!bucket) return;
    bucket.amount -= getFinancialAmount(expense);
    bucket.count += 1;
  });

  return buckets;
};

export const buildTopSellingProducts = (
  sales = [],
  { limit = 5, referenceDate = new Date() } = {},
) => {
  const grouped = new Map();

  sales
    .filter((sale) => !isCancelledStatus(sale?.status))
    .filter((sale) => isSameMonth(getTransactionDate(sale), referenceDate))
    .forEach((sale) => {
      const items = Array.isArray(sale?.items) ? sale.items : [];

      items.forEach((item) => {
        const quantity = getNumericValue(item?.quantity ?? item?.qty);
        if (quantity <= 0) return;

        const name = String(
          item?.itemName
          || item?.productName
          || item?.materialName
          || item?.name
          || 'Item penjualan',
        ).trim();
        const variantLabel = String(item?.variantLabel || item?.variantName || '').trim();
        const displayName = variantLabel && !name.toLowerCase().includes(variantLabel.toLowerCase())
          ? `${name} · ${variantLabel}`
          : name;
        const unit = String(item?.unit || 'pcs').trim() || 'pcs';
        const sourceKey = item?.sourceId || item?.itemId || item?.id || name;
        const variantKey = item?.variantKey || item?.variantId || item?.variantName || 'master';
        const key = `${sourceKey}::${variantKey}::${unit}`;
        const itemRevenue = getNumericValue(
          item?.subtotal
          ?? item?.total
          ?? item?.totalAmount
          ?? quantity * getNumericValue(item?.pricePerUnit ?? item?.price),
        );
        const current = grouped.get(key) || {
          key,
          name: displayName,
          variantLabel,
          unit,
          quantity: 0,
          revenue: 0,
        };

        current.quantity += quantity;
        current.revenue += itemRevenue;
        grouped.set(key, current);
      });
    });

  const ranked = [...grouped.values()]
    .sort((left, right) => {
      const quantityDifference = right.quantity - left.quantity;
      if (quantityDifference !== 0) return quantityDifference;

      const revenueDifference = right.revenue - left.revenue;
      if (revenueDifference !== 0) return revenueDifference;

      return left.name.localeCompare(right.name, 'id');
    })
    .slice(0, Math.max(Math.floor(getNumericValue(limit)), 1));

  const maxQuantity = ranked.reduce(
    (maximum, item) => Math.max(maximum, getNumericValue(item.quantity)),
    0,
  );

  return ranked.map((item, index) => ({
    ...item,
    rank: index + 1,
    sharePercent: maxQuantity > 0
      ? Math.max(Math.round((item.quantity / maxQuantity) * 100), 2)
      : 0,
  }));
};

export const buildRestockRoute = (basePath, params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (String(value || '').trim()) {
      searchParams.set(key, String(value).trim());
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
};

// IMS NOTE [AKTIF] - Helper tampilan Dashboard tersentralisasi.
// Fungsi blok: menghindari duplikasi helper activity/planning/cost antara Dashboard.jsx dan helper file.
// Hubungan flow: hanya read-only display; tidak mengubah query, stok, produksi, payroll, HPP, atau report.
export const hasWorkLogCostIssue = (workLog = {}) => {
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

export const formatActivityType = (type) => {
  const normalized = String(type || '').toLowerCase();

  if (normalized.includes('purchase')) return { label: 'Pembelian', color: 'green' };
  if (normalized.includes('sale')) return { label: 'Penjualan', color: 'blue' };
  if (normalized.includes('return')) return { label: 'Retur', color: 'gold' };
  if (normalized.includes('adjust')) return { label: 'Penyesuaian', color: 'gold' };
  if (normalized.includes('production')) return { label: 'Produksi', color: 'blue' };
  if (normalized.includes('payroll')) return { label: 'Payroll', color: 'gold' };
  if (normalized.includes('stock')) return { label: 'Stok', color: 'blue' };
  if (normalized.includes('expense')) return { label: 'Kas Keluar', color: 'red' };
  if (normalized.includes('income')) return { label: 'Kas Masuk', color: 'green' };
  if (normalized.includes('in')) return { label: type || 'Masuk', color: 'green' };
  if (normalized.includes('out')) return { label: type || 'Keluar', color: 'red' };

  return { label: type || 'Aktivitas', color: 'default' };
};

export const getPlanningStatusMeta = (status) => {
  const normalized = normalizeStatus(status || 'active');

  if (normalized === 'completed') return { label: 'Selesai', color: 'green' };
  if (normalized === 'overdue') return { label: 'Overdue', color: 'red' };
  if (normalized === 'cancelled') return { label: 'Dibatalkan', color: 'default' };
  if (normalized === 'draft') return { label: 'Draft', color: 'blue' };
  if (normalized === 'behind') return { label: 'Di bawah target', color: 'gold' };

  return { label: 'Kurang Target', color: 'gold' };
};

export const getPlanningItemName = (plan = {}) =>
  plan.targetItemName ||
  plan.title ||
  plan.planCode ||
  plan.productName ||
  plan.targetName ||
  plan.outputName ||
  plan.bomName ||
  plan.name ||
  'Planning produksi';

export const formatDashboardDate = (value) => {
  const date = getTransactionDate({ date: value });
  if (!date) return '-';
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};
