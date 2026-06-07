// =====================================================
// Reset Maintenance Data Service Helpers — GUARDED
//
// Behavior-preserving extraction dari resetMaintenanceDataService.js.
// Helper di file ini hanya pure formatter/validator/builder dan tidak boleh
// melakukan database read/write, delete/reset, route/menu change, atau schema change.
// =====================================================

import { calculateAvailableStock, toNumber } from "../../../utils/stock/stockHelpers";
import {
  HPP_COST_COLLECTION_CONFIGS,
  HPP_COST_RESET_MODE_CONFIG,
  HPP_COST_RESET_OPTIONS,
  HPP_COST_VARIANT_FIELD_KEYS,
  MASTER_DATA_OPENING_STOCK_COLLECTIONS,
  PROTECTED_COLLECTION_KEYS,
  RESET_ALLOWED_DELETE_COLLECTIONS,
  SAFE_CLIENT_BATCH_OPERATION_LIMIT,
  STOCK_COLLECTION_KEYS,
  VALID_HPP_COST_RESET_MODES,
  VALID_RESET_MODES,
} from "../config/resetMaintenanceDataConfig";

export const safeTrim = (value) => String(value || "").trim();

export const normalizeType = (value) => safeTrim(value).toLowerCase();

export const hasTruthyReference = (value) => Boolean(safeTrim(value));

export const isProtectedCollection = (collectionKey) => PROTECTED_COLLECTION_KEYS.has(collectionKey);

export const isResetDeleteAllowedCollection = (collectionKey) => RESET_ALLOWED_DELETE_COLLECTIONS.has(collectionKey);

export const assertValidResetMode = (resetMode) => {
  if (!VALID_RESET_MODES.has(resetMode)) {
    throw new Error("Mode reset tidak valid. Pilih mode reset dari opsi yang tersedia.");
  }
};

export const assertResetTargetsSafe = (targets = []) => {
  const protectedTargets = targets.filter((target) => isProtectedCollection(target.key));
  if (protectedTargets.length) {
    throw new Error(`Reset dibatalkan karena target berisi protected master data: ${protectedTargets.map((item) => item.key).join(", ")}.`);
  }

  const unknownTargets = targets.filter((target) => !isResetDeleteAllowedCollection(target.key));
  if (unknownTargets.length) {
    throw new Error(`Reset dibatalkan karena collection belum masuk allowlist rules reset: ${unknownTargets.map((item) => item.key).join(", ")}.`);
  }
};

export const assertClientBatchOperationLimit = (operationCount = 0) => {
  if (operationCount > SAFE_CLIENT_BATCH_OPERATION_LIMIT) {
    throw new Error(
      `Reset dibatalkan karena ada ${operationCount} operasi tulis, melebihi batas aman ${SAFE_CLIENT_BATCH_OPERATION_LIMIT} operasi dari browser. Perkecil scope modul atau gunakan jalur maintenance/server terpisah agar tidak partial delete.`,
    );
  }
};

export const hasOwnField = (item = {}, fieldName = "") => Object.prototype.hasOwnProperty.call(item, fieldName);

export const pickExistingFields = (item = {}, fieldNames = []) => fieldNames.filter((fieldName) => hasOwnField(item, fieldName));

export const getVariantIdentity = (variant = {}, index = 0) => safeTrim(
  variant.variantKey ||
  variant.id ||
  variant.sku ||
  variant.variantCode ||
  variant.variantName ||
  variant.name ||
  variant.label ||
  variant.color ||
  `variant-${index}`
);

export const normalizeExportValue = (value) => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value !== "object") return value;

  if (typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return value;
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeExportValue(item));
  }

  return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
    if (typeof entryValue !== "function") {
      accumulator[key] = normalizeExportValue(entryValue);
    }
    return accumulator;
  }, {});
};

export const normalizeExportDocument = (snapshotDoc) => ({
  id: snapshotDoc.id,
  ...normalizeExportValue(snapshotDoc.data() || {}),
});

const getOpeningStockUnit = (item = {}) => safeTrim(
  item.stockUnit ||
  item.unit ||
  item.baseUnit ||
  item.purchaseUnit ||
  item.salesUnit ||
  "pcs"
);

