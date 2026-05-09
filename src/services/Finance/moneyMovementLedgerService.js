import {
  collection,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";

const DEFAULT_LEDGER_LIMIT = 500;
const MONEY_IN_COLLECTIONS = ["incomes", "revenues"];
const MONEY_OUT_COLLECTIONS = ["expenses"];

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

  if (!Number.isInteger(normalizedYear) || normalizedYear < 2000) {
    return null;
  }

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

const resolveIncomeLedgerSource = (sourceCollection, record = {}) => {
  if (sourceCollection === "incomes") {
    return {
      sourceModule: "sales",
      sourceLabel: "Penjualan Selesai",
      referenceCode: toSafeString(record.sourceRef || record.referenceNumber || record.relatedId || record.sourceId),
      status: toSafeString(record.status || "Selesai"),
    };
  }

  const sourceModule = toSafeString(record.sourceModule) || "cash_in_manual";

  if (sourceModule === "cash_in_manual") {
    return {
      sourceModule: "cash_in_manual",
      sourceLabel: "Cash In Manual",
      referenceCode: toSafeString(record.sourceRef || record.referenceNumber || record.relatedId || record.sourceId),
      status: toSafeString(record.status || "Tercatat"),
    };
  }

  return {
    sourceModule: "other",
    sourceLabel: sourceModule || "Pemasukan Lainnya",
    referenceCode: toSafeString(record.sourceRef || record.referenceNumber || record.relatedId || record.sourceId),
    status: toSafeString(record.status || "Tercatat"),
  };
};

const resolveExpenseLedgerSource = (record = {}) => {
  const rawSourceModule = toSafeString(record.sourceModule);
  const transactionType = toSafeString(record.type).toLowerCase();
  const inferredSourceModule = !rawSourceModule && transactionType.includes("pembelian")
    ? "purchases"
    : !rawSourceModule && transactionType.includes("payroll")
      ? "production_payroll"
      : rawSourceModule;
  const sourceModule = inferredSourceModule || "cash_out_manual";
  const sourceRef = toSafeString(
    record.sourceRef || record.referenceNumber || record.relatedPurchaseId || record.relatedId || record.sourceId,
  );

  if (sourceModule === "purchases") {
    return {
      sourceModule: "purchases",
      sourceLabel: "Pembelian",
      referenceCode: sourceRef,
      status: toSafeString(record.status || record.paymentStatus || "Tercatat"),
    };
  }

  if (sourceModule === "production_payroll") {
    return {
      sourceModule: "production_payroll",
      sourceLabel: "Payroll Produksi",
      referenceCode: sourceRef,
      status: toSafeString(record.status || record.paymentStatus || "Paid"),
    };
  }

  if (sourceModule === "cash_out_manual") {
    return {
      sourceModule: "cash_out_manual",
      sourceLabel: "Cash Out Manual",
      referenceCode: sourceRef,
      status: toSafeString(record.status || "Tercatat"),
    };
  }

  return {
    sourceModule: "other",
    sourceLabel: sourceModule || "Pengeluaran Lainnya",
    referenceCode: sourceRef,
    status: toSafeString(record.status || record.paymentStatus || "Tercatat"),
  };
};

export const normalizeMoneyMovementLedgerRow = ({ sourceCollection, documentId, record = {} }) => {
  const direction = MONEY_OUT_COLLECTIONS.includes(sourceCollection) ? "out" : "in";
  const sourceMeta = direction === "out"
    ? resolveExpenseLedgerSource(record)
    : resolveIncomeLedgerSource(sourceCollection, record);

  const amount = Math.round(toFiniteNumber(record.amount || record.totalAmount || 0));
  const date = record.date || record.createdAt || null;
  const description = toSafeString(record.description || record.note || record.notes || record.type);

  return {
    id: `${sourceCollection}-${documentId}`,
    sourceCollection,
    date,
    direction,
    sourceModule: sourceMeta.sourceModule,
    sourceLabel: sourceMeta.sourceLabel,
    referenceCode: sourceMeta.referenceCode,
    description,
    amount,
    status: sourceMeta.status,
    createdAt: record.createdAt || record.date || null,
    rawRecord: {
      id: documentId,
      ...record,
    },
  };
};

const buildLedgerQuery = (collectionName, { year, month, limit }) => {
  const periodRange = buildPeriodRange({ year, month });
  const queryConstraints = [];

  if (periodRange) {
    queryConstraints.push(where("date", ">=", Timestamp.fromDate(periodRange.startDate)));
    queryConstraints.push(where("date", "<", Timestamp.fromDate(periodRange.endDate)));
  }

  queryConstraints.push(orderBy("date", "desc"));
  queryConstraints.push(firestoreLimit(Math.max(1, Number(limit || DEFAULT_LEDGER_LIMIT))));

  return query(collection(db, collectionName), ...queryConstraints);
};

const readLedgerCollection = async (collectionName, params) => {
  const ledgerSnapshot = await getDocs(buildLedgerQuery(collectionName, params));

  return ledgerSnapshot.docs.map((documentItem) =>
    normalizeMoneyMovementLedgerRow({
      sourceCollection: collectionName,
      documentId: documentItem.id,
      record: documentItem.data(),
    }),
  );
};

const matchesDirection = (row, direction) => {
  if (!direction || direction === "all") return true;
  return row.direction === direction;
};

const matchesSource = (row, source) => {
  if (!source || source === "all") return true;

  if (source === "other") {
    return row.sourceModule === "other";
  }

  return row.sourceModule === source;
};

const matchesSearch = (row, search) => {
  const normalizedSearch = toSafeString(search).toLowerCase();
  if (!normalizedSearch) return true;

  const searchableText = [
    row.sourceCollection,
    row.direction,
    row.sourceModule,
    row.sourceLabel,
    row.referenceCode,
    row.description,
    row.status,
    row.rawRecord?.type,
    row.amount,
  ]
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(normalizedSearch);
};

// =====================================================
// SECTION: Buku Besar Kas read-only — AKTIF / GUARDED
// Fungsi:
// - membaca uang masuk dari incomes/revenues dan uang keluar dari expenses;
// - menormalisasi row audit tanpa membuat transaksi, posting kas, backfill, atau collection baru.
// Dipakai oleh:
// - src/pages/Finance/MoneyMovementLedger.jsx.
// Risiko:
// - Jangan menambahkan source sales/purchases/payroll/work_logs/inventory_logs ke nominal utama karena akan double count.
// =====================================================
export const getMoneyMovementLedger = async ({
  year,
  month = "all",
  direction = "all",
  source = "all",
  search = "",
  limit = DEFAULT_LEDGER_LIMIT,
} = {}) => {
  const normalizedLimit = Math.max(1, Number(limit || DEFAULT_LEDGER_LIMIT));

  const collectionNames = direction === "in"
    ? MONEY_IN_COLLECTIONS
    : direction === "out"
      ? MONEY_OUT_COLLECTIONS
      : [...MONEY_IN_COLLECTIONS, ...MONEY_OUT_COLLECTIONS];

  const ledgerRows = await Promise.all(
    collectionNames.map((collectionName) =>
      readLedgerCollection(collectionName, { year, month, limit: normalizedLimit }),
    ),
  );

  return ledgerRows
    .flat()
    .filter((row) => matchesDirection(row, direction))
    .filter((row) => matchesSource(row, source))
    .filter((row) => matchesSearch(row, search))
    .sort((left, right) => getTimestampMillis(right.date) - getTimestampMillis(left.date))
    .slice(0, normalizedLimit);
};

export const MONEY_MOVEMENT_LEDGER_DEFAULT_LIMIT = DEFAULT_LEDGER_LIMIT;
