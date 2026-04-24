import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { calculateAvailableStock, toNumber } from "../../utils/stock/stockHelpers";

// -----------------------------------------------------------------------------
// Reset & Maintenance Data Service
// Tujuan service reset legacy/aktif:
// - bagian ini khusus reset destructive dan sinkronisasi stok master;
// - maintenance/repair produksi dipisah ke services/Maintenance agar tidak
//   bercampur dengan flow operasional produksi aktif.
// Tujuan service:
// 1. preview jumlah data uji yang akan dibersihkan
// 2. reset transaksi sesuai modul yang dipilih user
// 3. simpan baseline stok agar trial-error bisa diulang cepat
// 4. restore baseline / nolkan stok master testing
// 5. sinkronkan stock fields agar currentStock / stock / availableStock konsisten
// -----------------------------------------------------------------------------

export const DEFAULT_RESET_MODULES = [
  "sales",
  "purchases",
  "returns",
  "production",
  "cash_and_expenses",
  "stock_adjustment_and_logs",
  "pricing_logs",
];

export const RESET_MODE_OPTIONS = [
  {
    value: "transaction_only",
    label: "Reset Transaksi",
    description: "Hapus transaksi dan log saja. Stok master tetap seperti sekarang.",
  },
  {
    value: "reset_and_zero_stock",
    label: "Reset + Nolkan Semua Stok",
    description:
      "Hapus transaksi lalu set stok bahan baku, semi finished, dan produk jadi ke nol.",
  },
  {
    value: "reset_and_restore_baseline",
    label: "Reset + Baseline Testing",
    description:
      "Hapus transaksi lalu kembalikan stok ke baseline testing yang sudah disimpan.",
  },
];

const BASELINE_COLLECTION = "testing_baselines";
const BASELINE_DOC_ID = "inventory_reset_baseline";
const STOCK_COLLECTIONS = ["raw_materials", "semi_finished_materials", "products"];
const BATCH_LIMIT = 400;

const MODULE_DEFINITIONS = {
  sales: {
    label: "Penjualan",
    collections: [
      { key: "sales", label: "Penjualan", action: "Hapus transaksi penjualan" },
      { key: "incomes", label: "Pemasukan Penjualan", action: "Hapus catatan pemasukan" },
    ],
  },
  purchases: {
    label: "Pembelian",
    collections: [
      { key: "purchases", label: "Pembelian", action: "Hapus transaksi pembelian" },
      { key: "supplierPurchases", label: "Supplier Purchases", action: "Hapus relasi pembelian supplier" },
    ],
  },
  returns: {
    label: "Retur",
    collections: [
      { key: "returns", label: "Retur", action: "Hapus transaksi retur" },
    ],
  },
  production: {
    label: "Produksi",
    collections: [
      { key: "production_orders", label: "Production Order", action: "Hapus PO produksi" },
      { key: "production_work_logs", label: "Production Work Log", action: "Hapus work log produksi" },
      { key: "production_payrolls", label: "Payroll Produksi", action: "Hapus payroll produksi" },
      { key: "productions", label: "Productions Legacy", action: "Bersihkan jejak flow lama" },
    ],
  },
  cash_and_expenses: {
    label: "Kas & Biaya",
    collections: [
      { key: "expenses", label: "Pengeluaran", action: "Hapus transaksi pengeluaran" },
      { key: "revenues", label: "Pendapatan", action: "Hapus pendapatan non-penjualan" },
      { key: "incomes", label: "Pemasukan", action: "Hapus pemasukan umum" },
    ],
  },
  stock_adjustment_and_logs: {
    label: "Penyesuaian & Log Stok",
    collections: [
      { key: "stock_adjustments", label: "Stock Adjustment", action: "Hapus penyesuaian stok" },
      { key: "inventory_logs", label: "Inventory Log", action: "Hapus log mutasi stok" },
    ],
  },
  pricing_logs: {
    label: "Pricing Log",
    collections: [
      { key: "pricing_logs", label: "Pricing Log", action: "Hapus riwayat pricing" },
    ],
  },
};

const safeTrim = (value) => String(value || "").trim();