const getOpeningStockName = (item = {}) => safeTrim(
  item.name ||
  item.productName ||
  item.materialName ||
  item.itemName ||
  item.displayName ||
  item.code ||
  "Tanpa nama"
);

const buildOpeningStockVariantRows = ({ collectionKey, label, item = {} }) => {
  const variants = Array.isArray(item.variants) ? item.variants : [];
  const unit = getOpeningStockUnit(item);

  return variants
    .filter((variant) => variant && variant.isActive !== false && variant.isArchived !== true)
    .map((variant, index) => {
      const currentStock = toNumber(variant.currentStock ?? variant.stock ?? 0);
      const reservedStock = toNumber(variant.reservedStock ?? 0);
      const availableStock = toNumber(variant.availableStock ?? calculateAvailableStock(currentStock, reservedStock));

      return {
        collection: collectionKey,
        collectionLabel: label,
        itemId: item.id,
        itemCode: safeTrim(item.code || item.sku || ""),
        itemName: getOpeningStockName(item),
        variantKey: getVariantIdentity(variant, index),
        variantLabel: safeTrim(variant.variantLabel || variant.label || variant.name || variant.variantName || getVariantIdentity(variant, index)),
        currentStock,
        reservedStock,
        availableStock,
        unit,
        isVariant: true,
      };
    });
};

const buildOpeningStockMasterRow = ({ collectionKey, label, item = {} }) => {
  const currentStock = toNumber(item.currentStock ?? item.stock ?? 0);
  const reservedStock = toNumber(item.reservedStock ?? 0);
  const availableStock = toNumber(item.availableStock ?? calculateAvailableStock(currentStock, reservedStock));

  return {
    collection: collectionKey,
    collectionLabel: label,
    itemId: item.id,
    itemCode: safeTrim(item.code || item.sku || ""),
    itemName: getOpeningStockName(item),
    variantKey: null,
    variantLabel: null,
    currentStock,
    reservedStock,
    availableStock,
    unit: getOpeningStockUnit(item),
    isVariant: false,
  };
};

export const buildOpeningStockRowsFromExportData = (collections = []) => collections.flatMap((collectionItem) => {
  if (!MASTER_DATA_OPENING_STOCK_COLLECTIONS.has(collectionItem.collection)) {
    return [];
  }

  return (collectionItem.records || []).flatMap((item) => {
    const hasActiveVariants = Array.isArray(item.variants) && item.variants.some(
      (variant) => variant && variant.isActive !== false && variant.isArchived !== true,
    );

    if (hasActiveVariants) {
      return buildOpeningStockVariantRows({ collectionKey: collectionItem.collection, label: collectionItem.label, item });
    }

    return [buildOpeningStockMasterRow({ collectionKey: collectionItem.collection, label: collectionItem.label, item })];
  });
});

// =====================================================
// Modal/HPP + stock reset pure builders — GUARDED
// Phase 2 extraction: helper ini hanya validasi/builder payload pure.
// database read/write, reset destructive, dan baseline restore tetap di service utama.
// =====================================================

export const getHppCostResetOption = (resetMode) => HPP_COST_RESET_OPTIONS.find((item) => item.value === resetMode) || null;


export const assertValidHppCostResetMode = (resetMode) => {
  if (!VALID_HPP_COST_RESET_MODES.has(resetMode)) {
    throw new Error("Mode reset modal/HPP tidak valid. Pilih mode dari opsi HPP Cost Testing.");
  }
};


export const getHppCostResetCollectionConfigs = (resetMode) => {
  assertValidHppCostResetMode(resetMode);
  return HPP_COST_RESET_MODE_CONFIG[resetMode]?.collections || [];
};


export const buildVariantCostSnapshotRows = (variants = [], variantFields = []) => (
  Array.isArray(variants)
    ? variants.map((variant = {}, index) => {
      const fields = pickExistingFields(variant, variantFields);
      if (!fields.length) return null;

      return {
        index,
        variantKey: getVariantIdentity(variant, index),
        fields: fields.reduce((acc, fieldName) => {
          acc[fieldName] = variant[fieldName];
          return acc;
        }, {}),
      };
    }).filter(Boolean)
    : []
);


