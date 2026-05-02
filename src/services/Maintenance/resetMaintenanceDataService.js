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

// -----------------------------------------------------------------------------
// Protected master data.
// ACTIVE / GUARDED:
// - daftar ini menjadi pagar terakhir agar reset transaksi/testing tidak
//   menghapus master penting seperti Supplier secara default;
// - collection supplierPurchases adalah master Supplier/vendor restock, bukan
//   transaksi pembelian, sehingga tidak boleh ikut reset module Purchases.
// -----------------------------------------------------------------------------
export const PROTECTED_MASTER_COLLECTIONS = [
  { key: "supplierPurchases", label: "Supplier / Vendor Restock", reason: "Master Supplier dilindungi dari reset default." },
  { key: "raw_materials", label: "Raw Materials", reason: "Master stok bahan baku tidak dihapus oleh reset transaksi." },
  { key: "products", label: "Products", reason: "Master produk tidak dihapus oleh reset transaksi." },
  { key: "customers", label: "Customers", reason: "Master customer tetap dipertahankan." },
  { key: "production_steps", label: "Production Steps", reason: "Master step produksi tetap dipertahankan." },
  { key: "production_employees", label: "Production Employees", reason: "Master karyawan produksi tetap dipertahankan." },
  { key: "semi_finished_materials", label: "Semi Finished Materials", reason: "Master bahan setengah jadi tidak dihapus oleh reset transaksi." },
  { key: "production_boms", label: "Production BOMs", reason: "Master BOM/setup produksi tetap dipertahankan." },
];

const PROTECTED_COLLECTION_KEYS = new Set(PROTECTED_MASTER_COLLECTIONS.map((item) => item.key));

// -----------------------------------------------------------------------------
// Data test marker.
// ACTIVE / DEV TOOL:
// - fitur hapus data test hanya boleh menghapus dokumen yang punya marker ini;
// - dokumen normal tanpa marker tidak boleh ikut terhapus.
// -----------------------------------------------------------------------------
export const DEV_TEST_DATA_MARKER = {
  isTestData: true,
  sourceModule: "dev_test_seed",
  createdBy: "dev_seed",
};

const TEST_DATA_CLEANUP_COLLECTIONS = [
  "purchases",
  "sales",
  "returns",
  "expenses",
  "incomes",
  "revenues",
  "stock_adjustments",
  "inventory_logs",
  "production_orders",
  "production_work_logs",
  "production_payrolls",
  "production_plans",
  "pricing_logs",
];

const BATCH_LIMIT = 400;
const SAFE_CLIENT_BATCH_OPERATION_LIMIT = BATCH_LIMIT;
const VALID_RESET_MODES = new Set(RESET_MODE_OPTIONS.map((item) => item.value));
const STOCK_COLLECTION_KEYS = new Set(STOCK_COLLECTIONS);

// -----------------------------------------------------------------------------
// Reset target collections.
// IMS NOTE [AKTIF/GUARDED] — daftar ini dipakai sebagai kontrak lokal dengan
// Firestore Rules staged-final. Collection baru wajib ditambahkan eksplisit
// setelah diaudit agar reset tidak menyentuh scope yang tidak dikenal.
// Behavior-preserving cleanup: hanya merapikan grouping allowlist, bukan mengubah
// target reset, role, schema, atau business rules.
// -----------------------------------------------------------------------------
const RESET_TRANSACTION_COLLECTIONS = [
  "purchases",
  "sales",
  "returns",
  "expenses",
  "incomes",
  "revenues",
  "stock_adjustments",
  "inventory_logs",
  "production_orders",
  "production_work_logs",
  "production_payrolls",
  "production_plans",
  "pricing_logs",
];

// IMS NOTE [LEGACY/GUARDED] — collection produksi lama tetap diizinkan hanya
// karena reset service masih punya opsi cleanup legacy. Jangan jadikan flow aktif.
const RESET_LEGACY_COLLECTIONS = ["productions"];

const RESET_ALLOWED_DELETE_COLLECTIONS = new Set([
  ...RESET_TRANSACTION_COLLECTIONS,
  ...RESET_LEGACY_COLLECTIONS,
]);

const safeTrim = (value) => String(value || "").trim();
const normalizeType = (value) => safeTrim(value).toLowerCase();

