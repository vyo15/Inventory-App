import {
  collection,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import { inferHasVariants } from "../../utils/variants/variantStockHelpers";

// =============================================================================
// Transaction Variant Maintenance Service
// ACTIVE / FINAL FOUNDATION:
// - service ini mengaudit dan memperbaiki field variant snapshot lintas modul
//   transaksi lama tanpa mengubah qty, stok, kas, atau posting transaksi ulang;
// - hanya field turunan/snapshot yang aman disentuh akan direpair otomatis;
// - record yang butuh tebak variant tetap diarahkan ke reset scoped atau manual review.
// =============================================================================

const COLLECTIONS = {
  sales: "sales",
  returns: "returns",
  purchases: "purchases",
  stockAdjustments: "stock_adjustments",
  inventoryLogs: "inventory_logs",
  rawMaterials: "raw_materials",
  semiFinishedMaterials: "semi_finished_materials",
  products: "products",
};

const BATCH_LIMIT = 350;

const safeTrim = (value) => String(value || "").trim();
const normalize = (value) => safeTrim(value).toLowerCase();

const buildDocItem = (itemDoc) => ({
  id: itemDoc.id,
  ref: itemDoc.ref,
  ...itemDoc.data(),
});

const readCollectionDocs = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map(buildDocItem);
};

const buildMap = (items = []) => new Map(items.map((item) => [safeTrim(item.id), item]));

const hasVariantIdentity = (...values) => values.some((value) => Boolean(safeTrim(value)));

const getCollectionNameByItemType = (itemType = "") => {
  const type = normalize(itemType);
  if (["raw_material", "raw_materials", "material"].includes(type)) return COLLECTIONS.rawMaterials;
  if (["semi_finished_material", "semi_finished_materials", "semi_finished"].includes(type)) return COLLECTIONS.semiFinishedMaterials;
  if (["product", "products", "finished_product"].includes(type)) return COLLECTIONS.products;
  return "";
};

const getMasterItem = ({ masterMaps = {}, itemType = "", collectionName = "", itemId = "" }) => {
  const resolvedCollection = collectionName || getCollectionNameByItemType(itemType);
  if (!resolvedCollection || !itemId) return null;
  return masterMaps[resolvedCollection]?.get(safeTrim(itemId)) || null;
};

const getLegacyVariantSource = (record = {}) => {
  const variantKey = safeTrim(
    record.variantKey ||
      record.details?.variantKey ||
      record.materialVariantId ||
      record.details?.materialVariantId ||
      record.productVariantKey ||
      record.details?.productVariantKey,
  );
  const variantLabel = safeTrim(
    record.variantLabel ||
      record.details?.variantLabel ||
      record.materialVariantName ||
      record.details?.materialVariantName ||
      record.productVariantLabel ||
      record.details?.productVariantLabel,
  );
  return {
    variantKey,
    variantLabel,
    hasSource: Boolean(variantKey || variantLabel),
  };
};

const buildSummary = ({ rows = [], checkedRecords = 0 }) => ({
  checkedRecords,
  okCount: Math.max(checkedRecords - rows.length, 0),
  safeRepairCount: rows.filter((row) => row.category === "safe_repair").length,
  displayRepairCount: rows.filter((row) => row.category === "display_repair").length,
  scopedResetCount: rows.filter((row) => row.category === "scoped_reset").length,
  manualReviewCount: rows.filter((row) => row.category === "manual").length,
  executablePlanCount: rows.filter((row) => ["safe_repair", "display_repair", "scoped_reset"].includes(row.category)).length,
});

const buildRow = ({
  scope,
  code,
  status = "legacy",
  category = "manual",
  issue,
  recommendation,
  resetScope = "",
}) => ({
  key: `${scope}-${code}-${issue}`,
  scope,
  code: safeTrim(code) || "-",
  status: safeTrim(status) || "legacy",
  category,
  issue,
  recommendation,
  resetScope,
});

const collectSalesVariantRows = ({ sales = [], masterMaps = {} }) => {
  const rows = [];

  sales.forEach((sale) => {
    const items = Array.isArray(sale.items) ? sale.items : [];
    let safeRepairCount = 0;
    let manualCount = 0;

    items.forEach((line) => {
      const item = getMasterItem({ masterMaps, itemType: line.itemType || "product", itemId: line.itemId });
      if (!inferHasVariants(item || {})) return;
      if (hasVariantIdentity(line.variantKey, line.variantLabel)) return;

      const legacyVariant = getLegacyVariantSource(line);
      if (legacyVariant.hasSource) safeRepairCount += 1;
      else manualCount += 1;
    });

    if (safeRepairCount > 0) {
      rows.push(
        buildRow({
          scope: "sales",
          code: sale.referenceNumber || sale.id,
          status: sale.status || "sales",
          category: "safe_repair",
          issue: `${safeRepairCount} item sales bervarian punya source legacy yang bisa dinormalisasi ke variantKey/variantLabel final.`,
          recommendation: "Jalankan Repair Variant Lintas Modul untuk melengkapi snapshot line tanpa mengubah qty atau kas.",
          resetScope: "sales",
        }),
      );
    }

    if (manualCount > 0) {
      rows.push(
        buildRow({
          scope: "sales",
          code: sale.referenceNumber || sale.id,
          status: sale.status || "sales",
          category: "manual",
          issue: `${manualCount} item sales bervarian belum punya source variant yang cukup jelas.`,
          recommendation: "Gunakan reset scoped sales + income sales untuk data testing atau review manual jika data final historis.",
          resetScope: "sales",
        }),
      );
    }
  });

  return rows;
};

