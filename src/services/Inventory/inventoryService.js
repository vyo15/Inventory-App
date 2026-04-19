import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

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
// SECTION: Update stok item
// =========================
export const updateStock = async (itemId, quantityChange, collectionName) => {
  try {
    const itemReference = doc(db, collectionName, itemId);

    // =====================================================
    // Active stock helper:
    // - currentStock adalah source of truth aktif.
    // - stock tetap ikut disinkronkan untuk kompatibilitas tampilan / logic lama.
    // =====================================================
    await updateDoc(itemReference, {
      currentStock: increment(quantityChange),
      stock: increment(quantityChange),
    });
  } catch (error) {
    console.error("Gagal update stok:", error);
    throw error;
  }
};
