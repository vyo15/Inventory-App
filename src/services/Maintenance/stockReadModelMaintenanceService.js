import { collection, doc, getDocs, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import {
  buildStockItemReadModelDocument,
  STOCK_ITEM_READ_MODELS_COLLECTION,
} from "../Inventory/stockReadModelService";

const BATCH_LIMIT = 400;
const STOCK_READ_MODEL_ORPHAN_CLEANUP_CONFIRM_KEYWORD = "CLEANUP READ MODEL";

const STOCK_SOURCE_CONFIGS = [
  { sourceType: "material", collectionName: "raw_materials", label: "Bahan Baku" },
  { sourceType: "semi_finished", collectionName: "semi_finished_materials", label: "Semi Finished" },
  { sourceType: "product", collectionName: "products", label: "Produk Jadi" },
];

const COMPARED_READ_MODEL_FIELDS = [
  "sourceType",
  "sourceCollection",
  "sourceId",
  "displayReference",
  "name",
  "typeLabel",
  "route",
  "categoryId",
  "categoryName",
  "unit",
  "unitDisplay",
  "stock",
  "currentStock",
  "reservedStock",
  "availableStock",
  "minStockThreshold",
  "stockStatus",
  "stockStatusLabel",
  "reportStatus",
  "statusColor",
  "alertType",
  "statusRank",
  "sortGap",
  "hasStockIssue",
  "isNegativeStock",
  "isReservedOverrun",
  "hasVariants",
  "variantCount",
  "affectedVariantCount",
  "affectedVariantSummary",
  "affectedVariantEntries",
  "lastPurchaseAt",
  "lastPurchasePrice",
  "lastPurchaseUnitPrice",
  "restockSupplierId",
  "restockSupplierName",
  "restockProductLink",
  "isActive",
  "searchText",
];

const RESTOCK_METADATA_FIELDS = [
  "lastPurchaseAt",
  "lastPurchasePrice",
  "lastPurchaseUnitPrice",
  "restockSupplierId",
  "restockSupplierName",
  "restockProductLink",
];

const safeTrim = (value) => String(value ?? "").trim();

const buildDocItem = (itemDoc) => ({
  ...itemDoc.data(),
  id: itemDoc.id,
  ref: itemDoc.ref,
});

const readCollectionDocs = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map(buildDocItem);
};

const getDisplayName = (item = {}, fallback = "-") => (
  safeTrim(item.name)
  || safeTrim(item.productName)
  || safeTrim(item.materialName)
  || safeTrim(item.itemName)
  || safeTrim(item.code)
  || safeTrim(item.productCode)
  || safeTrim(item.materialCode)
  || safeTrim(item.itemCode)
  || fallback
);

const getSafeNumber = (value, fallback = 0) => {
  const numericValue = typeof value === "string"
    ? Number(value.replace(/[^\d.-]/g, ""))
    : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const normalizeStockPurchaseType = (purchase = {}) => {
  const rawType = safeTrim(purchase.type || purchase.itemType || purchase.purchaseType || purchase.sourceType || purchase.sourceCollection).toLowerCase();

  if (["material", "raw_material", "raw_materials", "raw material", "raw-material", "bahan_baku", "bahan baku", "bahanbaku"].includes(rawType)) {
    return "material";
  }

  if (["product", "products", "produk", "produk jadi", "finished_product"].includes(rawType)) {
    return "product";
  }

  return "";
};

const getPurchaseItemId = (purchase = {}) => safeTrim(
  purchase.itemId
  || purchase.materialId
  || purchase.productId
  || purchase.rawMaterialId
  || purchase.sourceId,
);

const getPurchaseDateMs = (purchase = {}) => {
  const candidates = [purchase.date, purchase.transactionDate, purchase.purchaseDate, purchase.createdAt, purchase.updatedAt];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate?.toDate === "function") return candidate.toDate().getTime();
    if (candidate instanceof Date) return candidate.getTime();
    if (typeof candidate?.seconds === "number") return candidate.seconds * 1000;

    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }

  return 0;
};