// -----------------------------------------------------------------------------
// Helper daftar collection aktif dari modul yang dipilih.
// include helpers dipakai agar collection bersama seperti incomes tidak dobel.
// -----------------------------------------------------------------------------
const getCollectionTargetsFromModules = (modules = []) => {
  const map = new Map();

  modules.forEach((moduleKey) => {
    const definition = MODULE_DEFINITIONS[moduleKey];
    if (!definition) return;

    definition.collections.forEach((item) => {
      if (!map.has(item.key)) {
        map.set(item.key, {
          ...item,
          moduleKey,
          moduleLabel: definition.label,
        });
      }
    });
  });

  return Array.from(map.values());
};

const countCollectionDocuments = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.size;
};

const getBaselineSnapshotDoc = async () => {
  const baselineRef = doc(db, BASELINE_COLLECTION, BASELINE_DOC_ID);
  const baselineSnap = await getDoc(baselineRef);
  return baselineSnap.exists() ? baselineSnap.data() : null;
};

const buildStockFieldsFromItem = (item = {}) => {
  const hasVariants = Array.isArray(item.variants) && item.variants.length > 0;

  if (hasVariants) {
    const variants = item.variants.map((variant, index) => {
      const currentStock = toNumber(variant.currentStock ?? variant.stock ?? 0);
      const reservedStock = toNumber(variant.reservedStock || 0);
      return {
        ...variant,
        variantKey: safeTrim(variant.variantKey || variant.id || variant.name || `variant-${index}`),
        currentStock,
        stock: currentStock,
        reservedStock,
        availableStock: calculateAvailableStock(currentStock, reservedStock),
      };
    });

    const totalCurrentStock = variants.reduce((sum, itemVariant) => sum + toNumber(itemVariant.currentStock || 0), 0);
    const totalReservedStock = variants.reduce((sum, itemVariant) => sum + toNumber(itemVariant.reservedStock || 0), 0);

    return {
      variants,
      currentStock: totalCurrentStock,
      stock: totalCurrentStock,
      reservedStock: totalReservedStock,
      availableStock: calculateAvailableStock(totalCurrentStock, totalReservedStock),
    };
  }

  const currentStock = toNumber(item.currentStock ?? item.stock ?? 0);
  const reservedStock = toNumber(item.reservedStock || 0);

  return {
    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock: calculateAvailableStock(currentStock, reservedStock),
  };
};

const buildZeroStockFieldsFromItem = (item = {}) => {
  const hasVariants = Array.isArray(item.variants) && item.variants.length > 0;

  if (hasVariants) {
    const variants = item.variants.map((variant, index) => ({
      ...variant,
      variantKey: safeTrim(variant.variantKey || variant.id || variant.name || `variant-${index}`),
      currentStock: 0,
      stock: 0,
      reservedStock: 0,
      availableStock: 0,
    }));

    return {
      variants,
      currentStock: 0,
      stock: 0,
      reservedStock: 0,
      availableStock: 0,
    };
  }

  return {
    currentStock: 0,
    stock: 0,
    reservedStock: 0,
    availableStock: 0,
  };
};

const buildBaselineStockPayload = async () => {
  const stockItems = [];

  for (const collectionName of STOCK_COLLECTIONS) {
    const snapshot = await getDocs(collection(db, collectionName));
    snapshot.docs.forEach((itemDoc) => {
      const raw = itemDoc.data();
      stockItems.push({
        collectionName,
        itemId: itemDoc.id,
        stockData: buildStockFieldsFromItem(raw),
      });
    });
  }

  return stockItems;
};

