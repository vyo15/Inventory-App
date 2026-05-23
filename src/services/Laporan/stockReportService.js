import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { buildStockReadModelRow } from "../../utils/stock/stockHelpers";

// =====================================================
// SECTION: Stock Report read service — AKTIF / READ-ONLY
// Fungsi:
// - memakai stock read model shared agar Dashboard dan Stock Report membaca comparator stok yang sama;
// - menjaga Stock Report tetap membaca raw materials, products, dan semi finished sebagai source stok final.
// Hubungan flow:
// - read-only; tidak menulis stok, inventory log, transaksi, produksi, atau schema.
// Risiko:
// - Jangan ubah comparator threshold/variant di service ini tanpa menyamakan Dashboard dan master stock pages.
// =====================================================
const mapInventorySnapshotToReportRows = (snapshot, typeLabel) =>
  snapshot.docs.map((documentItem) => buildStockReadModelRow(documentItem.data(), {
    id: documentItem.id,
    typeLabel,
  }));

const readStockReportSnapshot = async (key, requestPromise) => {
  try {
    return { key, snapshot: await requestPromise, error: null };
  } catch (error) {
    console.warn(`Gagal memuat data Stock Report: ${key}`, error);
    return { key, snapshot: null, error };
  }
};

// =====================================================
// SECTION: Stock Report data loader — AKTIF / READ-ONLY
// Fungsi:
// - membaca semua source stok yang diperlukan laporan/export;
// - mengisolasi error per collection agar satu read gagal tidak membuat seluruh laporan kosong.
// Hubungan flow:
// - tetap read-only dan tetap full source report; tidak membuat read model baru, tidak paging, dan tidak mengubah schema.
// Risiko:
// - Jika nanti dibuat read model/paging, export XLSX wajib tetap jelas apakah mengekspor semua data atau hanya data halaman aktif.
// =====================================================
export const fetchStockReportData = async () => {
  const stockReportReads = await Promise.all([
    readStockReportSnapshot("raw_materials", getDocs(collection(db, "raw_materials"))),
    readStockReportSnapshot("products", getDocs(collection(db, "products"))),
    readStockReportSnapshot("semi_finished_materials", getDocs(collection(db, "semi_finished_materials"))),
    readStockReportSnapshot("categories", getDocs(collection(db, "categories"))),
  ]);

  const dataByKey = stockReportReads.reduce((accumulator, item) => {
    accumulator[item.key] = item.snapshot;
    return accumulator;
  }, {});
  const failedReads = stockReportReads.filter((item) => item.error).map((item) => item.key);

  const rawMaterialsData = dataByKey.raw_materials
    ? mapInventorySnapshotToReportRows(dataByKey.raw_materials, "Bahan Baku")
    : [];
  const productsData = dataByKey.products
    ? mapInventorySnapshotToReportRows(dataByKey.products, "Produk Jadi")
    : [];
  const semiFinishedData = dataByKey.semi_finished_materials
    ? mapInventorySnapshotToReportRows(dataByKey.semi_finished_materials, "Semi Finished")
    : [];
  const categories = dataByKey.categories
    ? dataByKey.categories.docs.map((documentItem) => documentItem.data().name)
    : [];

  return {
    inventory: [...rawMaterialsData, ...productsData, ...semiFinishedData],
    categories,
    failedReads,
  };
};