const getPurchaseUnitPrice = (purchase = {}) => {
  const explicitPrice = getSafeNumber(
    purchase.actualUnitCost
    ?? purchase.lastPurchaseUnitPrice
    ?? purchase.lastPurchasePrice
    ?? purchase.unitCost
    ?? purchase.restockReferencePrice
    ?? purchase.price,
    NaN,
  );

  if (Number.isFinite(explicitPrice)) return explicitPrice;

  const totalCost = getSafeNumber(purchase.totalActualPurchase ?? purchase.subtotalItems ?? purchase.totalReferencePurchase, 0);
  const quantity = getSafeNumber(purchase.totalStockIn ?? purchase.quantity, 0);
  return quantity > 0 ? totalCost / quantity : 0;
};

const buildPurchaseRestockMetadata = (purchase = {}) => {
  const unitPrice = getPurchaseUnitPrice(purchase);

  return {
    lastPurchaseAt: purchase.date || purchase.transactionDate || purchase.purchaseDate || purchase.createdAt || null,
    lastPurchasePrice: unitPrice,
    lastPurchaseUnitPrice: unitPrice,
    restockSupplierId: safeTrim(purchase.supplierId || purchase.supplierRefId || purchase.supplierReferenceId),
    restockSupplierName: safeTrim(purchase.supplierName || purchase.supplierLabel || purchase.supplierStoreName),
    restockProductLink: safeTrim(purchase.restockProductLink || purchase.purchaseProductLink || purchase.productLink || purchase.link),
  };
};

const buildLatestPurchaseMetadataMap = (purchaseRows = []) => {
  const latestByItem = new Map();

  purchaseRows.forEach((purchase) => {
    const sourceType = normalizeStockPurchaseType(purchase);
    const sourceId = getPurchaseItemId(purchase);
    if (!sourceType || !sourceId) return;

    const key = `${sourceType}__${sourceId}`;
    const purchaseDateMs = getPurchaseDateMs(purchase);
    const current = latestByItem.get(key);

    if (current && current.purchaseDateMs > purchaseDateMs) return;

    latestByItem.set(key, {
      ...buildPurchaseRestockMetadata(purchase),
      purchaseDateMs,
    });
  });

  return latestByItem;
};

const hasRestockMetadataChange = (changedFields = []) => (
  changedFields.some((fieldName) => RESTOCK_METADATA_FIELDS.includes(fieldName))
);

const pickRestockMetadataPayload = (payload = {}) => RESTOCK_METADATA_FIELDS.reduce((accumulator, fieldName) => {
  accumulator[fieldName] = payload[fieldName] ?? null;
  return accumulator;
}, {});

const normalizeComparableValue = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000).toISOString();
  if (Array.isArray(value)) return value.map(normalizeComparableValue);
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toFixed(6)) : 0;
  if (typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalizeComparableValue(value[key]);
        return acc;
      }, {});
  }
  return value;
};

const isComparableEqual = (left, right) => (
  JSON.stringify(normalizeComparableValue(left)) === JSON.stringify(normalizeComparableValue(right))
);

const getChangedFields = (currentPayload = {}, expectedPayload = {}) => (
  COMPARED_READ_MODEL_FIELDS.filter((fieldName) => !isComparableEqual(currentPayload?.[fieldName], expectedPayload?.[fieldName]))
);

const buildSummary = (rows = []) => {
  const missingCount = rows.filter((row) => row.issueType === "missing").length;
  const staleCount = rows.filter((row) => row.issueType === "stale").length;
  const orphanCount = rows.filter((row) => row.issueType === "orphan").length;
  const restockMetadataRepairCount = rows.filter((row) => row.needsRestockMetadataBackfill).length;
  const safeRepairCount = missingCount + staleCount;

  return {
    checkedRecords: rows.length,
    sourceRecords: rows.filter((row) => row.issueType !== "orphan").length,
    readModelRecords: rows.filter((row) => row.issueType !== "missing").length,
    okCount: rows.filter((row) => row.issueType === "ok").length,
    missingCount,
    staleCount,
    orphanCount,
    restockMetadataRepairCount,
    manualReviewCount: orphanCount,
    safeRepairCount,
    executablePlanCount: safeRepairCount,
  };
};

const omitRepairPayload = (row = {}) => {
  const publicRow = { ...row };
  delete publicRow.payload;
  delete publicRow.sourceItem;
  return publicRow;
};

const getOrphanRows = (rows = []) => rows.filter((row) => row.issueType === "orphan" && safeTrim(row.readModelId));

