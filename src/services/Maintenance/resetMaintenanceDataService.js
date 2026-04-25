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
// ACTIVE / FINAL FOUNDATION:
// - service final ini khusus reset destructive, preview reset, baseline, dan sync stok;
// - repair/audit non-destructive tetap dipisah ke service Maintenance lain;
// - reset scoped dipakai agar modul sensitif seperti sales/purchases/production
//   tidak menghapus data lintas modul secara membabi buta.
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

const safeTrim = (value) => String(value || "").trim();
const normalizeType = (value) => safeTrim(value).toLowerCase();

const hasTruthyReference = (value) => Boolean(safeTrim(value));

// -----------------------------------------------------------------------------
// Scoped filter reset.
// ACTIVE / FINAL FOUNDATION: filter ini menjaga reset terarah agar data bersama
// seperti incomes, expenses, dan inventory_logs tidak dihapus seluruhnya saat
// user hanya memilih modul spesifik.
// -----------------------------------------------------------------------------
const SCOPED_FILTERS = {
  salesIncome: (data = {}) =>
    normalizeType(data.sourceModule) === "sales" ||
    normalizeType(data.type).includes("penjualan") ||
    hasTruthyReference(data.saleId) ||
    hasTruthyReference(data.salesChannel),
  purchaseExpense: (data = {}) =>
    normalizeType(data.sourceModule) === "purchases" ||
    hasTruthyReference(data.relatedPurchaseId) ||
    normalizeType(data.type).includes("pembelian"),
  productionInventoryLog: (data = {}) => {
    const type = normalizeType(data.type || data.actionType);
    return (
      type.includes("production") ||
      hasTruthyReference(data.productionOrderId || data.details?.productionOrderId) ||
      hasTruthyReference(data.workLogRefId || data.workLogId || data.details?.workLogRefId || data.details?.workLogId)
    );
  },
  salesInventoryLog: (data = {}) => {
    const type = normalizeType(data.type || data.actionType);
    return type.includes("sale") || hasTruthyReference(data.saleId || data.details?.saleId);
  },
  purchaseInventoryLog: (data = {}) => {
    const type = normalizeType(data.type || data.actionType);
    return type.includes("purchase") || hasTruthyReference(data.purchaseId || data.details?.purchaseId);
  },
  returnInventoryLog: (data = {}) => {
    const type = normalizeType(data.type || data.actionType);
    return type.includes("return") || hasTruthyReference(data.returnId || data.details?.returnId);
  },
  adjustmentInventoryLog: (data = {}) => {
    const type = normalizeType(data.type || data.actionType);
    return type.includes("adjustment") || hasTruthyReference(data.adjustmentId || data.details?.adjustmentId);
  },
};

const MODULE_DEFINITIONS = {
  sales: {
    label: "Penjualan",
    collections: [
      { key: "sales", label: "Penjualan", action: "Hapus transaksi penjualan" },
      {
        key: "incomes",
        label: "Pemasukan Penjualan",
        action: "Hapus pemasukan yang bersumber dari sales saja",
        scopeKey: "sales_income",
        scopeLabel: "Hanya income penjualan",
        filter: SCOPED_FILTERS.salesIncome,
      },
      {
        key: "inventory_logs",
        label: "Inventory Log Penjualan",
        action: "Hapus log stok penjualan saja",
        scopeKey: "sales_inventory_log",
        scopeLabel: "Hanya log penjualan",
        filter: SCOPED_FILTERS.salesInventoryLog,
      },
    ],
  },
  purchases: {
    label: "Pembelian",
    collections: [
      { key: "purchases", label: "Pembelian", action: "Hapus transaksi pembelian" },
      { key: "supplierPurchases", label: "Supplier Purchases", action: "Hapus relasi pembelian supplier" },
      {
        key: "expenses",
        label: "Expense Pembelian",
        action: "Hapus expense yang bersumber dari purchases saja",
        scopeKey: "purchase_expense",
        scopeLabel: "Hanya expense pembelian",
        filter: SCOPED_FILTERS.purchaseExpense,
      },
      {
        key: "inventory_logs",
        label: "Inventory Log Pembelian",
        action: "Hapus log stok pembelian saja",
        scopeKey: "purchase_inventory_log",
        scopeLabel: "Hanya log pembelian",
        filter: SCOPED_FILTERS.purchaseInventoryLog,
      },
    ],
  },
  returns: {
    label: "Retur",
    collections: [
      { key: "returns", label: "Retur", action: "Hapus transaksi retur" },
      {
        key: "inventory_logs",
        label: "Inventory Log Retur",
        action: "Hapus log stok retur saja",
        scopeKey: "return_inventory_log",
        scopeLabel: "Hanya log retur",
        filter: SCOPED_FILTERS.returnInventoryLog,
      },
    ],
  },
  production: {
    label: "Produksi",
    collections: [
      { key: "production_orders", label: "Production Order", action: "Hapus PO produksi" },
      { key: "production_work_logs", label: "Production Work Log", action: "Hapus work log produksi" },
      { key: "production_payrolls", label: "Payroll Produksi", action: "Hapus payroll produksi" },
      { key: "productions", label: "Productions Legacy", action: "Bersihkan jejak flow lama" },
      {
        key: "inventory_logs",
        label: "Inventory Log Produksi",
        action: "Hapus log stok produksi saja agar tidak orphan",
        scopeKey: "production_inventory_log",
        scopeLabel: "Hanya log produksi",
        filter: SCOPED_FILTERS.productionInventoryLog,
      },
    ],
  },
  cash_and_expenses: {
    label: "Kas & Biaya",
    collections: [
      { key: "expenses", label: "Pengeluaran", action: "Hapus semua transaksi pengeluaran" },
      { key: "revenues", label: "Pendapatan", action: "Hapus pendapatan non-penjualan" },
      { key: "incomes", label: "Pemasukan", action: "Hapus semua pemasukan" },
    ],
  },
  stock_adjustment_and_logs: {
    label: "Penyesuaian & Log Stok",
    collections: [
      { key: "stock_adjustments", label: "Stock Adjustment", action: "Hapus penyesuaian stok" },
      {
        key: "inventory_logs",
        label: "Inventory Log Adjustment",
        action: "Hapus log stok penyesuaian saja",
        scopeKey: "adjustment_inventory_log",
        scopeLabel: "Hanya log adjustment",
        filter: SCOPED_FILTERS.adjustmentInventoryLog,
      },
    ],
  },
  pricing_logs: {
    label: "Pricing Log",
    collections: [
      { key: "pricing_logs", label: "Pricing Log", action: "Hapus riwayat pricing" },
    ],
  },
};

