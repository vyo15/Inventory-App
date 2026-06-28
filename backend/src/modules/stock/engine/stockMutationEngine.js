const crypto = require("crypto");
const { createAuditLog } = require("../../../utils/auditLog");
const {
  getSourceTypeForTable,
  matchesVariantReference,
  normalizeText,
  nowIso,
  resolveInventoryVariantCollection,
  toInteger,
} = require("./stockSourceRegistry");
const {
  assertStockSnapshotValid,
  buildVariantHistoryEntry,
  createInventoryGuardError,
  getStockSnapshot,
  getVariantDisplayName,
  isStockSnapshotEmpty,
  removeArchiveMetadata,
  removeArchivedVariant,
} = require("./stockVariantDomain");
const {
  insertEventRecord,
  loadSourceItem,
  upsertJsonRecord,
  upsertStockReadModel,
} = require("./stockPersistence");

const applyStockDeltaToPayload = (payload = {}, {
  deltaCurrent = 0,
  variantKey = "",
  allowInactiveVariant = false,
  allowArchivedVariantRestore = false,
  actor = "system",
  overrideReason = "",
} = {}) => {
  const delta = toInteger(deltaCurrent);
  const resolvedVariants = resolveInventoryVariantCollection(payload);
  const normalizedVariantKey = normalizeText(variantKey).toLowerCase();
  const archivedVariants = Array.isArray(payload.archivedVariants) ? payload.archivedVariants : [];
  const archivedVariantMatch = normalizedVariantKey
    ? archivedVariants.find((variant) => matchesVariantReference(variant, normalizedVariantKey))
    : null;
  const restoresDisabledVariantMode = !resolvedVariants.hasVariants
    && Boolean(archivedVariantMatch)
    && allowArchivedVariantRestore;
  const hasVariants = resolvedVariants.hasVariants || restoresDisabledVariantMode;
  let nextPayload = { ...payload };

  if (restoresDisabledVariantMode && !isStockSnapshotEmpty(payload)) {
    throw createInventoryGuardError(
      "Varian arsip tidak dapat dipulihkan karena stok master non-varian sudah terisi. Kosongkan stok melalui flow resmi lebih dulu.",
      "INVENTORY_VARIANT_MODE_RESTORE_BLOCKED",
      409,
    );
  }

  if (hasVariants && !normalizedVariantKey) {
    throw new Error("Item memiliki varian. Pilih varian agar mutasi stok masuk ke sumber yang benar.");
  }

  if (hasVariants && normalizedVariantKey) {
    const sourceVariants = resolvedVariants.variants;
    let found = false;
    let reactivatedVariant = null;
    const nextVariants = sourceVariants.map((variant) => {
      if (!matchesVariantReference(variant, normalizedVariantKey)) return variant;
      found = true;
      if ((variant.isActive === false || variant.isArchived === true) && !allowInactiveVariant) {
        throw createInventoryGuardError(
          `Varian ${getVariantDisplayName(variant)} tidak aktif dan tidak boleh dimutasi lewat transaksi normal.`,
          "INVENTORY_VARIANT_INACTIVE",
          409,
        );
      }
      const before = assertStockSnapshotValid(variant, `Stok varian ${getVariantDisplayName(variant)}`);
      if (delta < 0 && Math.abs(delta) > before.availableStock) {
        throw createInventoryGuardError(
          `Stok tersedia varian ${getVariantDisplayName(variant)} tidak mencukupi. Tersedia ${before.availableStock}.`,
          "INVENTORY_AVAILABLE_STOCK_INSUFFICIENT",
          409,
        );
      }
      const currentStock = before.currentStock + delta;
      const reservedStock = before.reservedStock;
      const after = assertStockSnapshotValid(
        { currentStock, reservedStock },
        `Stok varian ${getVariantDisplayName(variant)}`,
      );
      const nextVariant = {
        ...variant,
        ...after,
        isActive: allowInactiveVariant ? true : variant.isActive !== false,
        isArchived: false,
        updatedAt: nowIso(),
      };
      if ((variant.isActive === false || variant.isArchived === true) && allowInactiveVariant) {
        nextVariant.restoredAt = nowIso();
        nextVariant.restoredBy = actor;
        nextVariant.restoreReason = overrideReason || "Varian dipulihkan oleh transaksi historis yang sah.";
        reactivatedVariant = nextVariant;
      }
      return nextVariant;
    });

    if (reactivatedVariant) {
      nextPayload.variantModeHistory = [
        ...(Array.isArray(payload.variantModeHistory) ? payload.variantModeHistory : []),
        buildVariantHistoryEntry("variant_reactivated_by_stock_mutation", {
          actor,
          now: nowIso(),
          reason: reactivatedVariant.restoreReason,
          variant: reactivatedVariant,
        }),
      ].slice(-50);
    }

    if (!found) {
      const archivedVariant = archivedVariantMatch;
      if (
        archivedVariant
        && allowArchivedVariantRestore
        && delta > 0
        && isStockSnapshotEmpty(archivedVariant)
      ) {
        const restoredBase = removeArchiveMetadata(archivedVariant);
        const restoredStock = assertStockSnapshotValid(
          { currentStock: delta, reservedStock: 0 },
          `Stok varian ${getVariantDisplayName(archivedVariant)}`,
        );
        const restoredVariant = {
          ...restoredBase,
          ...restoredStock,
          isActive: true,
          isArchived: false,
          restoredAt: nowIso(),
          restoredBy: actor,
          restoreReason: overrideReason || "Varian dipulihkan oleh transaksi historis yang sah.",
          updatedAt: nowIso(),
        };
        nextVariants.push(restoredVariant);
        nextPayload.archivedVariants = removeArchivedVariant(archivedVariants, archivedVariant);
        nextPayload.variantModeHistory = [
          ...(Array.isArray(payload.variantModeHistory) ? payload.variantModeHistory : []),
          buildVariantHistoryEntry("variant_restored_by_stock_mutation", {
            actor,
            now: nowIso(),
            reason: restoredVariant.restoreReason,
            variant: restoredVariant,
          }),
        ].slice(-50);
        found = true;
      }
    }

    if (!found) {
      throw createInventoryGuardError(
        "Varian stok tidak ditemukan. Mutasi dibatalkan agar stok tidak masuk ke master/default.",
        "INVENTORY_VARIANT_NOT_FOUND",
        409,
      );
    }

    const normalizedNextVariants = nextVariants.map((variant) => ({
      ...variant,
      ...assertStockSnapshotValid(variant, `Stok varian ${getVariantDisplayName(variant)}`),
    }));
    const totals = normalizedNextVariants.reduce((acc, variant) => {
      const stock = getStockSnapshot(variant);
      acc.currentStock += stock.currentStock;
      acc.reservedStock += stock.reservedStock;
      acc.availableStock += stock.availableStock;
      return acc;
    }, { currentStock: 0, reservedStock: 0, availableStock: 0 });

    nextPayload = {
      ...nextPayload,
      variants: normalizedNextVariants,
      variantOptions: resolvedVariants.mirrorVariantOptions ? normalizedNextVariants : payload.variantOptions,
      hasVariants: true,
      hasVariantOptions: resolvedVariants.mirrorVariantOptions ? true : payload.hasVariantOptions,
      variantCount: normalizedNextVariants.length,
      activeVariantCount: normalizedNextVariants.filter(
        (variant) => variant.isActive !== false && variant.isArchived !== true,
      ).length,
      currentStock: totals.currentStock,
      stock: totals.currentStock,
      reservedStock: totals.reservedStock,
      availableStock: totals.availableStock,
      updatedAt: nowIso(),
    };
  } else {
    if (normalizedVariantKey) {
      throw createInventoryGuardError(
        "Item tidak memiliki varian. Hapus pilihan varian sebelum memproses transaksi.",
        "INVENTORY_VARIANT_UNEXPECTED",
        409,
      );
    }
    const before = assertStockSnapshotValid(payload, "Stok master");
    if (delta < 0 && Math.abs(delta) > before.availableStock) {
      throw createInventoryGuardError(
        `Stok tersedia tidak mencukupi. Tersedia ${before.availableStock}.`,
        "INVENTORY_AVAILABLE_STOCK_INSUFFICIENT",
        409,
      );
    }
    const after = assertStockSnapshotValid(
      { currentStock: before.currentStock + delta, reservedStock: before.reservedStock },
      "Stok master",
    );
    nextPayload = {
      ...nextPayload,
      ...after,
      updatedAt: nowIso(),
    };
  }

  return nextPayload;
};