export const buildHppCostSnapshotItem = ({ collectionName, itemDoc, fields = [], variantFields = [] }) => {
  const data = itemDoc.data();
  const topLevelFields = pickExistingFields(data, fields);
  const variantRows = buildVariantCostSnapshotRows(data.variants, variantFields);

  if (!topLevelFields.length && !variantRows.length) return null;

  return {
    collectionName,
    itemId: itemDoc.id,
    costData: topLevelFields.reduce((acc, fieldName) => {
      acc[fieldName] = data[fieldName];
      return acc;
    }, {}),
    variantCostData: variantRows,
  };
};


export const buildHppCostPreviewRow = ({ itemDoc, fields = [], variantFields = [] }) => {
  const data = itemDoc.data();
  const topLevelFields = pickExistingFields(data, fields);
  const variantRows = buildVariantCostSnapshotRows(data.variants, variantFields);

  if (!topLevelFields.length && !variantRows.length) return null;

  return {
    id: itemDoc.id,
    name: data.name || data.materialName || data.productName || data.title || itemDoc.id,
    fields: topLevelFields,
    variantRows: variantRows.length,
    variantFields: Array.from(new Set(variantRows.flatMap((variant) => Object.keys(variant.fields || {})))),
  };
};



export const validateHppCostBaselineItemShape = (item = {}, index = 0) => {
  const collectionName = safeTrim(item.collectionName);
  const itemId = safeTrim(item.itemId);

  if (!HPP_COST_COLLECTION_CONFIGS[collectionName]) {
    throw new Error(`Baseline modal/HPP item #${index + 1} memakai collection tidak valid: ${collectionName || "(kosong)"}.`);
  }

  if (!itemId) {
    throw new Error(`Baseline modal/HPP item #${index + 1} tidak punya itemId. Restore baseline dibatalkan.`);
  }

  return {
    collectionName,
    itemId,
    costData: item.costData && typeof item.costData === "object" ? item.costData : {},
    variantCostData: Array.isArray(item.variantCostData) ? item.variantCostData : [],
  };
};


export const buildStockFieldsFromItem = (item = {}) => {
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


export const buildZeroStockFieldsFromItem = (item = {}) => {
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


export const validateBaselineItemShape = (item = {}, index = 0) => {
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


export const getWriteRefKey = (item = {}) => item.ref?.path || `${item.ref?.parent?.path || "unknown"}/${item.ref?.id || "unknown"}`;


export const mergeVariantStockAndCostRows = (stockVariants = [], hppCostVariants = []) => {
  if (!Array.isArray(stockVariants) || !Array.isArray(hppCostVariants)) return null;

  return stockVariants.map((stockVariant = {}, index) => {
    const hppVariant = hppCostVariants[index] || {};
    const hppCostFields = {};

    HPP_COST_VARIANT_FIELD_KEYS.forEach((fieldName) => {
      if (hasOwnField(hppVariant, fieldName)) {
        hppCostFields[fieldName] = hppVariant[fieldName];
      }
    });

    return {
      ...stockVariant,
      ...hppCostFields,
    };
  });
};


export const mergeUpdatePayloads = (currentPayload = {}, nextPayload = {}) => {
  const mergedPayload = {
    ...currentPayload,
    ...nextPayload,
  };

  if (Array.isArray(currentPayload.variants) && Array.isArray(nextPayload.variants)) {
    // Stock reset dan HPP reset sama-sama menyentuh field variants. Jangan shallow
    // overwrite, karena HPP payload membawa snapshot stok lama dan stock payload
    // membawa snapshot cost lama. Gabungkan hanya field HPP ke variant stok nol.
    mergedPayload.variants = mergeVariantStockAndCostRows(currentPayload.variants, nextPayload.variants);
  }

  return mergedPayload;
};


export const mergeUpdateOperations = (...operationGroups) => {
  const map = new Map();

  operationGroups.flat().filter(Boolean).forEach((item) => {
    if (!item.ref || !item.payload) return;

    const refKey = getWriteRefKey(item);
    const current = map.get(refKey);

    map.set(refKey, {
      ref: item.ref,
      payload: mergeUpdatePayloads(current?.payload || {}, item.payload),
    });
  });

  return Array.from(map.values());
};
