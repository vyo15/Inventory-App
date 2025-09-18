import { doc, getDoc, updateDoc, collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";

// Fungsi untuk memperbarui stok dan mencatat log transaksi
export const updateStock = async (
  itemId,
  quantityChange,
  type, // 'stock_in', 'stock_in_raw', 'stock_out', 'stock_out_raw'
  extraData = {}
) => {
  try {
    let itemCollection;
    let logCollection;

    // Menentukan koleksi item dan log berdasarkan tipe transaksi
    if (type === "stock_in" || type === "stock_out") {
      itemCollection = "products";
      logCollection = type;
    } else if (type === "stock_in_raw" || type === "stock_out_raw") {
      itemCollection = "materials"; // Menggunakan "materials" sesuai database
      logCollection = type.replace("_raw", "");
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

    // Menentukan apakah stok harus ditambah atau dikurangi
    if (type === "stock_in" || type === "stock_in_raw") {
      newStock = currentStock + quantityChange;
    } else if (type === "stock_out" || type === "stock_out_raw") {
      newStock = Math.max(0, currentStock - quantityChange);
    } else {
      console.error("Tipe transaksi stok tidak valid:", type);
      return;
    }

    // Memperbarui stok di koleksi yang sesuai
    await updateDoc(itemRef, { stock: newStock });

    // Membuat log transaksi
    const logData = {
      itemId,
      itemName: itemData.name || "Tidak diketahui",
      quantity: Math.abs(quantityChange),
      date: new Date().toISOString(),
      type,
      ...extraData,
    };

    // Menambahkan dokumen log ke koleksi yang sesuai
    await addDoc(collection(db, logCollection), logData);
  } catch (error) {
    console.error("Gagal memperbarui stok:", error);
    // Tidak melempar error agar aplikasi tidak crash
  }
};