const hasTruthyReference = (value) => Boolean(safeTrim(value));

const isProtectedCollection = (collectionKey) => PROTECTED_COLLECTION_KEYS.has(collectionKey);
const isResetDeleteAllowedCollection = (collectionKey) => RESET_ALLOWED_DELETE_COLLECTIONS.has(collectionKey);

const assertValidResetMode = (resetMode) => {
  if (!VALID_RESET_MODES.has(resetMode)) {
    throw new Error("Mode reset tidak valid. Pilih mode reset dari opsi yang tersedia.");
  }
};

const assertSelectedModulesAllowed = (modules = []) => {
  const selectedModules = Array.isArray(modules) ? modules : [];
  const unknownModules = selectedModules.filter((moduleKey) => !MODULE_DEFINITIONS[moduleKey]);

  if (unknownModules.length) {
    throw new Error(`Modul reset tidak dikenal: ${unknownModules.join(", ")}. Reset dibatalkan agar tidak menyentuh scope yang salah.`);
  }
};

const assertResetTargetsSafe = (targets = []) => {
  const protectedTargets = targets.filter((target) => isProtectedCollection(target.key));
  if (protectedTargets.length) {
    throw new Error(`Reset dibatalkan karena target berisi protected master data: ${protectedTargets.map((item) => item.key).join(", ")}.`);
  }

  const unknownTargets = targets.filter((target) => !isResetDeleteAllowedCollection(target.key));
  if (unknownTargets.length) {
    throw new Error(`Reset dibatalkan karena collection belum masuk allowlist rules reset: ${unknownTargets.map((item) => item.key).join(", ")}.`);
  }
};

const assertClientBatchOperationLimit = (operationCount = 0) => {
  if (operationCount > SAFE_CLIENT_BATCH_OPERATION_LIMIT) {
    throw new Error(
      `Reset dibatalkan karena ada ${operationCount} operasi tulis, melebihi batas aman ${SAFE_CLIENT_BATCH_OPERATION_LIMIT} operasi dari browser. Perkecil scope modul atau gunakan jalur maintenance/server terpisah agar tidak partial delete.`,
    );
  }
};


