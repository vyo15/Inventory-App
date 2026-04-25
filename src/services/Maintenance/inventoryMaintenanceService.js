import { collection, getDocs, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { calculateAvailableStock, toNumber } from "../../utils/stock/stockHelpers";

const BATCH_LIMIT = 400;
const STOCK_COLLECTIONS = ["raw_materials", "semi_finished_materials", "products"];
const INVENTORY_LOG_COLLECTION = "inventory_logs";

const safeTrim = (value) => String(value || "").trim();

const buildDocItem = (itemDoc) => ({
  id: itemDoc.id,
  ref: itemDoc.ref,
  ...itemDoc.data(),
});

const readCollectionDocs = async (collectionName) => {
  const snapshot = await getDocs(collection(db, collectionName));
  return snapshot.docs.map(buildDocItem);
};

const hasVariants = (item = {}) => Array.isArray(item.variants) && item.variants.length > 0;

const buildVariantKey = (variant = {}, index = 0) =>
  safeTrim(variant.variantKey || variant.id || variant.sku || variant.variantCode || variant.name || variant.variantName || variant.color || `variant-${index}`);

// -----------------------------------------------------------------------------
// ACTIVE / FINAL: kalkulasi stok turunan untuk dry run/repair stok umum.
// Service maintenance ini tidak membuat inventory log dan tidak mem-posting stok
// ulang; ia hanya menyamakan field turunan master dari data item/variant terbaru.
// -----------------------------------------------------------------------------
const buildSyncedStockFields = (item = {}) => {
  if (hasVariants(item)) {
    const variants = item.variants.map((variant, index) => {
      const currentStock = toNumber(variant.currentStock ?? variant.stock ?? 0);
      const reservedStock = toNumber(variant.reservedStock || 0);
      return {
        ...variant,
        variantKey: buildVariantKey(variant, index),
        currentStock,
        stock: currentStock,
        reservedStock,
        availableStock: calculateAvailableStock(currentStock, reservedStock),
      };
    });

    const currentStock = variants.reduce((sum, variant) => sum + toNumber(variant.currentStock), 0);
    const reservedStock = variants.reduce((sum, variant) => sum + toNumber(variant.reservedStock), 0);

    return {
      variants,
      currentStock,
      stock: currentStock,
      reservedStock,
      availableStock: calculateAvailableStock(currentStock, reservedStock),
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

const nearlyEqual = (left, right) => Math.abs(toNumber(left) - toNumber(right)) < 0.000001;

const buildStockAuditRow = ({ collectionName, item = {} }) => {
  const synced = buildSyncedStockFields(item);
  const issues = [];

  if (!nearlyEqual(item.stock, synced.stock)) issues.push("stock tidak sama dengan currentStock final");
  if (!nearlyEqual(item.currentStock, synced.currentStock)) issues.push("currentStock tidak sama dengan total variant/current value");
  if (!nearlyEqual(item.reservedStock, synced.reservedStock)) issues.push("reservedStock tidak sama dengan total reserved variant");
  if (!nearlyEqual(item.availableStock, synced.availableStock)) issues.push("availableStock tidak sama dengan currentStock - reservedStock");

  if (hasVariants(item)) {
    (item.variants || []).forEach((variant, index) => {
      if (!safeTrim(variant.variantKey)) issues.push(`variant #${index + 1} belum punya variantKey`);
      if (!nearlyEqual(variant.stock, toNumber(variant.currentStock ?? variant.stock ?? 0))) {
        issues.push(`variant #${index + 1} stock/currentStock tidak sinkron`);
      }
    });
  }

  const category = issues.length ? "safe_repair" : "ok";

  return {
    key: `${collectionName}-${item.id}`,
    collectionName,
    recordId: item.id,
    itemName: safeTrim(item.name || item.productName || item.materialName || item.code || item.id),
    hasVariants: hasVariants(item),
    category,
    issue: issues.join("; "),
    recommendation: issues.length
      ? "Aman repair field stok turunan tanpa membuat mutasi stok baru."
      : "Stok sudah sinkron.",
    payload: issues.length ? synced : null,
  };
};

const buildSummary = (rows = []) => ({
  checkedRecords: rows.length,
  okCount: rows.filter((row) => row.category === "ok").length,
  safeRepairCount: rows.filter((row) => row.category === "safe_repair").length,
  displayRepairCount: 0,
  resetManualCount: 0,
  executablePlanCount: rows.filter((row) => row.payload).length,
});

export const getInventoryStockMaintenanceAudit = async () => {
  const rows = [];

  for (const collectionName of STOCK_COLLECTIONS) {
    const docs = await readCollectionDocs(collectionName);
    docs.forEach((item) => rows.push(buildStockAuditRow({ collectionName, item })));
  }

  return {
    generatedAt: new Date().toISOString(),
    rows: rows.map(({ payload, ...row }) => row),
    summary: buildSummary(rows),
  };
};

export const repairInventoryStockMaintenance = async () => {
  const rowsWithPayload = [];

  for (const collectionName of STOCK_COLLECTIONS) {
    const docs = await readCollectionDocs(collectionName);
    docs.forEach((item) => rowsWithPayload.push(buildStockAuditRow({ collectionName, item })));
  }

  const plans = rowsWithPayload.filter((row) => row.payload);
  let batch = writeBatch(db);
  let operationCount = 0;
  let updatedCount = 0;

  for (const plan of plans) {
    batch.update(doc(db, plan.collectionName, plan.recordId), {
      ...plan.payload,
      stockMaintenanceSyncedAt: serverTimestamp(),
    });
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
    message: `Repair stok umum selesai. ${updatedCount} item disinkronkan tanpa posting stok ulang.`,
    updatedCount,
    summary: buildSummary(rowsWithPayload),
  };
};

const inferStockSourceType = (log = {}) => {
  const variantKey = safeTrim(log.variantKey || log.details?.variantKey || log.materialVariantId || log.details?.materialVariantId);
  return variantKey ? "variant" : safeTrim(log.stockSourceType || log.details?.stockSourceType || "master");
};

const buildInventoryLogSchemaPayload = (log = {}) => {
  const variantKey = safeTrim(log.variantKey || log.details?.variantKey || log.materialVariantId || log.details?.materialVariantId);
  const variantLabel = safeTrim(log.variantLabel || log.details?.variantLabel || log.materialVariantName || log.details?.materialVariantName);
  const stockSourceType = inferStockSourceType(log);
  const payload = {};

  if (variantKey && safeTrim(log.variantKey) !== variantKey) payload.variantKey = variantKey;
  if (variantLabel && safeTrim(log.variantLabel) !== variantLabel) payload.variantLabel = variantLabel;
  if (safeTrim(log.stockSourceType) !== stockSourceType) payload.stockSourceType = stockSourceType;

  return Object.keys(payload).length ? payload : null;
};

export const getInventoryLogSchemaAudit = async () => {
  const logs = await readCollectionDocs(INVENTORY_LOG_COLLECTION);
  const rows = logs.map((log) => {
    const payload = buildInventoryLogSchemaPayload(log);
    return {
      key: log.id,
      recordId: log.id,
      type: safeTrim(log.type || log.actionType || "log"),
      itemName: safeTrim(log.itemName || log.name || log.details?.itemName || "-"),
      category: payload ? "display_repair" : "ok",
      issue: payload ? "schema varian log belum memakai field final" : "Schema log sudah sesuai.",
      recommendation: payload
        ? "Aman repair schema/display log tanpa mengubah qty atau stok."
        : "Tidak perlu repair.",
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    rows,
    summary: {
      checkedRecords: rows.length,
      okCount: rows.filter((row) => row.category === "ok").length,
      safeRepairCount: 0,
      displayRepairCount: rows.filter((row) => row.category === "display_repair").length,
      resetManualCount: 0,
      executablePlanCount: rows.filter((row) => row.category === "display_repair").length,
    },
  };
};

export const repairInventoryLogSchema = async () => {
  const logs = await readCollectionDocs(INVENTORY_LOG_COLLECTION);
  const plans = logs
    .map((log) => ({ log, payload: buildInventoryLogSchemaPayload(log) }))
    .filter((plan) => plan.payload);

  let batch = writeBatch(db);
  let operationCount = 0;
  let updatedCount = 0;

  for (const plan of plans) {
    batch.update(plan.log.ref, {
      ...plan.payload,
      schemaMaintenanceSyncedAt: serverTimestamp(),
    });
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
    message: `Repair schema inventory log selesai. ${updatedCount} log diperbarui tanpa mengubah qty.`,
    updatedCount,
    summary: {
      checkedRecords: logs.length,
      displayRepairCount: updatedCount,
      executablePlanCount: updatedCount,
    },
  };
};