const collectTopLevelVariantRows = ({ records = [], scope = "", itemTypeResolver, masterMaps = {}, resetScope = "" }) => {
  const rows = [];

  records.forEach((record) => {
    const item = getMasterItem({
      masterMaps,
      itemType: typeof itemTypeResolver === "function" ? itemTypeResolver(record) : itemTypeResolver,
      collectionName: record.collectionName,
      itemId: record.itemId,
    });

    if (!inferHasVariants(item || {})) return;
    if (hasVariantIdentity(record.variantKey, record.variantLabel)) return;

    const legacyVariant = getLegacyVariantSource(record);
    rows.push(
      buildRow({
        scope,
        code: record.invoiceNumber || record.referenceNumber || record.id,
        status: record.status || record.type || scope,
        category: legacyVariant.hasSource ? "safe_repair" : "manual",
        issue: legacyVariant.hasSource
          ? "Record bervarian masih memakai field legacy dan belum punya variantKey/variantLabel final."
          : "Record bervarian belum punya variant snapshot final yang cukup jelas.",
        recommendation: legacyVariant.hasSource
          ? "Jalankan Repair Variant Lintas Modul untuk melengkapi snapshot final tanpa mengubah qty."
          : `Gunakan reset scoped ${resetScope} untuk data testing atau review manual untuk data final.`,
        resetScope,
      }),
    );
  });

  return rows;
};

const collectInventoryLogRows = ({ inventoryLogs = [] }) => {
  return inventoryLogs.flatMap((log) => {
    const legacyVariant = getLegacyVariantSource(log);
    const hasFinalVariant = hasVariantIdentity(log.variantKey, log.variantLabel, log.details?.variantKey, log.details?.variantLabel);
    const missingSourceType = !safeTrim(log.stockSourceType) && !safeTrim(log.details?.stockSourceType);

    if (!legacyVariant.hasSource && hasFinalVariant && !missingSourceType) {
      return [];
    }

    if (legacyVariant.hasSource && !hasFinalVariant) {
      return [
        buildRow({
          scope: "inventory_logs",
          code: log.id,
          status: log.type || "inventory_log",
          category: "display_repair",
          issue: "Inventory log masih memakai field variant legacy dan belum punya variantKey/variantLabel final lengkap.",
          recommendation: "Repair Schema Inventory Log atau Repair Variant Lintas Modul aman dijalankan karena hanya field display/schema yang dilengkapi.",
          resetScope: "inventory_logs",
        }),
      ];
    }

    if (missingSourceType) {
      return [
        buildRow({
          scope: "inventory_logs",
          code: log.id,
          status: log.type || "inventory_log",
          category: "display_repair",
          issue: "Inventory log belum punya stockSourceType final.",
          recommendation: "Jalankan Repair Schema Inventory Log agar field source/type final konsisten.",
          resetScope: "inventory_logs",
        }),
      ];
    }

    return [];
  });
};

const buildSalesRepairPayload = (sale = {}, masterMaps = {}) => {
  const items = Array.isArray(sale.items) ? sale.items : [];
  let touched = false;

  const nextItems = items.map((line) => {
    const item = getMasterItem({ masterMaps, itemType: line.itemType || "product", itemId: line.itemId });
    if (!inferHasVariants(item || {})) return line;
    if (hasVariantIdentity(line.variantKey, line.variantLabel)) return line;

    const legacyVariant = getLegacyVariantSource(line);
    if (!legacyVariant.hasSource) return line;

    touched = true;
    return {
      ...line,
      variantKey: legacyVariant.variantKey || line.variantKey || "",
      variantLabel: legacyVariant.variantLabel || line.variantLabel || legacyVariant.variantKey || "",
      variantMaintenanceRepairedAt: new Date().toISOString(),
    };
  });

  return touched ? { items: nextItems, variantMaintenanceRepairedAt: serverTimestamp() } : null;
};

const buildTopLevelRepairPayload = (record = {}, masterMaps = {}, itemTypeResolver) => {
  const item = getMasterItem({
    masterMaps,
    itemType: typeof itemTypeResolver === "function" ? itemTypeResolver(record) : itemTypeResolver,
    collectionName: record.collectionName,
    itemId: record.itemId,
  });
  if (!inferHasVariants(item || {})) return null;
  if (hasVariantIdentity(record.variantKey, record.variantLabel)) return null;

  const legacyVariant = getLegacyVariantSource(record);
  if (!legacyVariant.hasSource) return null;

  return {
    variantKey: legacyVariant.variantKey || "",
    variantLabel: legacyVariant.variantLabel || legacyVariant.variantKey || "",
    variantMaintenanceRepairedAt: serverTimestamp(),
  };
};

