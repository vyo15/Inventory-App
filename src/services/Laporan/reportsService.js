import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../../firebase";

// =====================================================
// SECTION: Report read service — AKTIF / READ-ONLY
// Fungsi:
// - memusatkan query laporan transaksi/finance agar page tidak lagi orchestration Firestore langsung;
// - menjaga filter periode server-side tetap menjadi standar read path laporan besar.
// Hubungan flow:
// - hanya membaca sales, expenses, revenues, dan incomes;
// - tidak mengubah transaksi, stok, kas, expense, income, revenue, schema, route, atau role guard.
// Risiko:
// - Jangan ubah sumber truth laporan di service ini tanpa audit business rule dan report regression test.
// =====================================================
const mapSnapshotDocs = (snapshot) =>
  snapshot.docs.map((documentItem) => ({
    id: documentItem.id,
    ...documentItem.data(),
  }));

const buildDateRangeConstraints = (fieldName = "date", dateRangeBounds = null) => {
  if (!dateRangeBounds) return [];

  return [
    where(fieldName, ">=", dateRangeBounds.startTimestamp),
    where(fieldName, "<", dateRangeBounds.endTimestampExclusive),
  ];
};

const buildDateRangeQuery = (collectionName, dateRangeBounds = null, fieldName = "date") =>
  query(
    collection(db, collectionName),
    ...buildDateRangeConstraints(fieldName, dateRangeBounds),
    orderBy(fieldName, "desc"),
  );

export const fetchSalesReportData = async ({ dateRangeBounds = null } = {}) => {
  const querySnapshot = await getDocs(buildDateRangeQuery("sales", dateRangeBounds));
  return mapSnapshotDocs(querySnapshot);
};

export const fetchPurchasesReportData = async ({ dateRangeBounds = null } = {}) => {
  const querySnapshot = await getDocs(buildDateRangeQuery("expenses", dateRangeBounds));

  return mapSnapshotDocs(querySnapshot).filter(
    (item) => item.sourceModule === "purchases" || item.type === "Pembelian Bahan/Barang",
  );
};

export const fetchProfitLossReportData = async ({ dateRangeBounds = null } = {}) => {
  const buildFinancialQuery = (collectionName) => buildDateRangeQuery(collectionName, dateRangeBounds);

  const [revenuesSnap, incomesSnap, expensesSnap] = await Promise.all([
    getDocs(buildFinancialQuery("revenues")),
    getDocs(buildFinancialQuery("incomes")),
    getDocs(buildFinancialQuery("expenses")),
  ]);

  const revenues = revenuesSnap.docs.map((documentItem) => ({
    id: `revenues-${documentItem.id}`,
    sourceCollection: "revenues",
    ...documentItem.data(),
    flow: "Pemasukan",
  }));

  const incomes = incomesSnap.docs.map((documentItem) => ({
    id: `incomes-${documentItem.id}`,
    sourceCollection: "incomes",
    ...documentItem.data(),
    flow: "Pemasukan",
  }));

  const expenses = expensesSnap.docs.map((documentItem) => ({
    id: `expenses-${documentItem.id}`,
    sourceCollection: "expenses",
    ...documentItem.data(),
    flow: "Pengeluaran",
  }));

  return [...revenues, ...incomes, ...expenses].sort((left, right) => {
    const leftTime = left.date?.toDate ? left.date.toDate().getTime() : 0;
    const rightTime = right.date?.toDate ? right.date.toDate().getTime() : 0;
    return rightTime - leftTime;
  });
};
