import { doc, getDoc, updateDoc, collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";

export const updateStock = async (
  itemId,
  quantityChange,
  type, // 'stock_in', 'stock_in_raw', 'stock_out', 'stock_out_raw'
  extraData = {}
) => {
  try {
    let itemCollection;

    // Menentukan koleksi item berdasarkan tipe transaksi
    if (type === "stock_in" || type === "stock_out") {
      itemCollection = "products";
    } else if (type === "stock_in_raw" || type === "stock_out_raw") {
      itemCollection = "raw_materials"; // <-- PERBAIKAN DI SINI
    } else {
      console.error("Tipe transaksi stok tidak valid:", type);
      return;
    }

    const itemRef = doc(db, itemCollection, itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      console.error("Item tidak ditemukan:", itemId);
      return;
    }

    const itemData = itemSnap.data();
    const currentStock = itemData.stock || 0;
    let newStock;

    if (type === "stock_in" || type === "stock_in_raw") {
      newStock = currentStock + quantityChange;
    } else if (type === "stock_out" || type === "stock_out_raw") {
      newStock = Math.max(0, currentStock - quantityChange);
    } else {
      console.error("Tipe transaksi stok tidak valid:", type);
      return;
    }

    await updateDoc(itemRef, { stock: newStock });

    // Membuat log transaksi (opsional, tapi disarankan)
    const logData = {
      itemId,
      itemName: itemData.name || "Tidak diketahui",
      quantity: Math.abs(quantityChange),
      date: new Date().toISOString(),
      type,
      ...extraData,
    };

    await addDoc(collection(db, type), logData);
  } catch (error) {
    console.error("Gagal memperbarui stok:", error);
  }
};
