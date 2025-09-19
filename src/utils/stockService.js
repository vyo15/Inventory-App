import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

// Tambah stok masuk
export const addStockIn = async (data) => {
  try {
    await addDoc(collection(db, "stock_in"), {
      ...data,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Gagal menambah stok masuk:", error);
    throw error;
  }
};

// Ambil semua stok masuk
export const getStockIn = async () => {
  try {
    const snapshot = await getDocs(collection(db, "stock_in"));
    return snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));
  } catch (error) {
    console.error("Gagal mengambil stok masuk:", error);
    return [];
  }
};

// Update stok (contoh untuk stock management)
export const updateStock = async (id, newData) => {
  try {
    const stockRef = doc(db, "stock_in", id);
    await updateDoc(stockRef, newData);
  } catch (error) {
    console.error("Gagal update stok:", error);
    throw error;
  }
};