const buildStockReadModelAudit = async ({ includePayload = false, syncedAt = null } = {}) => {
  const expectedRows = [];
  const expectedIds = new Set();
  const purchaseRows = await readCollectionDocs("purchases");
  const latestPurchaseMetadataMap = buildLatestPurchaseMetadataMap(purchaseRows);

  for (const config of STOCK_SOURCE_CONFIGS) {
    const sourceItems = await readCollectionDocs(config.collectionName);

    sourceItems.forEach((sourceItem) => {
      const restockMetadata = latestPurchaseMetadataMap.get(`${config.sourceType}__${sourceItem.id}`) || {};
      const sourceItemWithProjection = {
        ...sourceItem,
        ...restockMetadata,
      };
      const { id: readModelId, payload } = buildStockItemReadModelDocument(sourceItemWithProjection, {
        id: sourceItem.id,
        sourceId: sourceItem.id,
        sourceType: config.sourceType,
        sourceCollection: config.collectionName,
        syncedAt,
        lastSyncedFrom: "stock_read_model_maintenance_rebuild",
      });

      expectedIds.add(readModelId);
      expectedRows.push({
        config,
        sourceItem: sourceItemWithProjection,
        readModelId,
        payload,
      });
    });
  }

  const readModelDocs = await readCollectionDocs(STOCK_ITEM_READ_MODELS_COLLECTION);
  const readModelMap = new Map(readModelDocs.map((item) => [item.id, item]));
  const rows = [];

  expectedRows.forEach(({ config, sourceItem, readModelId, payload }) => {
    const currentReadModel = readModelMap.get(readModelId);
    const changedFields = currentReadModel ? getChangedFields(currentReadModel, payload) : [];
    const issueType = !currentReadModel ? "missing" : changedFields.length ? "stale" : "ok";
    const isRepairable = issueType === "missing" || issueType === "stale";

    rows.push({
      key: `${issueType}-${readModelId}`,
      readModelId,
      needsRestockMetadataBackfill: isRepairable && hasRestockMetadataChange(changedFields),
      sourceType: config.sourceType,
      sourceCollection: config.collectionName,
      sourceLabel: config.label,
      sourceId: sourceItem.id,
      itemName: getDisplayName(sourceItem, sourceItem.id),
      category: isRepairable ? "safe_repair" : "ok",
      issueType,
      changedFields,
      issue: issueType === "missing"
        ? "Read model stok belum ada untuk master item ini."
        : issueType === "stale"
          ? `Read model stok berbeda dari master: ${changedFields.slice(0, 6).join(", ")}${changedFields.length > 6 ? "..." : ""}`
          : "Read model stok sudah sinkron.",
      recommendation: isRepairable
        ? "Aman rebuild dokumen read model turunan tanpa mengubah master stock, transaksi, atau inventory log."
        : "Tidak perlu repair.",
      ...(includePayload ? { payload, sourceItem } : {}),
    });
  });

  readModelDocs.forEach((readModelItem) => {
    if (expectedIds.has(readModelItem.id)) return;

    rows.push({
      key: `orphan-${readModelItem.id}`,
      readModelId: readModelItem.id,
      sourceType: safeTrim(readModelItem.sourceType || "unknown"),
      sourceCollection: safeTrim(readModelItem.sourceCollection || "stock_item_read_models"),
      sourceLabel: "Read Model Orphan",
      sourceId: safeTrim(readModelItem.sourceId || "-"),
      itemName: safeTrim(readModelItem.name || readModelItem.displayReference || readModelItem.id),
      category: "manual",
      issueType: "orphan",
      changedFields: [],
      issue: "Read model tidak punya master source aktif pada audit ini. Tidak dihapus otomatis.",
      recommendation: "Review manual sebelum delete orphan agar tidak salah hapus saat source read gagal atau ada data legacy.",
    });
  });

  return rows;
};

