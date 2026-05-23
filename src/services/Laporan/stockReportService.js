import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import {
  formatAffectedVariantStockSummary,
  getVariantAwareStockStatusMeta,
} from "../../utils/stock/stockHelpers";

// =====================================================
// SECTION: Stock Report read service — AKTIF / READ-ONLY
// Fungsi:
// - memusatkan fetch dan mapper laporan stok agar page hanya mengelola filter/render/export;
// - menjaga Stock Report tetap membaca raw materials, products, dan semi finished sebagai source stok final.
// Hubungan flow:
// - read-only; tidak menulis stok, inventory log, transaksi, produksi, atau schema.
// Risiko:
// - Jangan ubah comparator threshold/variant di service ini tanpa menyamakan Dashboard dan master stock pages.
// =====================================================
const resolveDisplayStock = (item = {}) =>
  Number(item.availableStock ?? item.currentStock ?? item.stock ?? 0);

const resolveDisplayUnit = (item = {}) => item.unit || item.stockUnit || "pcs";

const resolveMasterThreshold = (item = {}, typeLabel = "") => {
  const thresholdSource = typeLabel === "Bahan Baku" ? item.minStock : item.minStockAlert;
  const threshold = Number(thresholdSource ?? 0);
  return Number.isFinite(threshold) && threshold > 0 ? threshold : 0;
};

const resolveSourceType = (typeLabel = "") => {
  if (typeLabel === "Bahan Baku") return "material";
  if (typeLabel === "Semi Finished") return "semi_finished";
  return "product";
};

const resolveStatus = (stockValue, thresholdValue, item = {}, sourceType = "") => {
  const variantStatusMeta = getVariantAwareStockStatusMeta(item, {
    sourceType,
    threshold: thresholdValue,
  });

  if (variantStatusMeta?.label === "Kosong") return "Habis";
  if (variantStatusMeta?.label === "Stok Rendah") return "Kritis";
  if (stockValue <= 0) return "Habis";
  if (thresholdValue > 0 && stockValue <= thresholdValue) return "Kritis";
  return "Normal";
};

const mapInventorySnapshotToReportRows = (snapshot, typeLabel) =>
  snapshot.docs.map((documentItem) => {
    const payload = documentItem.data();
    const stockValue = resolveDisplayStock(payload);
    const minimumStockThreshold = resolveMasterThreshold(payload, typeLabel);
    const sourceType = resolveSourceType(typeLabel);
    const unitDisplay = resolveDisplayUnit(payload);

    return {
      id: documentItem.id,
      ...payload,
      stockDisplay: stockValue,
      minStockDisplay: minimumStockThreshold,
      unitDisplay,
      type: typeLabel,
      status: resolveStatus(stockValue, minimumStockThreshold, payload, sourceType),
      affectedVariantSummary: formatAffectedVariantStockSummary(payload, {
        sourceType,
        threshold: minimumStockThreshold,
        unit: unitDisplay,
      }),
    };
  });

export const fetchStockReportData = async () => {
  const [rawMaterialsSnapshot, productsSnapshot, semiFinishedSnapshot, categorySnapshot] = await Promise.all([
    getDocs(collection(db, "raw_materials")),
    getDocs(collection(db, "products")),
    getDocs(collection(db, "semi_finished_materials")),
    getDocs(collection(db, "categories")),
  ]);

  const rawMaterialsData = mapInventorySnapshotToReportRows(rawMaterialsSnapshot, "Bahan Baku");
  const productsData = mapInventorySnapshotToReportRows(productsSnapshot, "Produk Jadi");
  const semiFinishedData = mapInventorySnapshotToReportRows(semiFinishedSnapshot, "Semi Finished");
  const categories = categorySnapshot.docs.map((documentItem) => documentItem.data().name);

  return {
    inventory: [...rawMaterialsData, ...productsData, ...semiFinishedData],
    categories,
  };
};
