import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  applyStockMutationToItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
} from "../../utils/variants/variantStockHelpers";

// =========================
// SECTION: Ambil riwayat log inventaris
// =========================
export const getInventoryLogs = async () => {
  try {
    const inventoryLogsCollection = collection(db, "inventory_logs");
    const inventoryLogsQuery = query(
      inventoryLogsCollection,
      orderBy("timestamp", "desc"),
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
    await addDoc(collection(db, "inventory_logs"), {
      itemId,
      itemName,
      quantityChange,
      type,
      collectionName,
      timestamp: Timestamp.now(),
      ...extraData,
    });
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
// Catatan legacy:
// - allowMasterForVariant hanya dipakai oleh wrapper updateStock lama agar modul yang belum dimigrasi tidak langsung crash
// - semua menu utama yang disentuh patch ini memakai mode strict default: allowMasterForVariant=false
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

  const currentStockBefore = selectedVariant
    ? Number(selectedVariant.currentStock || 0)
    : getItemStockSnapshot(item).currentStock;

  if (preventNegative && currentStockBefore + normalizedQuantityChange < 0) {
    throw new Error(
      `Stok ${selectedVariant?.variantLabel || item?.name || "item"} tidak mencukupi. Tersedia: ${currentStockBefore}`,
    );
  }

  const stockUpdatePayload = applyStockMutationToItem({
    item,
    variantKey: selectedVariant?.variantKey || "",
    deltaCurrent: normalizedQuantityChange,
  });

  await updateDoc(itemReference, stockUpdatePayload);

  return {
    item,
    updatePayload: stockUpdatePayload,
    stockSourceType: selectedVariant ? "variant" : "master",
    variantKey: selectedVariant?.variantKey || "",
    variantLabel: selectedVariant?.variantLabel || "",
    currentStockBefore,
    currentStockAfter: currentStockBefore + normalizedQuantityChange,
  };
};

// =========================
// SECTION: Update stok item legacy/deprecated
// Status:
// - dipertahankan sementara agar import lama tidak langsung error
// - modul baru/final wajib memakai updateInventoryStock dengan variantKey eksplisit
// - aman dihapus setelah semua caller master-only lama dibersihkan lewat audit grep
// =========================
export const updateStock = async (itemId, quantityChange, collectionName) => {
  try {
    await updateInventoryStock({
      itemId,
      collectionName,
      quantityChange,
      allowMasterForVariant: true,
    });
  } catch (error) {
    console.error("Gagal update stok:", error);
    throw error;
  }
};

// =========================
// SECTION: Direct stock increment legacy
// Status:
// - hanya tersisa untuk kompatibilitas call site lama yang belum dimigrasi
// - jangan dipakai pada menu final karena tidak variant-aware
// =========================
export const updateMasterStockLegacy = async (itemId, quantityChange, collectionName) => {
  const itemReference = doc(db, collectionName, itemId);

  await updateDoc(itemReference, {
    currentStock: increment(quantityChange),
    stock: increment(quantityChange),
  });
};
