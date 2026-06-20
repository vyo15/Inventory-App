import { formatCurrencyId } from '../../../utils/formatters/currencyId';
import { canAccessRoute } from '../../../utils/auth/roleAccess';


export const filterDashboardQuickActionsByRole = (actions = [], role) =>
  actions.filter(({ routeKey }) => canAccessRoute(routeKey, role));

export const MAX_DASHBOARD_LIST_ITEMS = 5;
export const MAX_DASHBOARD_ALERT_ITEMS = 6;
export const MAX_PLANNING_PRIORITY_ITEMS = 3;

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

export const isPayrollPaid = (record = {}) => {
  const paymentStatus = normalizeStatus(record.paymentStatus);
  const status = normalizeStatus(record.status);
  return paymentStatus === 'paid' || status === 'paid';
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
  if (normalized.includes('return')) return { label: 'Retur', color: 'orange' };
  if (normalized.includes('adjust')) return { label: 'Penyesuaian', color: 'gold' };
  if (normalized.includes('production')) return { label: 'Produksi', color: 'purple' };
  if (normalized.includes('payroll')) return { label: 'Payroll', color: 'cyan' };
  if (normalized.includes('stock')) return { label: 'Stok', color: 'geekblue' };
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