export const getTransactionVariantMaintenanceAudit = async () => {
  const [sales, returns, purchases, stockAdjustments, inventoryLogs, rawMaterials, semiFinishedMaterials, products] = await Promise.all([
    readCollectionDocs(COLLECTIONS.sales),
    readCollectionDocs(COLLECTIONS.returns),
    readCollectionDocs(COLLECTIONS.purchases),
    readCollectionDocs(COLLECTIONS.stockAdjustments),
    readCollectionDocs(COLLECTIONS.inventoryLogs),
    readCollectionDocs(COLLECTIONS.rawMaterials),
    readCollectionDocs(COLLECTIONS.semiFinishedMaterials),
    readCollectionDocs(COLLECTIONS.products),
  ]);

  const masterMaps = {
    [COLLECTIONS.rawMaterials]: buildMap(rawMaterials),
    [COLLECTIONS.semiFinishedMaterials]: buildMap(semiFinishedMaterials),
    [COLLECTIONS.products]: buildMap(products),
  };

  const rows = [
    ...collectSalesVariantRows({ sales, masterMaps }),
    ...collectTopLevelVariantRows({ records: returns, scope: "returns", itemTypeResolver: (record) => record.type || "product", masterMaps, resetScope: "returns" }),
    ...collectTopLevelVariantRows({ records: purchases, scope: "purchases", itemTypeResolver: (record) => record.type || "raw_material", masterMaps, resetScope: "purchases" }),
    ...collectTopLevelVariantRows({ records: stockAdjustments, scope: "stock_adjustments", itemTypeResolver: (record) => record.itemType || "raw_material", masterMaps, resetScope: "stock_adjustment_and_logs" }),
    ...collectInventoryLogRows({ inventoryLogs }),
  ];

  const checkedRecords = sales.length + returns.length + purchases.length + stockAdjustments.length + inventoryLogs.length;
  return {
    generatedAt: new Date().toISOString(),
    rows,
    summary: buildSummary({ rows, checkedRecords }),
  };
};

export const repairTransactionVariantMaintenance = async (currentUser = null) => {
  const [sales, returns, purchases, stockAdjustments, rawMaterials, semiFinishedMaterials, products] = await Promise.all([
    readCollectionDocs(COLLECTIONS.sales),
    readCollectionDocs(COLLECTIONS.returns),
    readCollectionDocs(COLLECTIONS.purchases),
    readCollectionDocs(COLLECTIONS.stockAdjustments),
    readCollectionDocs(COLLECTIONS.rawMaterials),
    readCollectionDocs(COLLECTIONS.semiFinishedMaterials),
    readCollectionDocs(COLLECTIONS.products),
  ]);

  const masterMaps = {
    [COLLECTIONS.rawMaterials]: buildMap(rawMaterials),
    [COLLECTIONS.semiFinishedMaterials]: buildMap(semiFinishedMaterials),
    [COLLECTIONS.products]: buildMap(products),
  };

  let batch = writeBatch(db);
  let operationCount = 0;
  let updatedCount = 0;

  const commitIfNeeded = async () => {
    if (operationCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  };

  for (const sale of sales) {
    const payload = buildSalesRepairPayload(sale, masterMaps);
    if (!payload) continue;
    batch.update(sale.ref, payload);
    operationCount += 1;
    updatedCount += 1;
    await commitIfNeeded();
  }

  for (const record of returns) {
    const payload = buildTopLevelRepairPayload(record, masterMaps, (item) => item.type || "product");
    if (!payload) continue;
    batch.update(record.ref, payload);
    operationCount += 1;
    updatedCount += 1;
    await commitIfNeeded();
  }

  for (const record of purchases) {
    const payload = buildTopLevelRepairPayload(record, masterMaps, (item) => item.type || "raw_material");
    if (!payload) continue;
    batch.update(record.ref, payload);
    operationCount += 1;
    updatedCount += 1;
    await commitIfNeeded();
  }

  for (const record of stockAdjustments) {
    const payload = buildTopLevelRepairPayload(record, masterMaps, (item) => item.itemType || "raw_material");
    if (!payload) continue;
    batch.update(record.ref, payload);
    operationCount += 1;
    updatedCount += 1;
    await commitIfNeeded();
  }

  if (operationCount > 0) {
    await batch.commit();
  }

  return {
    message: `Repair variant lintas modul selesai. ${updatedCount} record diperbarui aman.`,
    updatedCount,
    executedBy: safeTrim(currentUser?.uid || currentUser?.email || "client-ui"),
    summary: {
      checkedRecords: sales.length + returns.length + purchases.length + stockAdjustments.length,
      safeRepairCount: updatedCount,
      executablePlanCount: updatedCount,
    },
  };
};
