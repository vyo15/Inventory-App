import { db } from "../firebase";
import {
  doc,
  updateDoc,
  getDoc,
  collection,
  addDoc,
  Timestamp,
} from "firebase/firestore";

export const updateStock = async (
  itemId,
  quantityChange,
  type,
  extraData = {}
) => {
  try {
    const itemRef = doc(db, "items", itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      throw new Error("Item tidak ditemukan");
    }

    const itemData = itemSnap.data();
    const newStock = (itemData.stock || 0) + quantityChange;

    // update stok di items
    await updateDoc(itemRef, { stock: newStock });

    // siapkan log transaksi
    const logCollection =
      type === "stock_in" || type === "stock_in_raw" ? "stock_in" : "stock_out";

    const logData = {
      itemId,
      itemName: itemData.name || "Tidak diketahui",
      quantity: Math.abs(quantityChange),
      date: Timestamp.now(),
      movementType: type.includes("in") ? "stock_in" : "stock_out",
      itemType: type.includes("raw") ? "raw_material" : "product",
      ...extraData,
    };

    await addDoc(collection(db, logCollection), logData);

    console.log("Stok berhasil diupdate:", logData);
  } catch (error) {
    console.error("Gagal update stok:", error);
  }
};
