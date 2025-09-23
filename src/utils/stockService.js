import {
  doc,
  updateDoc,
  collection,
  addDoc,
  Timestamp,
  getDocs,
  query,
  orderBy,
  increment,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Mengambil semua log inventaris yang diurutkan dari yang terbaru.
 */
export const getInventoryLogs = async () => {
  try {
    const logsCollection = collection(db, "inventory_logs");
    const q = query(logsCollection, orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data(),
    }));
  } catch (error) {
    console.error("Gagal mengambil riwayat stok:", error);
    return [];
  }
};

/**
 * Mencatat pergerakan stok ke koleksi log inventaris.
 */
export const addInventoryLog = async (
  itemId,
  itemName,
  quantityChange,
  type,
  collectionName,
  extraData = {}
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

/**
 * Memperbarui stok produk atau bahan baku dengan aman menggunakan `increment()`.
 * Digunakan di StockIn, StockOut, dan StockAdjustment.
 */
export const updateStock = async (itemId, quantityChange, collectionName) => {
  try {
    const itemRef = doc(db, collectionName, itemId);
    await updateDoc(itemRef, {
      stock: increment(quantityChange),
    });
    console.log(
      `Stok ${collectionName} dengan ID ${itemId} berhasil diperbarui.`
    );
  } catch (error) {
    console.error("Gagal update stok:", error);
    throw error;
  }
};

/**
 * Melakukan transaksi produksi secara atomik.
 */
export const performProductionTransaction = async (productionData) => {
  const batch = writeBatch(db);
  const {
    values,
    isEditing,
    editingId,
    productions,
    rawMaterials,
    finishedProducts,
  } = productionData;

  let oldProductionData = null;
  let newProductionDocRef = null;

  try {
    if (isEditing) {
      oldProductionData = productions.find((p) => p.id === editingId);
      if (!oldProductionData) {
        throw new Error("Data produksi lama tidak ditemukan.");
      }

      const oldProductRef = doc(
        db,
        "products",
        oldProductionData.productResult.productId
      );
      batch.update(oldProductRef, {
        stock: increment(-oldProductionData.productResult.quantity),
      });

      for (const material of oldProductionData.materials) {
        const oldMaterialRef = doc(db, "raw_materials", material.productId);
        batch.update(oldMaterialRef, { stock: increment(material.quantity) });
      }
    }

    const newProductRef = doc(db, "products", values.productResult.productId);
    batch.update(newProductRef, {
      stock: increment(values.productResult.quantity),
    });

    for (const material of values.materials) {
      const newMaterialRef = doc(db, "raw_materials", material.productId);
      batch.update(newMaterialRef, { stock: increment(-material.quantity) });
    }

    const docData = {
      ...values,
      date: values.date.format("YYYY-MM-DD"),
      productResult: {
        ...values.productResult,
        name:
          finishedProducts.find((p) => p.id === values.productResult.productId)
            ?.name || "N/A",
      },
      materials: values.materials.map((mat) => ({
        ...mat,
        name: rawMaterials.find((p) => p.id === mat.productId)?.name || "N/A",
      })),
    };

    if (isEditing) {
      newProductionDocRef = doc(db, "productions", editingId);
      batch.update(newProductionDocRef, docData);
    } else {
      newProductionDocRef = doc(collection(db, "productions"));
      batch.set(newProductionDocRef, docData);
    }

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Gagal melakukan transaksi produksi:", error);
    return false;
  }
};
