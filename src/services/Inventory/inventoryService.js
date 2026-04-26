import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { calculateAvailableStock } from "../../utils/stock/stockHelpers";
import {
  buildInventoryLogPayload,
  INVENTORY_LOG_COLLECTION,
} from "./inventoryLogService";
import {
  applyStockMutationToItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
} from "../../utils/variants/variantStockHelpers";

// =========================
// SECTION: Ambil riwayat log inventaris
// Fungsi:
// - membaca audit trail mutasi stok dari Firestore dengan urutan terbaru;
// - membatasi jumlah dokumen agar Stock Management tidak membaca seluruh log saat data real membesar.
// Hubungan flow:
// - hanya untuk tampilan audit log; tidak mengubah stok dan tidak membuat mutasi baru.
// Status:
// - aktif dipakai; limit adalah guard performa, bukan perubahan business rule.
// =========================
const DEFAULT_INVENTORY_LOG_LIMIT = 300;

export const getInventoryLogs = async ({ limit = DEFAULT_INVENTORY_LOG_LIMIT } = {}) => {
  try {
    const normalizedLimit = Math.max(1, Number(limit || DEFAULT_INVENTORY_LOG_LIMIT));
    const inventoryLogsCollection = collection(db, INVENTORY_LOG_COLLECTION);
    const inventoryLogsQuery = query(
      inventoryLogsCollection,
      orderBy("timestamp", "desc"),
      firestoreLimit(normalizedLimit),
    );

    const inventoryLogsSnapshot = await getDocs(inventoryLogsQuery);

    return inventoryLogsSnapshot.docs.map((logDocument) => ({
      id: logDocument.id,
      ...logDocument.data(),
    }));
  } catch (error) {
    console.error("Gagal mengambil riwayat stok:", error);
    return [];
  }
};

// =========================
// SECTION: Tambah log inventaris
// Fungsi:
// - mencatat semua mutasi stok dari purchase, sale, return, adjustment, dan produksi
// - menyimpan extraData di top-level sekaligus details agar writer baru dan reader lama tetap kompatibel
// Hubungan flow:
// - menjadi audit trail utama di halaman Stock Management
// Status:
// - aktif/final; bukan source mutasi stok, hanya pencatatan log
// =========================
export const addInventoryLog = async (
  itemId,
  itemName,
  quantityChange,
  type,
  collectionName,
  extraData = {},
) => {
  try {
    await addDoc(
      collection(db, INVENTORY_LOG_COLLECTION),
      buildInventoryLogPayload({
        itemId,
        itemName,
        quantityChange,
        type,
        collectionName,
        extraData,
      }),
    );
  } catch (error) {
    console.error("Gagal menambah log inventaris:", error);
  }
};

// =========================
// SECTION: Helper stok final lintas modul
// Fungsi:
// - menjadi satu jalur aktif/final untuk mutasi stok inventory umum
// - item bervarian wajib mengirim variantKey agar stok tidak masuk master/default
// - payload tetap menyinkronkan currentStock, stock, reservedStock, availableStock, dan variants[]
// Hubungan flow:
// - dipakai oleh sales, return, purchase umum, dan stock adjustment
// - produksi tetap guarded exception karena butuh transaction sendiri saat start/complete work log
// Catatan legacy:
// - allowMasterForVariant hanya boleh dipakai bila ada data lama yang memang belum punya variantKey
// - wrapper legacy updateStock/updateMasterStockLegacy sudah dihapus karena tidak punya caller aktif
// =========================
export const updateInventoryStock = async ({
  itemId,
  collectionName,
  quantityChange = 0,
  variantKey = "",
  itemSnapshot = null,
  preventNegative = false,
  allowMasterForVariant = false,
} = {}) => {
  const normalizedQuantityChange = Number(quantityChange || 0);

  if (!itemId || !collectionName) {
    throw new Error("Item dan collection stok wajib dikirim untuk update stok.");
  }

  const itemReference = doc(db, collectionName, itemId);
  let item = itemSnapshot;

  if (!item) {
    const itemSnapshotDocument = await getDoc(itemReference);

    if (!itemSnapshotDocument.exists()) {
      throw new Error("Item stok tidak ditemukan.");
    }

    item = {
      id: itemSnapshotDocument.id,
      ...itemSnapshotDocument.data(),
    };
  }

  const hasVariants = inferHasVariants(item);
  const selectedVariant = hasVariants && variantKey ? findVariantByKey(item, variantKey) : null;

  if (hasVariants && !selectedVariant && !allowMasterForVariant) {
    throw new Error(
      `Item ${item?.name || itemId} memiliki varian. Pilih varian agar stok tidak masuk ke master/default.`,
    );
  }

  if (hasVariants && variantKey && !selectedVariant) {
    throw new Error(`Varian item ${item?.name || itemId} tidak ditemukan.`);
  }

  // =========================
  // SECTION: Snapshot stok sebelum mutasi
  // Fungsi:
  // - membaca current/reserved/available dari master atau varian yang dipilih
  // Hubungan flow:
  // - dipakai Stock Adjustment untuk mencegah stok keluar melebihi stok tersedia, bukan hanya currentStock mentah
  // Status:
  // - aktif/final; validasi lama yang hanya membandingkan currentStock sudah tidak dipakai
  // =========================
  const stockSnapshotBefore = selectedVariant
    ? {
        currentStock: Number(selectedVariant.currentStock || 0),
        reservedStock: Number(selectedVariant.reservedStock || 0),
        availableStock: calculateAvailableStock(
          selectedVariant.currentStock || 0,
          selectedVariant.reservedStock || 0,
        ),
      }
    : getItemStockSnapshot(item);

  if (
    preventNegative &&
    normalizedQuantityChange < 0 &&
    stockSnapshotBefore.availableStock + normalizedQuantityChange < 0
  ) {
    throw new Error(
      `Stok tersedia ${selectedVariant?.variantLabel || item?.name || "item"} tidak mencukupi. Tersedia: ${stockSnapshotBefore.availableStock}`,
    );
  }

  const stockUpdatePayload = applyStockMutationToItem({
    item,
    variantKey: selectedVariant?.variantKey || "",
    deltaCurrent: normalizedQuantityChange,
  });

  await updateDoc(itemReference, stockUpdatePayload);

  const currentStockAfter = stockSnapshotBefore.currentStock + normalizedQuantityChange;
  const availableStockAfter = calculateAvailableStock(
    currentStockAfter,
    stockSnapshotBefore.reservedStock,
  );

  return {
    item,
    updatePayload: stockUpdatePayload,
    stockSourceType: selectedVariant ? "variant" : "master",
    variantKey: selectedVariant?.variantKey || "",
    variantLabel: selectedVariant?.variantLabel || "",
    currentStockBefore: stockSnapshotBefore.currentStock,
    currentStockAfter,
    reservedStockBefore: stockSnapshotBefore.reservedStock,
    reservedStockAfter: stockSnapshotBefore.reservedStock,
    availableStockBefore: stockSnapshotBefore.availableStock,
    availableStockAfter,
  };
};