const commitDeleteCollection = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  if (!snapshot.size) return 0;

  let batch = writeBatch(db);
  let operationCount = 0;
  let deletedCount = 0;

  for (const itemDoc of snapshot.docs) {
    batch.delete(itemDoc.ref);
    operationCount += 1;
    deletedCount += 1;

    if (operationCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  return deletedCount;
};

const applyStockModeToMasterItems = async (resetMode) => {
  if (resetMode === "transaction_only") {
    return { affectedItems: 0, message: "Stok master dipertahankan." };
  }

  const baselineDoc =
    resetMode === "reset_and_restore_baseline" ? await getBaselineSnapshotDoc() : null;

  if (resetMode === "reset_and_restore_baseline" && !baselineDoc?.items?.length) {
    throw new Error("Baseline testing belum ada. Simpan baseline dulu sebelum restore baseline.");
  }

  let batch = writeBatch(db);
  let operationCount = 0;
  let affectedItems = 0;

  if (resetMode === "reset_and_restore_baseline") {
    for (const item of baselineDoc.items) {
      const itemRef = doc(db, item.collectionName, item.itemId);
      batch.update(itemRef, {
        ...item.stockData,
        stockResetMode: resetMode,
        stockResetAt: serverTimestamp(),
      });
      operationCount += 1;
      affectedItems += 1;

      if (operationCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }
  } else if (resetMode === "reset_and_zero_stock") {
    for (const collectionName of STOCK_COLLECTIONS) {
      const snapshot = await getDocs(collection(db, collectionName));
      for (const itemDoc of snapshot.docs) {
        const stockPayload = buildZeroStockFieldsFromItem(itemDoc.data());
        batch.update(itemDoc.ref, {
          ...stockPayload,
          stockResetMode: resetMode,
          stockResetAt: serverTimestamp(),
        });
        operationCount += 1;
        affectedItems += 1;

        if (operationCount >= BATCH_LIMIT) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  return {
    affectedItems,
    message:
      resetMode === "reset_and_zero_stock"
        ? `Stok ${affectedItems} item berhasil dinolkan.`
        : `Stok ${affectedItems} item berhasil dikembalikan ke baseline testing.`,
  };
};

export const getResetPreview = async ({ resetMode, modules }) => {
  const selectedModules = Array.isArray(modules) ? modules : [];
  const collectionTargets = getCollectionTargetsFromModules(selectedModules);

  const collections = await Promise.all(
    collectionTargets.map(async (item) => ({
      ...item,
      count: await countCollectionDocuments(item.key),
    })),
  );

  const totalRecords = collections.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const baselineDoc = await getBaselineSnapshotDoc();

  return {
    resetMode,
    modules: selectedModules,
    totalRecords,
    collections,
    baselineSummary: {
      exists: Boolean(baselineDoc?.items?.length),
      itemCount: Number(baselineDoc?.items?.length || 0),
      savedAt: baselineDoc?.savedAt || null,
      label: baselineDoc?.items?.length
        ? `Tersimpan (${baselineDoc.items.length} item)`
        : "Belum ada baseline",
    },
    recommendations: {
      transaction_only: "Cocok untuk trial-error cepat saat stok master aktif ingin dipertahankan.",
      reset_and_zero_stock: "Cocok untuk simulasi dari kondisi kosong total sebelum input ulang.",
      reset_and_restore_baseline:
        "Paling aman untuk testing berulang karena stok kembali ke baseline yang sama.",
    }[resetMode],
  };
};

export const saveCurrentStockAsTestingBaseline = async () => {
  const items = await buildBaselineStockPayload();

  await setDoc(doc(db, BASELINE_COLLECTION, BASELINE_DOC_ID), {
    key: BASELINE_DOC_ID,
    items,
    itemCount: items.length,
    savedAt: serverTimestamp(),
  });

  return {
    message: `Baseline stok berhasil disimpan dari ${items.length} item master.`,
    itemCount: items.length,
  };
};

export const syncAllStocks = async () => {
  let batch = writeBatch(db);
  let operationCount = 0;
  let syncedCount = 0;

  for (const collectionName of STOCK_COLLECTIONS) {
    const snapshot = await getDocs(collection(db, collectionName));
    for (const itemDoc of snapshot.docs) {
      const syncedStockFields = buildStockFieldsFromItem(itemDoc.data());
      batch.update(itemDoc.ref, {
        ...syncedStockFields,
        stockSyncedAt: serverTimestamp(),
      });
      operationCount += 1;
      syncedCount += 1;

      if (operationCount >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  return {
    message: `Sinkronisasi stok selesai untuk ${syncedCount} item master.`,
    syncedCount,
  };
};

export const runResetDataTest = async ({ resetMode, modules }) => {
  const selectedModules = Array.isArray(modules) ? modules : [];
  const collectionTargets = getCollectionTargetsFromModules(selectedModules);

  if (!selectedModules.length) {
    throw new Error("Pilih minimal 1 modul yang ingin diproses.");
  }

  const deletedCollections = [];
  let totalDeletedRecords = 0;

  for (const item of collectionTargets) {
    const deletedCount = await commitDeleteCollection(item.key);
    totalDeletedRecords += deletedCount;
    deletedCollections.push({
      ...item,
      deletedCount,
    });
  }

  const stockResult = await applyStockModeToMasterItems(resetMode);

  return {
    message: `Reset data uji selesai. ${totalDeletedRecords} record transaksi dibersihkan. ${stockResult.message}`,
    totalDeletedRecords,
    deletedCollections,
    stockResult,
  };
};