const commitStockMutation = async (db, {
  sourceType,
  sourceId,
  deltaCurrent,
  variantKey = "",
  referenceNumber = "",
  reason = "manual_adjustment",
  notes = "",
  actor = "system",
  transactionType = "stock_adjustment",
  transactionPayload = {},
  allowInactiveSource = false,
  allowInactiveVariant = false,
  allowArchivedVariantRestore = false,
  inactiveOverrideReason = "",
} = {}) => {
  if (!sourceId) throw new Error("Source ID stok wajib tersedia.");
  const delta = toInteger(deltaCurrent);
  if (delta === 0) throw new Error("Qty mutasi stok tidak boleh 0.");

  const { tableName, payload } = await loadSourceItem(db, sourceType, sourceId);
  const sourceInactive = payload.isActive === false
    || ["inactive", "archived"].includes(normalizeText(payload.status).toLowerCase());
  if (sourceInactive && !allowInactiveSource) {
    throw createInventoryGuardError(
      "Master inventory tidak aktif dan tidak boleh dimutasi lewat transaksi normal.",
      "INVENTORY_SOURCE_INACTIVE",
      409,
    );
  }
  if (sourceInactive && allowInactiveSource && !normalizeText(inactiveOverrideReason)) {
    throw createInventoryGuardError(
      "Override mutasi master nonaktif wajib memiliki alasan internal.",
      "INVENTORY_INACTIVE_OVERRIDE_REASON_REQUIRED",
      500,
    );
  }
  const normalizedVariantReference = normalizeText(variantKey).toLowerCase();
  const variantsBeforeMutation = resolveInventoryVariantCollection(payload).variants;
  const targetVariantBeforeMutation = normalizedVariantReference
    ? variantsBeforeMutation.find((variant) => matchesVariantReference(variant, normalizedVariantReference))
    : null;
  const archivedVariantBeforeMutation = normalizedVariantReference
    ? (Array.isArray(payload.archivedVariants) ? payload.archivedVariants : []).find(
      (variant) => matchesVariantReference(variant, normalizedVariantReference),
    )
    : null;
  const variantOverrideApplied = Boolean(
    (targetVariantBeforeMutation
      && (targetVariantBeforeMutation.isActive === false || targetVariantBeforeMutation.isArchived === true))
    || (!targetVariantBeforeMutation && archivedVariantBeforeMutation && allowArchivedVariantRestore),
  );
  const inactiveOverrideApplied = sourceInactive || variantOverrideApplied;
  const appliedOverrideReason = inactiveOverrideApplied ? inactiveOverrideReason : "";

  const beforeStock = toInteger(payload.currentStock ?? payload.stock ?? 0);
  const nextPayload = applyStockDeltaToPayload(payload, {
    deltaCurrent: delta,
    variantKey,
    allowInactiveVariant,
    allowArchivedVariantRestore,
    actor,
    overrideReason: appliedOverrideReason,
  });
  const afterStock = toInteger(nextPayload.currentStock ?? nextPayload.stock ?? 0);
  await upsertJsonRecord(db, tableName, nextPayload);
  const stockReadModel = await upsertStockReadModel(db, nextPayload, {
    sourceType: getSourceTypeForTable(tableName),
    sourceCollection: tableName,
    lastSyncedFrom: `sqlite_stock_engine.${transactionType}`,
  });

  const ref = normalizeText(referenceNumber);
  if (!ref) {
    throw createInventoryGuardError(
      "Referensi mutasi stok wajib dibuat oleh service transaksi resmi.",
      "INVENTORY_REFERENCE_REQUIRED",
      500,
    );
  }
  const eventBase = {
    referenceNumber: ref,
    code: ref,
    sourceType: getSourceTypeForTable(tableName),
    sourceCollection: tableName,
    sourceId,
    itemId: sourceId,
    itemName: nextPayload.name || payload.name || "",
    variantKey: variantKey || "",
    deltaCurrent: delta,
    quantity: Math.abs(delta),
    beforeStock,
    afterStock,
    reason,
    notes,
    transactionType,
    inactiveOverride: inactiveOverrideApplied,
    inactiveOverrideReason: appliedOverrideReason,
    ...transactionPayload,
  };

  await insertEventRecord(db, "inventory_logs", {
    ...eventBase,
    id: `log_${ref}_${crypto.randomUUID()}`,
    name: `Log ${ref}`,
    type: delta >= 0 ? "stock_in" : "stock_out",
  });

  await createAuditLog({
    module: "stock",
    action: transactionType,
    entityType: getSourceTypeForTable(tableName),
    entityId: sourceId,
    actor,
    description: `Stock ${nextPayload.name || sourceId} berubah ${delta}`,
    metadata: {
      referenceNumber: ref,
      beforeStock,
      afterStock,
      deltaCurrent: delta,
      variantKey,
      reason,
      inactiveOverride: inactiveOverrideApplied,
      inactiveOverrideReason: appliedOverrideReason,
    },
  });

  return {
    referenceNumber: ref,
    item: nextPayload,
    stockReadModel,
    beforeStock,
    afterStock,
    deltaCurrent: delta,
    inactiveOverrideApplied,
  };
};


module.exports = { applyStockDeltaToPayload, commitStockMutation };
