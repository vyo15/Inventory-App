import {
  PAYROLL_CLASSIFICATION_MAP,
  PAYROLL_MODE_MAP,
  PAYROLL_STATUS_MAP,
} from "../../../constants/productionPayrollOptions";
import { formatCurrencyId } from "../../../utils/formatters/currencyId";
import { formatDateId } from "../../../utils/formatters/dateId";
import { formatNumberId } from "../../../utils/formatters/numberId";
import { resolveDisplayReference } from "../../../utils/references/displayReferenceResolver";

export const createEmptyPayrollStatusTally = () => ({
  totalDraft: 0,
  totalConfirmed: 0,
  totalPaid: 0,
  totalCancelled: 0,
  totalNominal: 0,
});

export const tallyPayrollStatus = (items = []) => (Array.isArray(items) ? items : []).reduce(
  (totals, item = {}) => {
    const amount = Number(item.finalAmount || 0);
    if (item.status === "draft") totals.totalDraft += 1;
    if (item.status === "confirmed") totals.totalConfirmed += 1;
    if (item.status === "paid") totals.totalPaid += 1;
    if (item.status === "cancelled") totals.totalCancelled += 1;
    if (item.status !== "cancelled") totals.totalNominal += amount;
    return totals;
  },
  createEmptyPayrollStatusTally(),
);


export const PAYROLL_DETAIL_CSV_HEADERS = Object.freeze([
  "No. Payroll",
  "Tanggal Payroll",
  "Work Log",
  "Operator",
  "Step",
  "Mode",
  "Worked Qty",
  "Output Qty",
  "Nominal",
  "Status",
  "Klasifikasi",
  "Masuk HPP",
  "Confirmed At",
  "Paid At",
  "Cash Out Ref",
  "Expense Sync",
]);

export const normalizePayrollDetailExportRecord = (item = {}) => ({
  payrollNumber: item.payrollNumber || "-",
  payrollDate: formatDateId(item.payrollDate, true),
  workLog: item.workNumber || "-",
  operator: item.workerName || "-",
  step: item.stepName || "-",
  mode: PAYROLL_MODE_MAP[item.payrollMode] || item.payrollMode || "-",
  workedQty: Number(item.workedQty || 0),
  outputQty: Number(item.outputQtyUsed || 0),
  amount: Number(item.finalAmount || 0),
  status: PAYROLL_STATUS_MAP[item.status] || item.status || "-",
  classification:
    PAYROLL_CLASSIFICATION_MAP[item.payrollClassification]
    || item.payrollClassification
    || "-",
  includeInHpp: item.includePayrollInHpp === false ? "Tidak" : "Ya",
  confirmedAt: formatDateId(item.confirmedAt, true),
  paidAt: formatDateId(item.paidAt, true),
  cashOutReference: resolveDisplayReference(
    {
      cashOutNumber: item.cashOutNumber,
      referenceNumber: item.expenseReferenceNumber,
      sourceRef: item.expenseSourceRef,
      expenseId: item.expenseId,
    },
    { fallback: item.expenseId || "-", allowTechnicalId: true },
  ),
  expenseSync: item.expenseSyncStatus || "-",
});

export const buildPayrollDetailExcelRow = (item = {}) => {
  const record = normalizePayrollDetailExportRecord(item);

  return {
    "No. Payroll": record.payrollNumber,
    "Tanggal Payroll": record.payrollDate,
    "Work Log": record.workLog,
    Operator: record.operator,
    Step: record.step,
    Mode: record.mode,
    "Worked Qty": formatNumberId(record.workedQty),
    "Output Qty": formatNumberId(record.outputQty),
    Nominal: formatCurrencyId(record.amount),
    Status: record.status,
    Klasifikasi: record.classification,
    "Masuk HPP": record.includeInHpp,
    "Confirmed At": record.confirmedAt,
    "Paid At": record.paidAt,
    "Cash Out Ref": record.cashOutReference,
    "Expense Sync": record.expenseSync,
  };
};

export const buildPayrollDetailCsvRow = (item = {}) => {
  const record = normalizePayrollDetailExportRecord(item);

  return [
    record.payrollNumber,
    record.payrollDate,
    record.workLog,
    record.operator,
    record.step,
    record.mode,
    record.workedQty,
    record.outputQty,
    record.amount,
    record.status,
    record.classification,
    record.includeInHpp,
    record.confirmedAt,
    record.paidAt,
    record.cashOutReference,
    record.expenseSync,
  ];
};