const hasDevTestMarker = (data = {}) => (
  data?.isTestData === DEV_TEST_DATA_MARKER.isTestData &&
  data?.sourceModule === DEV_TEST_DATA_MARKER.sourceModule &&
  data?.createdBy === DEV_TEST_DATA_MARKER.createdBy
);


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
    label: "Produksi (Lengkap)",
    collections: [
      { key: "production_orders", label: "Production Order", action: "Hapus PO produksi" },
      { key: "production_work_logs", label: "Production Work Log", action: "Hapus work log produksi" },
      { key: "production_payrolls", label: "Payroll Produksi", action: "Hapus payroll produksi" },
      {
        key: "productions",
        label: "Productions Legacy",
        action: "Bersihkan jejak flow lama",
        legacyNote: "LEGACY: collection lama hanya ikut reset/cleanup, bukan flow produksi aktif.",
      },
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
  production_core_and_logs: {
    label: "Produksi + Log Produksi",
    collections: [
      { key: "production_orders", label: "Production Order", action: "Hapus PO produksi" },
      { key: "production_work_logs", label: "Production Work Log", action: "Hapus work log produksi" },
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
  production_payroll_only: {
    label: "Payroll Produksi Saja",
    collections: [
      { key: "production_payrolls", label: "Payroll Produksi", action: "Hapus payroll produksi saja" },
    ],
  },
  productions_legacy_only: {
    label: "Productions Legacy Saja",
    collections: [
      {
        key: "productions",
        label: "Productions Legacy",
        action: "Bersihkan jejak flow lama saja",
        legacyNote: "LEGACY: opsi ini dipertahankan untuk cleanup data lama, bukan mengaktifkan flow productions.",
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

  return targets
    .filter((item) => isFullCollectionTarget(item) || !fullCollectionKeys.has(item.key))
    .filter((item) => {
      // -----------------------------------------------------------------------
      // Protected reset guard.
      // ACTIVE / GUARDED: walaupun ada developer menambahkan protected collection
      // ke MODULE_DEFINITIONS di masa depan, reset default tetap menolak target
      // tersebut agar master Supplier dan master lain tidak terhapus diam-diam.
      // -----------------------------------------------------------------------
      return !isProtectedCollection(item.key);
    });
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

const buildDeletePlanForTarget = async (target) => {
  if (isProtectedCollection(target?.key)) {
    // -------------------------------------------------------------------------
    // Last-line destructive guard.
    // AKTIF / GUARDED: delete collection target tidak boleh berjalan untuk
    // protected master data, termasuk Supplier (supplierPurchases).
    // -------------------------------------------------------------------------
    throw new Error(`Collection ${target.key} dilindungi dan tidak boleh dihapus oleh reset default.`);
  }

  if (!isResetDeleteAllowedCollection(target?.key)) {
    // -------------------------------------------------------------------------
    // Firestore rules compatibility guard.
    // AKTIF / GUARDED: reset hanya boleh menyasar collection yang memang masuk
    // allowlist reset dan seharusnya ada di isKnownBusinessCollection rules.
    // -------------------------------------------------------------------------
    throw new Error(`Collection ${target.key} belum masuk allowlist reset yang aman.`);
  }

  const docs = await readFilteredDocuments(target);
  return {
    target,
    docs,
    deletedCount: docs.length,
  };
};

const buildDeletePlans = async (targets = []) => {
  assertResetTargetsSafe(targets);
  return Promise.all(targets.map((target) => buildDeletePlanForTarget(target)));
};

const validateBaselineItemShape = (item = {}, index = 0) => {
  const collectionName = safeTrim(item.collectionName);
  const itemId = safeTrim(item.itemId);

  if (!STOCK_COLLECTION_KEYS.has(collectionName)) {
    throw new Error(`Baseline item #${index + 1} memakai collection tidak valid: ${collectionName || "(kosong)"}.`);
  }

  if (!itemId) {
    throw new Error(`Baseline item #${index + 1} tidak punya itemId. Restore baseline dibatalkan sebelum delete.`);
  }

  if (!item.stockData || typeof item.stockData !== "object") {
    throw new Error(`Baseline item #${index + 1} tidak punya stockData valid. Restore baseline dibatalkan sebelum delete.`);
  }

  return { collectionName, itemId, stockData: item.stockData };
};

const buildStockOperationPlan = async (resetMode) => {
  if (resetMode === "transaction_only") {
    return {
      updates: [],
      affectedItems: 0,
      message: "Stok master dipertahankan.",
    };
  }

  const updates = [];

  if (resetMode === "reset_and_restore_baseline") {
    const baselineDoc = await getBaselineSnapshotDoc();

    if (!baselineDoc?.items?.length) {
      throw new Error("Baseline testing belum ada. Simpan baseline dulu sebelum restore baseline.");
    }

    for (const [index, rawItem] of baselineDoc.items.entries()) {
      // -----------------------------------------------------------------------
      // Baseline restore preflight.
      // AKTIF / GUARDED: validasi dilakukan sebelum operasi destructive supaya
      // reset tidak menghapus transaksi dulu lalu gagal ketika restore stok.
      // -----------------------------------------------------------------------
      const item = validateBaselineItemShape(rawItem, index);
      const itemRef = doc(db, item.collectionName, item.itemId);
      const itemSnap = await getDoc(itemRef);

      if (!itemSnap.exists()) {
        throw new Error(`Baseline item ${item.collectionName}/${item.itemId} tidak ditemukan. Restore baseline dibatalkan sebelum delete.`);
      }

      updates.push({
        ref: itemRef,
        payload: {
          ...item.stockData,
          stockResetMode: resetMode,
          stockResetAt: serverTimestamp(),
        },
      });
    }

    return {
      updates,
      affectedItems: updates.length,
      message: `Stok ${updates.length} item berhasil dikembalikan ke baseline testing.`,
    };
  }

  if (resetMode === "reset_and_zero_stock") {
    for (const collectionName of STOCK_COLLECTIONS) {
      const snapshot = await getDocs(collection(db, collectionName));
      for (const itemDoc of snapshot.docs) {
        const stockPayload = buildZeroStockFieldsFromItem(itemDoc.data());
        updates.push({
          ref: itemDoc.ref,
          payload: {
            ...stockPayload,
            stockResetMode: resetMode,
            stockResetAt: serverTimestamp(),
          },
        });
      }
    }

    return {
      updates,
      affectedItems: updates.length,
      message: `Stok ${updates.length} item berhasil dinolkan.`,
    };
  }

  return {
    updates: [],
    affectedItems: 0,
    message: "Tidak ada perubahan stok master.",
  };
};

const commitResetWritePlan = async ({ deletePlans = [], stockUpdates = [] }) => {
  const deleteOperationCount = deletePlans.reduce((sum, item) => sum + item.docs.length, 0);
  const stockOperationCount = stockUpdates.length;
  const totalWriteOperations = deleteOperationCount + stockOperationCount;

  assertClientBatchOperationLimit(totalWriteOperations);

  if (!totalWriteOperations) return { totalWriteOperations };

  // ---------------------------------------------------------------------------
  // Single batch destructive commit.
  // AKTIF / GUARDED: seluruh delete transaksi dan update stok master dipasang
  // dalam satu batch agar Firestore melakukan commit all-or-nothing. Jika lebih
  // dari batas aman, proses diblokir sebelum write pertama untuk mencegah partial.
  // ---------------------------------------------------------------------------
  const batch = writeBatch(db);

  deletePlans.forEach((deletePlan) => {
    deletePlan.docs.forEach((itemDoc) => {
      batch.delete(itemDoc.ref);
    });
  });

  stockUpdates.forEach((item) => {
    batch.update(item.ref, item.payload);
  });

  await batch.commit();
  return { totalWriteOperations };
};

const countStockOperationsForPreview = async (resetMode, baselineDoc) => {
  if (resetMode === "transaction_only") return 0;
  if (resetMode === "reset_and_restore_baseline") return Number(baselineDoc?.items?.length || 0);

  if (resetMode === "reset_and_zero_stock") {
    let total = 0;
    for (const collectionName of STOCK_COLLECTIONS) {
      total += await countCollectionDocuments({ key: collectionName });
    }
    return total;
  }

  return 0;
};

const buildProtectedCollectionPreview = async () => {
  return Promise.all(
    PROTECTED_MASTER_COLLECTIONS.map(async (item) => ({
      ...item,
      moduleLabel: "Master Dilindungi",
      name: item.label,
      count: await countCollectionDocuments({ key: item.key }),
      action: "Dilindungi dari reset default",
      status: "protected",
    })),
  );
};

export const getResetPreview = async ({ resetMode, modules }) => {
  assertValidResetMode(resetMode);
  const selectedModules = Array.isArray(modules) ? modules : [];
  assertSelectedModulesAllowed(selectedModules);

  const collectionTargets = getCollectionTargetsFromModules(selectedModules);
  assertResetTargetsSafe(collectionTargets);

  const collections = await Promise.all(
    collectionTargets.map(async (item) => ({
      ...item,
      count: await countCollectionDocuments(item),
      status: "delete",
    })),
  );

  const protectedCollections = await buildProtectedCollectionPreview();
  const totalRecords = collections.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const protectedRecords = protectedCollections.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const baselineDoc = await getBaselineSnapshotDoc();
  const estimatedStockOperations = await countStockOperationsForPreview(resetMode, baselineDoc);
  const estimatedTotalOperations = totalRecords + estimatedStockOperations;

  return {
    resetMode,
    modules: selectedModules,
    totalRecords,
    protectedRecords,
    collections,
    protectedCollections,
    baselineSummary: {
      exists: Boolean(baselineDoc?.items?.length),
      itemCount: Number(baselineDoc?.items?.length || 0),
      savedAt: baselineDoc?.savedAt || null,
      label: baselineDoc?.items?.length
        ? `Tersimpan (${baselineDoc.items.length} item)`
        : "Belum ada baseline",
    },
    executionPlan: {
      // -----------------------------------------------------------------------
      // Preview safety plan.
      // AKTIF / GUARDED: UI memakai ringkasan ini untuk memblokir reset besar
      // dari browser sebelum masuk dialog destructive.
      // -----------------------------------------------------------------------
      deleteOperations: totalRecords,
      stockOperations: estimatedStockOperations,
      totalWriteOperations: estimatedTotalOperations,
      safeClientLimit: SAFE_CLIENT_BATCH_OPERATION_LIMIT,
      isClientBatchSafe: estimatedTotalOperations <= SAFE_CLIENT_BATCH_OPERATION_LIMIT,
    },
    rulesCompatibility: {
      allowedDeleteCollections: Array.from(RESET_ALLOWED_DELETE_COLLECTIONS),
      adminOnlyCollections: [BASELINE_COLLECTION, "maintenance_logs"],
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


const buildDevTestTargets = () => TEST_DATA_CLEANUP_COLLECTIONS.map((collectionKey) => ({
  key: collectionKey,
  label: collectionKey,
  moduleLabel: "Data Test",
  action: "Hapus hanya dokumen bermarker dev_test_seed",
  status: "test_data",
  filter: hasDevTestMarker,
}));

export const getDevTestDataPreview = async () => {
  // ---------------------------------------------------------------------------
  // Preview hapus data test.
  // ACTIVE / DEV TOOL: hanya menghitung dokumen dengan marker dev_test_seed.
  // Supplier tetap tidak masuk target agar master vendor/restock aman secara
  // default selama development.
  // ---------------------------------------------------------------------------
  const collections = await Promise.all(
    buildDevTestTargets().map(async (item) => ({
      ...item,
      count: await countCollectionDocuments(item),
    })),
  );
  const totalRecords = collections.reduce((sum, item) => sum + Number(item.count || 0), 0);
  return {
    totalRecords,
    collections,
    marker: DEV_TEST_DATA_MARKER,
    protectedCollections: await buildProtectedCollectionPreview(),
  };
};

export const deleteDevTestData = async () => {
  // ---------------------------------------------------------------------------
  // Delete data test.
  // AKTIF / GUARDED: hanya menghapus dokumen bermarker test. Dokumen normal
  // tanpa marker tidak tersentuh, protected master data tidak menjadi target,
  // dan commit dibatasi satu batch agar tidak partial delete dari browser.
  // ---------------------------------------------------------------------------
  const targets = buildDevTestTargets();
  const deletePlans = await buildDeletePlans(targets);
  const totalDeletedRecords = deletePlans.reduce((sum, item) => sum + item.deletedCount, 0);

  await commitResetWritePlan({ deletePlans });

  return {
    message: `Hapus data test selesai. ${totalDeletedRecords} record bermarker dev_test_seed dibersihkan.`,
    totalDeletedRecords,
    deletedCollections: deletePlans.map((item) => ({
      ...item.target,
      deletedCount: item.deletedCount,
    })),
  };
};

export const runResetDataTest = async ({ resetMode, modules }) => {
  assertValidResetMode(resetMode);
  const selectedModules = Array.isArray(modules) ? modules : [];

  if (!selectedModules.length) {
    throw new Error("Pilih minimal 1 modul yang ingin diproses.");
  }

  assertSelectedModulesAllowed(selectedModules);

  const collectionTargets = getCollectionTargetsFromModules(selectedModules);
  assertResetTargetsSafe(collectionTargets);

  // ---------------------------------------------------------------------------
  // Destructive reset preflight.
  // AKTIF / GUARDED: semua dokumen target dan rencana update stok dibaca +
  // divalidasi dulu. Tidak ada delete yang berjalan sebelum resetMode, target,
  // baseline, item baseline, allowlist rules, dan batas operasi aman lolos.
  // ---------------------------------------------------------------------------
  const deletePlans = await buildDeletePlans(collectionTargets);
  const stockPlan = await buildStockOperationPlan(resetMode);
  const totalDeletedRecords = deletePlans.reduce((sum, item) => sum + item.deletedCount, 0);
  const totalWriteOperations = totalDeletedRecords + stockPlan.updates.length;

  assertClientBatchOperationLimit(totalWriteOperations);

  await commitResetWritePlan({
    deletePlans,
    stockUpdates: stockPlan.updates,
  });

  return {
    message: `Reset data selesai. ${totalDeletedRecords} record dibersihkan. ${stockPlan.message}`,
    totalDeletedRecords,
    totalWriteOperations,
    deletedCollections: deletePlans.map((item) => ({
      ...item.target,
      deletedCount: item.deletedCount,
    })),
    stockResult: {
      affectedItems: stockPlan.affectedItems,
      message: stockPlan.message,
    },
  };
};
