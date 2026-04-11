// src/services/Utilities/resetTestDataService.js

import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";

// SECTION: daftar koleksi transaksi dan log yang aman dihapus
// NOTE:
// - master data inti TIDAK dimasukkan di sini
// - ini khusus data uji / data hasil transaksi
export const TRANSACTION_COLLECTIONS_TO_DELETE = [
  "sales",
  "purchases",
  "returns",
  "productions",
  "stock_adjustments",
  "inventory_logs",
  "expenses",
  "incomes",
  "revenues",
  "pricing_logs",
];

// SECTION: helper hapus isi satu koleksi bertahap
// WHY:
// Firestore batch ada batas operasi, jadi kita hapus per chunk agar aman.
const deleteCollectionInChunks = async (collectionName, chunkSize = 200) => {
  let totalDeleted = 0;

  while (true) {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(query(collectionRef, limit(chunkSize)));

    if (snapshot.empty) {
      break;
    }

    const batch = writeBatch(db);

    snapshot.docs.forEach((docItem) => {
      batch.delete(doc(db, collectionName, docItem.id));
    });

    await batch.commit();
    totalDeleted += snapshot.docs.length;
  }

  return totalDeleted;
};

// SECTION: reset field dinamis pada raw materials
const resetRawMaterialsState = async (chunkSize = 200) => {
  let totalUpdated = 0;

  while (true) {
    const snapshot = await getDocs(
      query(collection(db, "raw_materials"), limit(chunkSize)),
    );

    if (snapshot.empty) {
      break;
    }

    const batch = writeBatch(db);

    snapshot.docs.forEach((docItem) => {
      batch.update(doc(db, "raw_materials", docItem.id), {
        // SECTION: reset hasil transaksi
        stock: 0,
        averageActualUnitCost: 0,

        // SECTION: reset jejak pricing dinamis
        lastPricingUpdatedAt: null,
      });
    });

    await batch.commit();
    totalUpdated += snapshot.docs.length;

    // NOTE:
    // semua dokumen sudah ter-update, tidak perlu loop terus
    break;
  }

  return totalUpdated;
};

// SECTION: reset field dinamis pada products
const resetProductsState = async (chunkSize = 200) => {
  let totalUpdated = 0;

  while (true) {
    const snapshot = await getDocs(
      query(collection(db, "products"), limit(chunkSize)),
    );

    if (snapshot.empty) {
      break;
    }

    const batch = writeBatch(db);

    snapshot.docs.forEach((docItem) => {
      batch.update(doc(db, "products", docItem.id), {
        // SECTION: reset hasil transaksi/produksi
        stock: 0,
        hppPerUnit: 0,

        // SECTION: reset jejak pricing dinamis
        lastPricingUpdatedAt: null,
      });
    });

    await batch.commit();
    totalUpdated += snapshot.docs.length;

    // NOTE:
    // semua dokumen sudah ter-update, tidak perlu loop terus
    break;
  }

  return totalUpdated;
};

// SECTION: reset data uji aplikasi
export const resetAllTestData = async () => {
  const deletedSummary = {};
  let totalDeletedDocs = 0;

  // SECTION: hapus semua koleksi transaksi / log
  for (const collectionName of TRANSACTION_COLLECTIONS_TO_DELETE) {
    const deletedCount = await deleteCollectionInChunks(collectionName, 200);
    deletedSummary[collectionName] = deletedCount;
    totalDeletedDocs += deletedCount;
  }

  // SECTION: reset master data yang dinamis
  const rawMaterialsResetCount = await resetRawMaterialsState(200);
  const productsResetCount = await resetProductsState(200);

  return {
    deletedSummary,
    totalDeletedDocs,
    rawMaterialsResetCount,
    productsResetCount,
  };
};