// =====================================================
// ACTIVE / GUARDED - Audit & rebuild stock_item_read_models.
// Fungsi:
// - Membandingkan master stok products/raw_materials/semi_finished_materials + metadata latest purchases dengan derived read model.
// - Rebuild hanya upsert dokumen missing/stale ke collection stock_item_read_models.
// Guard:
// - Tidak mengubah master stock, inventory_logs, transaksi, produksi, payroll, HPP, atau finance.
// - Orphan read model hanya ditandai manual review dan tidak dihapus otomatis.
// =====================================================
export const getStockReadModelMaintenanceAudit = async () => {
  const rows = await buildStockReadModelAudit({ includePayload: false });

  return {
    generatedAt: new Date().toISOString(),
    rows: rows.map(omitRepairPayload),
    summary: buildSummary(rows),
  };
};

export const rebuildStockReadModelMaintenance = async () => {
  const syncedAt = Timestamp.now();
  const rows = await buildStockReadModelAudit({ includePayload: true, syncedAt });
  const plans = rows.filter((row) => row.payload && (row.issueType === "missing" || row.issueType === "stale"));
  let batch = writeBatch(db);
  let operationCount = 0;
  let updatedCount = 0;

  for (const plan of plans) {
    batch.set(doc(db, STOCK_ITEM_READ_MODELS_COLLECTION, plan.readModelId), {
      ...plan.payload,
      readModelMaintenanceSyncedAt: syncedAt,
    }, { merge: true });
    operationCount += 1;
    updatedCount += 1;

    if (operationCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) await batch.commit();

  return {
    message: `Rebuild stock read model selesai. ${updatedCount} dokumen turunan disinkronkan tanpa mengubah master stock.`,
    updatedCount,
    skippedOrphanCount: rows.filter((row) => row.issueType === "orphan").length,
    affectedCollections: [STOCK_ITEM_READ_MODELS_COLLECTION],
    summary: buildSummary(rows),
  };
};

export const backfillStockReadModelRestockMetadataMaintenance = async () => {
  const syncedAt = Timestamp.now();
  const rows = await buildStockReadModelAudit({ includePayload: true, syncedAt });
  const plans = rows.filter((row) => row.payload && row.needsRestockMetadataBackfill);
  let batch = writeBatch(db);
  let operationCount = 0;
  let updatedCount = 0;

  for (const plan of plans) {
    const metadataPayload = plan.issueType === "missing"
      ? {
          ...plan.payload,
          readModelMaintenanceSyncedAt: syncedAt,
          lastSyncedFrom: "stock_read_model_restock_metadata_backfill",
        }
      : {
          ...pickRestockMetadataPayload(plan.payload),
          updatedAt: syncedAt,
          readModelMaintenanceSyncedAt: syncedAt,
          lastSyncedFrom: "stock_read_model_restock_metadata_backfill",
        };

    batch.set(doc(db, STOCK_ITEM_READ_MODELS_COLLECTION, plan.readModelId), metadataPayload, { merge: true });
    operationCount += 1;
    updatedCount += 1;

    if (operationCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) await batch.commit();

  return {
    message: `Backfill metadata restock read model selesai. ${updatedCount} dokumen turunan diperbarui dari histori purchases tanpa mengubah master stock.`,
    updatedCount,
    affectedCollections: [STOCK_ITEM_READ_MODELS_COLLECTION],
    summary: buildSummary(rows),
  };
};

export const deleteOrphanStockReadModelsMaintenance = async ({ confirmKeyword = "" } = {}) => {
  if (safeTrim(confirmKeyword) !== STOCK_READ_MODEL_ORPHAN_CLEANUP_CONFIRM_KEYWORD) {
    throw new Error(`Cleanup orphan stock read model wajib mengetik ${STOCK_READ_MODEL_ORPHAN_CLEANUP_CONFIRM_KEYWORD}.`);
  }

  const rows = await buildStockReadModelAudit({ includePayload: false });
  const orphanRows = getOrphanRows(rows);
  let batch = writeBatch(db);
  let operationCount = 0;
  let deletedCount = 0;

  for (const orphanRow of orphanRows) {
    batch.delete(doc(db, STOCK_ITEM_READ_MODELS_COLLECTION, orphanRow.readModelId));
    operationCount += 1;
    deletedCount += 1;

    if (operationCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) await batch.commit();

  return {
    message: `Cleanup orphan stock read model selesai. ${deletedCount} dokumen turunan dihapus tanpa mengubah master stock.`,
    deletedCount,
    affectedCollections: [STOCK_ITEM_READ_MODELS_COLLECTION],
    summary: buildSummary(rows),
  };
};

