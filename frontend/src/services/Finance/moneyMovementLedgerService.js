import { resolveDisplayReference } from "../../utils/references/displayReferenceResolver";
import { listFinanceLedgerRows } from "./financeService";

const DEFAULT_LEDGER_LIMIT = 500;

const toFiniteNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const toSafeString = (value) => String(value || "").trim();

const getTimestampMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
};

const buildPeriodRange = ({ year, month }) => {
  const normalizedYear = Number(year);
  if (!Number.isInteger(normalizedYear) || normalizedYear < 2000) return null;
  if (month !== undefined && month !== null && month !== "all") {
    const normalizedMonth = Number(month);
    if (Number.isInteger(normalizedMonth) && normalizedMonth >= 0 && normalizedMonth <= 11) {
      return {
        startDate: new Date(normalizedYear, normalizedMonth, 1, 0, 0, 0, 0),
        endDate: new Date(normalizedYear, normalizedMonth + 1, 1, 0, 0, 0, 0),
      };
    }
  }
  return {
    startDate: new Date(normalizedYear, 0, 1, 0, 0, 0, 0),
    endDate: new Date(normalizedYear + 1, 0, 1, 0, 0, 0, 0),
  };
};

const resolveLedgerSource = (record = {}) => {
  const sourceModule = toSafeString(record.sourceModule || record.sourceType || record.rawRecord?.sourceModule);
  const sourceCollection = toSafeString(record.sourceCollection || record.rawRecord?.sourceCollection);
  if (sourceModule === "sales") return { sourceModule: "sales", sourceLabel: "Penjualan Selesai" };
  if (sourceModule === "purchases") return { sourceModule: "purchases", sourceLabel: "Pembelian" };
  if (sourceModule === "returns") return { sourceModule: "returns", sourceLabel: "Refund Retur" };
  if (sourceModule === "production_payroll") return { sourceModule: "production_payroll", sourceLabel: "Payroll Produksi" };
  if (sourceModule === "cash_in_manual" || sourceCollection === "incomes") return { sourceModule: "cash_in_manual", sourceLabel: "Cash In Manual" };
  if (sourceModule === "cash_out_manual" || sourceCollection === "expenses") return { sourceModule: "cash_out_manual", sourceLabel: "Cash Out Manual" };
  return { sourceModule: sourceModule || "other", sourceLabel: sourceModule || "Lainnya" };
};

export const normalizeMoneyMovementLedgerRow = ({ sourceCollection = "money_movement_ledger", documentId, record = {} }) => {
  const direction = record.direction === "out" || Number(record.credit || 0) > 0 ? "out" : "in";
  const sourceMeta = resolveLedgerSource({ ...record, sourceCollection });
  const amount = Math.round(toFiniteNumber(record.amount || record.totalAmount || record.debit || record.credit || 0));
  const date = record.date || record.transactionDate || record.createdAt || null;
  const description = toSafeString(record.description || record.note || record.notes || record.type || record.name);
  const referenceCode = resolveDisplayReference(
    { id: documentId, ...record, referenceCode: record.sourceRef || record.referenceNumber || record.code },
    { fallback: "-" },
  );

  return {
    id: `${sourceCollection}-${documentId}`,
    sourceCollection,
    date,
    direction,
    sourceModule: sourceMeta.sourceModule,
    sourceLabel: sourceMeta.sourceLabel,
    referenceCode,
    description,
    amount,
    status: toSafeString(record.status || "Tercatat"),
    createdAt: record.createdAt || record.date || null,
    rawRecord: { id: documentId, ...record },
  };
};

const matchesPeriod = (row, periodRange) => {
  if (!periodRange) return true;
  const time = getTimestampMillis(row.date);
  return time >= periodRange.startDate.getTime() && time < periodRange.endDate.getTime();
};

const matchesDirection = (row, direction) => !direction || direction === "all" || row.direction === direction;
const matchesSource = (row, source) => {
  if (!source || source === "all") return true;
  if (source === "other") return row.sourceModule === "other";
  return row.sourceModule === source;
};
const matchesSearch = (row, search) => {
  const normalizedSearch = toSafeString(search).toLowerCase();
  if (!normalizedSearch) return true;
  return [
    row.sourceCollection,
    row.direction,
    row.sourceModule,
    row.sourceLabel,
    row.referenceCode,
    row.description,
    row.status,
    row.rawRecord?.type,
    row.amount,
  ].filter((value) => value !== undefined && value !== null).join(" ").toLowerCase().includes(normalizedSearch);
};

export const getMoneyMovementLedger = async ({
  year,
  month = "all",
  direction = "all",
  source = "all",
  search = "",
  limit = DEFAULT_LEDGER_LIMIT,
} = {}) => {
  const normalizedLimit = Math.max(1, Number(limit || DEFAULT_LEDGER_LIMIT));
  const periodRange = buildPeriodRange({ year, month });
  const ledgerRows = await listFinanceLedgerRows({ limit: Math.max(normalizedLimit, DEFAULT_LEDGER_LIMIT) });

  return ledgerRows
    .map((record) => normalizeMoneyMovementLedgerRow({ sourceCollection: "money_movement_ledger", documentId: record.id, record }))
    .filter((row) => matchesPeriod(row, periodRange))
    .filter((row) => matchesDirection(row, direction))
    .filter((row) => matchesSource(row, source))
    .filter((row) => matchesSearch(row, search))
    .sort((left, right) => getTimestampMillis(right.date) - getTimestampMillis(left.date))
    .slice(0, normalizedLimit);
};

export const MONEY_MOVEMENT_LEDGER_DEFAULT_LIMIT = DEFAULT_LEDGER_LIMIT;