const buildTargetKey = (item = {}) => `${item.key}::${item.scopeKey || "all"}`;

const isFullCollectionTarget = (item = {}) => !item.filter;

// -----------------------------------------------------------------------------
// Target reset dipisah per scope. Jika modul Cash & Biaya dipilih, target full
// incomes/expenses akan mengalahkan target scoped dari sales/purchases agar tidak
// ada operasi dobel pada collection yang sama.
// -----------------------------------------------------------------------------
const getCollectionTargetsFromModules = (modules = []) => {
  const map = new Map();

  modules.forEach((moduleKey) => {
    const definition = MODULE_DEFINITIONS[moduleKey];
    if (!definition) return;

    definition.collections.forEach((rawItem) => {
      const item = {
        ...rawItem,
        moduleKey,
        moduleLabel: definition.label,
        targetKey: buildTargetKey(rawItem),
      };
      map.set(item.targetKey, item);
    });
  });

  const targets = Array.from(map.values());
  const fullCollectionKeys = new Set(targets.filter(isFullCollectionTarget).map((item) => item.key));

  return targets.filter((item) => isFullCollectionTarget(item) || !fullCollectionKeys.has(item.key));
};

const readFilteredDocuments = async (target = {}) => {
  const snapshot = await getDocs(collection(db, target.key));
  const docs = target.filter
    ? snapshot.docs.filter((itemDoc) => target.filter(itemDoc.data()))
    : snapshot.docs;
  return docs;
};

const countCollectionDocuments = async (target) => {
  const docs = await readFilteredDocuments(target);
  return docs.length;
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
        variantKey: safeTrim(variant.variantKey || variant.id || variant.name || variant.variantName || variant.color || `variant-${index}`),
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
      variantKey: safeTrim(variant.variantKey || variant.id || variant.name || variant.variantName || variant.color || `variant-${index}`),
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

const commitDeleteTarget = async (target) => {
  const docs = await readFilteredDocuments(target);
  if (!docs.length) return 0;

  let batch = writeBatch(db);
  let operationCount = 0;
  let deletedCount = 0;

  for (const itemDoc of docs) {
    batch.delete(itemDoc.ref);
    operationCount += 1;
    deletedCount += 1;

    if (operationCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) await batch.commit();

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

  if (operationCount > 0) await batch.commit();

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
      count: await countCollectionDocuments(item),
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

  if (operationCount > 0) await batch.commit();

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
    const deletedCount = await commitDeleteTarget(item);
    totalDeletedRecords += deletedCount;
    deletedCollections.push({
      ...item,
      deletedCount,
    });
  }

  const stockResult = await applyStockModeToMasterItems(resetMode);

  return {
    message: `Reset data selesai. ${totalDeletedRecords} record dibersihkan. ${stockResult.message}`,
    totalDeletedRecords,
    deletedCollections,
    stockResult,
  };
};
