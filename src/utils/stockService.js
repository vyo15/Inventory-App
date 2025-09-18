import { doc, getDoc, updateDoc, collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";

// Fungsi untuk memperbarui stok berdasarkan jenis transaksi
export const updateStock = async (
  productId,
  quantityChange,
  type, // 'stock_in', 'stock_out', 'stock_adjustments'
  extraData = {}
) => {
  console.log("updateStock:", { productId, quantityChange, type, extraData });

  const productRef = doc(db, "products", productId);
  const productSnap = await getDoc(productRef);

  if (!productSnap.exists()) {
    throw new Error("Produk tidak ditemukan");
  }

  const productData = productSnap.data();
  const currentStock = productData.stock || 0;
  let newStock = currentStock;

  if (type === "stock_in") {
    newStock = currentStock + quantityChange;
  } else if (type === "stock_out") {
    newStock = Math.max(0, currentStock - quantityChange);
  } else if (type === "stock_adjustments") {
    if (extraData.adjustmentType === "Increase") {
      newStock = currentStock + quantityChange;
    } else {
      newStock = Math.max(0, currentStock - quantityChange);
    }
  } else {
    throw new Error("Tipe transaksi stok tidak valid");
  }

  await updateDoc(productRef, { stock: newStock });

  const logData = {
    productId,
    itemName: productData.name || "Tidak diketahui",
    quantity: Math.abs(quantityChange),
    date: new Date().toISOString(),
    type,
    ...extraData,
  };

  await addDoc(collection(db, type), logData);
};
