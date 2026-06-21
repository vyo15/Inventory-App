const crypto = require("crypto");
const { createAuditLog } = require("./auditLog");
const { safeJsonParse } = require("./jsonUtils");

const SOURCE_TABLES = Object.freeze({
  product: "products",
  products: "products",
  raw_material: "raw_materials",
  raw_materials: "raw_materials",
  material: "raw_materials",
  raw: "raw_materials",
  semi_finished: "semi_finished_materials",
  semi_finished_material: "semi_finished_materials",
  semi_finished_materials: "semi_finished_materials",
});

const SOURCE_TYPES = Object.freeze({
  products: "product",
  raw_materials: "raw_material",
  semi_finished_materials: "semi_finished",
});

const toInteger = (value = 0) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
};

const normalizeText = (value) => String(value ?? "").trim();
const nowIso = () => new Date().toISOString();

const resolveInventoryVariantCollection = (payload = {}) => {
  const variants = Array.isArray(payload.variants) ? payload.variants : [];
  const variantOptions = Array.isArray(payload.variantOptions) ? payload.variantOptions : [];
  const sourceVariants = variants.length > 0
    ? variants
    : variantOptions.length > 0
      ? variantOptions
      : [];

  return {
    variants: sourceVariants,
    hasVariants: payload.hasVariants === true
      || payload.hasVariantOptions === true
      || sourceVariants.length > 0,
    mirrorVariantOptions: payload.hasVariantOptions === true
      || Array.isArray(payload.variantOptions),
  };
};


const getTableForSourceType = (sourceType = "") => {
  const tableName = SOURCE_TABLES[String(sourceType || "").trim().toLowerCase()];
  if (!tableName) {
    throw new Error("Stock engine database lokal hanya mendukung Product, Raw Material, dan Semi Finished.");
  }
  return tableName;
};

const getSourceTypeForTable = (tableName = "") => SOURCE_TYPES[tableName] || "product";

const toRowPayload = (row = {}) => ({
  ...safeJsonParse(row.payload_json, {}),
  id: row.id,
  code: row.code || "",
  name: row.name || "",
  status: row.status || "active",
  isActive: row.is_active === 0 ? false : true,
  currentStock: row.current_stock ?? 0,
  stock: row.current_stock ?? 0,
  reservedStock: row.reserved_stock ?? 0,
  availableStock: row.available_stock ?? 0,
  minStockAlert: row.min_stock_alert ?? 0,
});

const getVariantReferenceTokens = (variant = {}) => Array.from(new Set([
  variant.variantKey,
  variant.key,
  variant.id,
  variant.variantId,
  variant.variantCode,
  variant.code,
  variant.sku,
  variant.variantLabel,
  variant.label,
  variant.variantName,
  variant.color,
  variant.name,
].map((value) => normalizeText(value).toLowerCase()).filter(Boolean)));

const matchesVariantReference = (variant = {}, reference = "") => {
  const normalizedReference = normalizeText(reference).toLowerCase();
  return Boolean(normalizedReference) && getVariantReferenceTokens(variant).includes(normalizedReference);
};

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

const extractColumns = (payload = {}) => {
  const currentStock = toInteger(payload.currentStock ?? payload.stock ?? 0);
  const reservedStock = toInteger(payload.reservedStock ?? 0);
  return {
    code: normalizeText(payload.code || payload.productCode || payload.materialCode || "").toUpperCase(),
    name: normalizeText(payload.name || payload.itemName || ""),
    status: normalizeText(payload.status || (payload.isActive === false ? "inactive" : "active")) || "active",
    isActive: payload.isActive === false || payload.status === "inactive" || payload.status === "deleted" ? 0 : 1,
    currentStock,
    reservedStock,
    availableStock: Math.max(currentStock - reservedStock, 0),
    minStockAlert: toInteger(payload.minStockAlert ?? payload.minStock ?? 0),
  };
};

const upsertJsonRecord = async (db, tableName, payload = {}) => {
  const id = normalizeText(payload.id || payload.code || crypto.randomUUID());
  const columns = extractColumns({ ...payload, id });
  const existing = await db.get(`SELECT id FROM ${tableName} WHERE id = ?`, [id]);
  const finalPayload = {
    ...payload,
    id,
    currentStock: columns.currentStock,
    stock: columns.currentStock,
    reservedStock: columns.reservedStock,
    availableStock: columns.availableStock,
    updatedAt: payload.updatedAt || nowIso(),
  };

  if (existing) {
    await db.run(
      `UPDATE ${tableName}
       SET code = ?, name = ?, status = ?, is_active = ?, current_stock = ?, reserved_stock = ?, available_stock = ?, min_stock_alert = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [columns.code, columns.name, columns.status, columns.isActive, columns.currentStock, columns.reservedStock, columns.availableStock, columns.minStockAlert, JSON.stringify(finalPayload), id]
    );
  } else {
    await db.run(
      `INSERT INTO ${tableName} (id, code, name, status, is_active, current_stock, reserved_stock, available_stock, min_stock_alert, payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, columns.code, columns.name, columns.status, columns.isActive, columns.currentStock, columns.reservedStock, columns.availableStock, columns.minStockAlert, JSON.stringify({ ...finalPayload, createdAt: finalPayload.createdAt || nowIso() })]
    );
  }

  const row = await db.get(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
  return toRowPayload(row);
};

const upsertStockReadModel = async (db, itemPayload = {}, { sourceType, sourceCollection, lastSyncedFrom = "sqlite_stock_engine" } = {}) => {
  const sourceId = normalizeText(itemPayload.id);
  const resolvedSourceType = sourceType || getSourceTypeForTable(sourceCollection);
  const id = `${resolvedSourceType}__${sourceId}`;
  const currentStock = toInteger(itemPayload.currentStock ?? itemPayload.stock ?? 0);
  const reservedStock = toInteger(itemPayload.reservedStock ?? 0);
  const resolvedVariants = resolveInventoryVariantCollection(itemPayload);
  const normalizedVariants = resolvedVariants.variants.map((variant) => ({
    ...variant,
    ...assertStockSnapshotValid(variant, `Stok varian ${getVariantDisplayName(variant)}`),
  }));
  const payload = {
    id,
    code: itemPayload.code || itemPayload.productCode || itemPayload.materialCode || id,
    name: itemPayload.name || "",
    sourceType: resolvedSourceType,
    sourceCollection,
    sourceId,
    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock: Math.max(currentStock - reservedStock, 0),
    minStockAlert: toInteger(itemPayload.minStockAlert ?? itemPayload.minStock ?? 0),
    variants: normalizedVariants,
    hasVariants: resolvedVariants.hasVariants,
    status: itemPayload.status || "active",
    isActive: itemPayload.isActive !== false,
    lastSyncedFrom,
    syncedAt: nowIso(),
  };
  return upsertJsonRecord(db, "stock_read_models", payload);
};

const INVENTORY_STOCK_FIELDS = Object.freeze([
  "stock",
  "currentStock",
  "reservedStock",
  "availableStock",
]);

const createInventoryGuardError = (
  publicMessage,
  errorCode = "INVENTORY_MASTER_GUARD_REJECTED",
  statusCode = 409,
) => {
  const error = new Error(publicMessage);
  error.publicMessage = publicMessage;
  error.errorCode = errorCode;
  error.statusCode = statusCode;
  return error;
};

const normalizeVariantToken = (value = "") => normalizeText(value)
  .toLowerCase()
  .replace(/\s+/g, " ");

const getVariantRawDisplayName = (variant = {}) => normalizeText(
  variant.variantLabel
    || variant.label
    || variant.variantName
    || variant.name
    || variant.color
    || variant.variantCode
    || variant.code
    || variant.sku
    || "",
);

const getVariantDisplayName = (variant = {}) => normalizeText(
  getVariantRawDisplayName(variant) || variant.variantKey || "Varian",
);

const assertVariantIdentityPresent = (variant = {}) => {
  const label = getVariantRawDisplayName(variant);
  if (!label) {
    throw createInventoryGuardError(
      "Nama/kode varian wajib diisi.",
      "INVENTORY_VARIANT_NAME_REQUIRED",
      400,
    );
  }
  return label;
};

const getVariantCode = (variant = {}) => normalizeText(
  variant.variantCode || variant.code || variant.sku || "",
);

const getVariantIdentityTokens = (variant = {}) => {
  const key = normalizeVariantToken(variant.variantKey || variant.key || variant.id || variant.variantId || "");
  const code = normalizeVariantToken(getVariantCode(variant));
  const label = normalizeVariantToken(getVariantDisplayName(variant));
  return Array.from(new Set([
    key ? `key:${key}` : "",
    code ? `code:${code}` : "",
    label ? `label:${label}` : "",
  ].filter(Boolean)));
};

const getCanonicalVariantSignature = (variant = {}) => {
  const label = normalizeVariantToken(getVariantDisplayName(variant));
  const code = normalizeVariantToken(getVariantCode(variant));
  return label || code ? `${label}|${code}` : normalizeVariantToken(variant.variantKey || "");
};

const getStockSnapshot = (value = {}) => {
  const currentStock = toInteger(value.currentStock ?? value.stock ?? 0);
  const reservedStock = toInteger(value.reservedStock ?? 0);
  return {
    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock: Math.max(currentStock - reservedStock, 0),
  };
};

const assertStockSnapshotValid = (value = {}, label = "Stok") => {
  const snapshot = getStockSnapshot(value);
  if (snapshot.currentStock < 0 || snapshot.reservedStock < 0) {
    throw createInventoryGuardError(
      `${label} tidak boleh bernilai negatif.`,
      "INVENTORY_STOCK_NEGATIVE",
      400,
    );
  }
  if (snapshot.reservedStock > snapshot.currentStock) {
    throw createInventoryGuardError(
      `${label} reserved tidak boleh melebihi current stock.`,
      "INVENTORY_RESERVED_EXCEEDS_CURRENT",
      400,
    );
  }
  return snapshot;
};

const isStockSnapshotEmpty = (value = {}) => {
  const stock = getStockSnapshot(value);
  return stock.currentStock <= 0 && stock.reservedStock <= 0 && stock.availableStock <= 0;
};

const buildVariantKey = (variant = {}, index = 0, usedKeys = new Set()) => {
  const requested = normalizeVariantToken(variant.variantKey || "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const labelBase = normalizeVariantToken(getVariantCode(variant) || getVariantDisplayName(variant) || `variant-${index + 1}`)
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || `variant-${index + 1}`;
  const base = requested || labelBase;
  let candidate = base;
  let suffix = 2;
  while (usedKeys.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedKeys.add(candidate);
  return candidate;
};

const normalizeVariantForCreate = (variant = {}, index = 0, usedKeys = new Set()) => {
  const variantLabel = assertVariantIdentityPresent(variant);
  const stock = assertStockSnapshotValid(variant, `Stok varian ${variantLabel}`);
  if (variant.isActive === false && !isStockSnapshotEmpty(stock)) {
    throw createInventoryGuardError(
      `Varian ${getVariantDisplayName(variant)} yang memiliki stok tidak boleh dibuat nonaktif.`,
      "INVENTORY_VARIANT_INACTIVE_WITH_STOCK",
      409,
    );
  }
  const variantKey = buildVariantKey(variant, index, usedKeys);
  return {
    ...variant,
    ...stock,
    variantKey,
    variantLabel,
    isActive: variant.isActive !== false,
    isArchived: false,
  };
};

const calculateVariantTotals = (variants = []) => (Array.isArray(variants) ? variants : []).reduce(
  (totals, variant) => {
    const stock = getStockSnapshot(variant);
    totals.currentStock += stock.currentStock;
    totals.reservedStock += stock.reservedStock;
    totals.availableStock += stock.availableStock;
    return totals;
  },
  { currentStock: 0, reservedStock: 0, availableStock: 0 },
);

const assertNoDuplicateVariants = (variants = []) => {
  const keys = new Set();
  const signatures = new Set();
  for (const variant of variants) {
    if (variant?.isArchived === true) continue;
    const key = normalizeVariantToken(variant.variantKey || "");
    const signature = getCanonicalVariantSignature(variant);
    if ((key && keys.has(key)) || (signature && signatures.has(signature))) {
      throw createInventoryGuardError(
        `Varian ${getVariantDisplayName(variant)} duplikat. Gunakan nama/kode varian yang berbeda.`,
        "INVENTORY_VARIANT_DUPLICATE",
        409,
      );
    }
    if (key) keys.add(key);
    if (signature) signatures.add(signature);
  }
};

const buildVariantLookup = (variants = []) => {
  const lookup = new Map();
  (Array.isArray(variants) ? variants : []).forEach((variant) => {
    getVariantIdentityTokens(variant).forEach((token) => {
      if (!lookup.has(token)) lookup.set(token, variant);
    });
  });
  return lookup;
};

const findMatchingVariant = (variant = {}, lookup = new Map()) => getVariantIdentityTokens(variant)
  .map((token) => lookup.get(token))
  .find(Boolean) || null;

const removeArchiveMetadata = (variant = {}) => {
  const next = { ...variant };
  for (const field of ["archivedAt", "archivedBy", "archiveReason", "restoredAt", "restoredBy", "restoreReason"]) {
    delete next[field];
  }
  return next;
};

const buildArchivedVariant = (variant = {}, { actor, now, reason } = {}) => ({
  ...variant,
  ...getStockSnapshot(variant),
  isActive: false,
  isArchived: true,
  archivedAt: now,
  archivedBy: actor,
  archiveReason: reason,
});

const upsertArchivedVariant = (archivedVariants = [], variant = {}) => {
  const incomingTokens = new Set(getVariantIdentityTokens(variant));
  let replaced = false;
  const next = (Array.isArray(archivedVariants) ? archivedVariants : []).flatMap((item) => {
    const same = getVariantIdentityTokens(item).some((token) => incomingTokens.has(token));
    if (!same) return [item];
    if (replaced) return [];
    replaced = true;
    return [variant];
  });
  if (!replaced) next.push(variant);
  return next;
};

const removeArchivedVariant = (archivedVariants = [], variant = {}) => {
  const restoredTokens = new Set(getVariantIdentityTokens(variant));
  return (Array.isArray(archivedVariants) ? archivedVariants : []).filter(
    (item) => !getVariantIdentityTokens(item).some((token) => restoredTokens.has(token)),
  );
};

const buildVariantHistoryEntry = (action, { actor, now, reason, variant = {} } = {}) => ({
  action,
  at: now,
  by: actor,
  reason,
  variantKey: normalizeText(variant.variantKey || ""),
  variantLabel: getVariantDisplayName(variant),
});

const preserveFields = (target = {}, source = {}, fields = []) => {
  const next = { ...target };
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(source || {}, field)) next[field] = source[field];
    else delete next[field];
  }
  return next;
};

const mergeExistingVariant = (incoming = {}, existing = {}, protectedVariantFields = []) => {
  const stock = getStockSnapshot(existing);
  let next = {
    ...existing,
    ...incoming,
    ...stock,
    variantKey: existing.variantKey || incoming.variantKey,
    variantLabel: normalizeText(incoming.variantLabel || incoming.label || getVariantDisplayName(incoming) || getVariantDisplayName(existing)),
    isArchived: false,
  };
  next = preserveFields(next, existing, protectedVariantFields);
  return next;
};

const buildNewZeroStockVariant = (incoming = {}, index = 0, usedKeys = new Set(), protectedVariantFields = []) => {
  const variantLabel = assertVariantIdentityPresent(incoming);
  let next = {
    ...incoming,
    currentStock: 0,
    stock: 0,
    reservedStock: 0,
    availableStock: 0,
    variantKey: buildVariantKey({ ...incoming, variantKey: "" }, index, usedKeys),
    variantLabel,
    isActive: incoming.isActive !== false,
    isArchived: false,
  };
  for (const field of protectedVariantFields) next[field] = 0;
  return next;
};

const reconcileInventoryVariants = ({
  incomingVariants = [],
  existingVariants = [],
  archivedVariants = [],
  protectedVariantFields = [],
  actor = "system",
  now = nowIso(),
} = {}) => {
  const activeLookup = buildVariantLookup(existingVariants);
  const archivedLookup = buildVariantLookup(archivedVariants);
  const matchedExistingKeys = new Set();
  const usedKeys = new Set(
    existingVariants.map((variant) => normalizeVariantToken(variant.variantKey || "")).filter(Boolean),
  );
  let nextArchived = [...archivedVariants];
  const historyEntries = [];
  const nextActive = [];

  (Array.isArray(incomingVariants) ? incomingVariants : []).forEach((incoming, index) => {
    const existing = findMatchingVariant(incoming, activeLookup);
    if (existing) {
      const existingKey = normalizeVariantToken(existing.variantKey || getVariantDisplayName(existing));
      if (matchedExistingKeys.has(existingKey)) {
        throw createInventoryGuardError(
          `Varian ${getVariantDisplayName(existing)} dikirim lebih dari sekali. Gunakan satu baris untuk setiap variantKey.`,
          "INVENTORY_VARIANT_DUPLICATE",
          409,
        );
      }
      matchedExistingKeys.add(existingKey);
      const merged = mergeExistingVariant(incoming, existing, protectedVariantFields);

      if (merged.isActive === false) {
        if (!isStockSnapshotEmpty(existing)) {
          throw createInventoryGuardError(
            `Varian ${getVariantDisplayName(existing)} masih memiliki stok/reserved dan tidak boleh dinonaktifkan.`,
            "INVENTORY_VARIANT_DEACTIVATE_BLOCKED",
            409,
          );
        }
        const reason = "Varian dinonaktifkan dari edit master setelah stok 0.";
        const archived = buildArchivedVariant(merged, { actor, now, reason });
        nextArchived = upsertArchivedVariant(nextArchived, archived);
        historyEntries.push(buildVariantHistoryEntry("variant_archived", { actor, now, reason, variant: archived }));
        return;
      }

      nextActive.push(merged);
      return;
    }

    const archived = findMatchingVariant(incoming, archivedLookup);
    if (archived) {
      const restoredBase = removeArchiveMetadata(archived);
      let restored = {
        ...restoredBase,
        ...incoming,
        currentStock: 0,
        stock: 0,
        reservedStock: 0,
        availableStock: 0,
        variantKey: archived.variantKey || buildVariantKey(incoming, index, usedKeys),
        variantLabel: normalizeText(incoming.variantLabel || incoming.label || getVariantDisplayName(incoming)),
        isActive: true,
        isArchived: false,
        restoredAt: now,
        restoredBy: actor,
        restoreReason: "Varian lama direstore karena dibuat lagi dengan identitas yang sama.",
      };
      restored = preserveFields(restored, archived, protectedVariantFields);
      usedKeys.add(normalizeVariantToken(restored.variantKey));
      nextArchived = removeArchivedVariant(nextArchived, archived);
      historyEntries.push(buildVariantHistoryEntry("variant_restored", {
        actor,
        now,
        reason: restored.restoreReason,
        variant: restored,
      }));
      nextActive.push(restored);
      return;
    }

    nextActive.push(buildNewZeroStockVariant(incoming, index, usedKeys, protectedVariantFields));
  });

  existingVariants.forEach((existing) => {
    const existingKey = normalizeVariantToken(existing.variantKey || getVariantDisplayName(existing));
    if (matchedExistingKeys.has(existingKey)) return;
    if (!isStockSnapshotEmpty(existing)) {
      throw createInventoryGuardError(
        `Varian ${getVariantDisplayName(existing)} masih memiliki stok/reserved dan tidak boleh dihapus.`,
        "INVENTORY_VARIANT_REMOVE_BLOCKED",
        409,
      );
    }
    const reason = "Varian diarsipkan dari edit master setelah stok 0.";
    const archived = buildArchivedVariant(existing, { actor, now, reason });
    nextArchived = upsertArchivedVariant(nextArchived, archived);
    historyEntries.push(buildVariantHistoryEntry("variant_archived", { actor, now, reason, variant: archived }));
  });

  assertNoDuplicateVariants(nextActive);
  return { activeVariants: nextActive, archivedVariants: nextArchived, historyEntries };
};

const normalizeInventoryMasterCreate = (payload = {}, { preserveVariantOptions = false } = {}) => {
  const resolvedVariants = resolveInventoryVariantCollection(payload);
  const sourceVariants = resolvedVariants.variants;
  const { hasVariants } = resolvedVariants;
  const next = { ...payload };

  if (hasVariants) {
    const usedKeys = new Set();
    const variants = sourceVariants.map((variant, index) => normalizeVariantForCreate(variant, index, usedKeys));
    if (variants.length === 0) {
      throw createInventoryGuardError("Minimal satu varian wajib diisi.", "INVENTORY_VARIANT_REQUIRED", 400);
    }
    if (variants.every((variant) => variant.isActive === false || variant.isArchived === true)) {
      throw createInventoryGuardError(
        "Minimal satu varian aktif wajib tersedia saat membuat master bervarian.",
        "INVENTORY_ACTIVE_VARIANT_REQUIRED",
        400,
      );
    }
    assertNoDuplicateVariants(variants);
    const totals = calculateVariantTotals(variants);
    Object.assign(next, {
      variants,
      currentStock: totals.currentStock,
      stock: totals.currentStock,
      reservedStock: totals.reservedStock,
      availableStock: totals.availableStock,
      hasVariants: true,
      variantCount: variants.length,
      activeVariantCount: variants.filter((variant) => variant.isActive !== false).length,
    });
    if (preserveVariantOptions || Array.isArray(payload.variantOptions)) {
      next.variantOptions = variants;
      next.hasVariantOptions = true;
    }
  } else {
    const stock = assertStockSnapshotValid(payload, "Stok master");
    Object.assign(next, stock, {
      hasVariants: false,
      variants: [],
      variantCount: 0,
      activeVariantCount: 0,
    });
    if (preserveVariantOptions || Array.isArray(payload.variantOptions)) {
      next.variantOptions = [];
      next.hasVariantOptions = false;
    }
  }

  delete next.expectedVersion;
  delete next.versionToken;
  return next;
};

const sanitizeInventoryMasterUpdate = ({
  current = {},
  currentPayload = {},
  incomingPayload = {},
  mergedPayload = {},
  req,
  preserveVariantOptions = false,
  protectedFields = [],
  protectedVariantFields = [],
} = {}) => {
  const expectedVersion = normalizeText(incomingPayload.expectedVersion || "");
  const currentVersion = normalizeText(current.versionToken || currentPayload.updatedAt || current.updatedAt || "");
  if (!expectedVersion) {
    throw createInventoryGuardError(
      "Data sudah perlu dimuat ulang sebelum disimpan. Tutup form, buka kembali, lalu ulangi perubahan.",
      "INVENTORY_VERSION_REQUIRED",
      428,
    );
  }
  if (currentVersion && expectedVersion !== currentVersion) {
    throw createInventoryGuardError(
      "Data telah berubah di perangkat/proses lain. Perubahan tidak disimpan agar stok dan HPP terbaru tidak tertimpa.",
      "INVENTORY_STALE_UPDATE",
      409,
    );
  }

  const actor = req?.localAuth?.user?.username || "system";
  const now = nowIso();
  const currentResolvedVariants = resolveInventoryVariantCollection(currentPayload);
  const existingVariants = currentResolvedVariants.variants;
  const archivedVariants = Array.isArray(currentPayload.archivedVariants)
    ? currentPayload.archivedVariants
    : [];
  const currentHasVariants = currentResolvedVariants.hasVariants;
  const hasIncomingMode = Object.prototype.hasOwnProperty.call(incomingPayload, "hasVariants")
    || Object.prototype.hasOwnProperty.call(incomingPayload, "hasVariantOptions");
  const nextHasVariants = hasIncomingMode
    ? incomingPayload.hasVariants === true || incomingPayload.hasVariantOptions === true
    : currentHasVariants;
  const hasIncomingVariants = Object.prototype.hasOwnProperty.call(incomingPayload, "variants")
    || Object.prototype.hasOwnProperty.call(incomingPayload, "variantOptions");
  const incomingResolvedVariants = resolveInventoryVariantCollection(incomingPayload);
  const incomingVariants = hasIncomingVariants
    ? incomingResolvedVariants.variants
    : existingVariants;
  let next = { ...mergedPayload };
  let activeVariants = existingVariants;
  let nextArchived = archivedVariants;
  const historyEntries = [];

  if (currentHasVariants && !nextHasVariants) {
    if (!isStockSnapshotEmpty(current)) {
      throw createInventoryGuardError(
        "Mode varian tidak boleh dimatikan karena total stok/reserved master belum 0.",
        "INVENTORY_VARIANT_MODE_DISABLE_BLOCKED",
        409,
      );
    }
    for (const variant of existingVariants) {
      if (!isStockSnapshotEmpty(variant)) {
        throw createInventoryGuardError(
          `Mode varian tidak boleh dimatikan karena varian ${getVariantDisplayName(variant)} masih memiliki stok/reserved.`,
          "INVENTORY_VARIANT_MODE_DISABLE_BLOCKED",
          409,
        );
      }
      const reason = "Mode varian dimatikan setelah semua stok varian 0.";
      const archived = buildArchivedVariant(variant, { actor, now, reason });
      nextArchived = upsertArchivedVariant(nextArchived, archived);
      historyEntries.push(buildVariantHistoryEntry("variant_archived", { actor, now, reason, variant: archived }));
    }
    historyEntries.push(buildVariantHistoryEntry("variant_mode_disabled", {
      actor,
      now,
      reason: "Mode varian dimatikan setelah semua bucket stok aman 0.",
    }));
    activeVariants = [];
  } else if (!currentHasVariants && nextHasVariants) {
    if (!isStockSnapshotEmpty(current)) {
      throw createInventoryGuardError(
        "Item dengan stok master/reserved belum 0 tidak boleh dikonversi ke varian. Gunakan Stock Adjustment resmi lebih dulu.",
        "INVENTORY_VARIANT_MODE_ENABLE_BLOCKED",
        409,
      );
    }
    const usedKeys = new Set();
    activeVariants = incomingVariants.map((variant, index) => buildNewZeroStockVariant(
      variant,
      index,
      usedKeys,
      protectedVariantFields,
    ));
    if (activeVariants.length === 0) {
      throw createInventoryGuardError("Minimal satu varian wajib diisi.", "INVENTORY_VARIANT_REQUIRED", 400);
    }
    assertNoDuplicateVariants(activeVariants);
    historyEntries.push(buildVariantHistoryEntry("variant_mode_enabled", {
      actor,
      now,
      reason: "Mode varian diaktifkan dari master dengan stok master 0.",
    }));
  } else if (currentHasVariants && nextHasVariants && hasIncomingVariants) {
    const reconciled = reconcileInventoryVariants({
      incomingVariants,
      existingVariants,
      archivedVariants,
      protectedVariantFields,
      actor,
      now,
    });
    activeVariants = reconciled.activeVariants;
    nextArchived = reconciled.archivedVariants;
    historyEntries.push(...reconciled.historyEntries);
    if (activeVariants.filter((variant) => variant.isActive !== false).length === 0) {
      throw createInventoryGuardError(
        "Minimal satu varian aktif wajib dipertahankan. Matikan mode varian hanya melalui flow stok 0.",
        "INVENTORY_VARIANT_REQUIRED",
        409,
      );
    }
  }

  if (nextHasVariants) {
    activeVariants = activeVariants.map((variant) => ({
      ...variant,
      ...assertStockSnapshotValid(variant, `Stok varian ${getVariantDisplayName(variant)}`),
    }));
    if (activeVariants.filter(
      (variant) => variant.isActive !== false && variant.isArchived !== true,
    ).length === 0) {
      throw createInventoryGuardError(
        "Minimal satu varian aktif wajib dipertahankan. Matikan mode varian hanya melalui flow stok 0.",
        "INVENTORY_ACTIVE_VARIANT_REQUIRED",
        409,
      );
    }
    const totals = calculateVariantTotals(activeVariants);
    Object.assign(next, {
      hasVariants: true,
      variants: activeVariants,
      archivedVariants: nextArchived,
      currentStock: totals.currentStock,
      stock: totals.currentStock,
      reservedStock: totals.reservedStock,
      availableStock: totals.availableStock,
      variantCount: activeVariants.length,
      activeVariantCount: activeVariants.filter((variant) => variant.isActive !== false).length,
    });
    if (preserveVariantOptions || Array.isArray(currentPayload.variantOptions) || Array.isArray(incomingPayload.variantOptions)) {
      next.variantOptions = activeVariants;
      next.hasVariantOptions = true;
    }
  } else {
    const currentStock = getStockSnapshot(current);
    Object.assign(next, currentStock, {
      hasVariants: false,
      variants: [],
      archivedVariants: nextArchived,
      variantCount: 0,
      activeVariantCount: 0,
    });
    if (preserveVariantOptions || Array.isArray(currentPayload.variantOptions) || Array.isArray(incomingPayload.variantOptions)) {
      next.variantOptions = [];
      next.hasVariantOptions = false;
    }
  }

  next.variantModeHistory = [
    ...(Array.isArray(currentPayload.variantModeHistory) ? currentPayload.variantModeHistory : []),
    ...historyEntries,
  ].slice(-50);
  next = preserveFields(next, currentPayload, protectedFields);
  for (const field of INVENTORY_STOCK_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(next, field)) next[field] = getStockSnapshot(current)[field];
  }
  delete next.expectedVersion;
  delete next.versionToken;
  return next;
};

const softDeleteStockReadModel = async (db, sourceType, sourceId) => {
  const id = `${sourceType}__${sourceId}`;
  const row = await db.get("SELECT * FROM stock_read_models WHERE id = ?", [id]);
  if (!row) return null;
  const payload = safeJsonParse(row.payload_json, {});
  return upsertJsonRecord(db, "stock_read_models", {
    ...payload,
    id,
    status: "deleted",
    isActive: false,
    updatedAt: nowIso(),
  });
};

const createInventoryMasterRouteGuards = ({
  sourceType,
  sourceCollection,
  preserveVariantOptions = false,
  protectedFields = [],
  protectedVariantFields = protectedFields,
} = {}) => {
  if (!sourceType || !sourceCollection) {
    throw new Error("Konfigurasi inventory master guard tidak lengkap.");
  }

  const syncReadModel = async (db, record, action) => upsertStockReadModel(db, record, {
    sourceType,
    sourceCollection,
    lastSyncedFrom: `inventory_master.${action}`,
  });

  return {
    useWriteTransaction: true,
    sanitizeDirectCreate: async ({ payload }) => normalizeInventoryMasterCreate(payload, { preserveVariantOptions }),
    sanitizeDirectUpdate: async (context) => sanitizeInventoryMasterUpdate({
      ...context,
      preserveVariantOptions,
      protectedFields,
      protectedVariantFields,
    }),
    validateDirectDelete: async ({ current, currentPayload }) => {
      const variants = resolveInventoryVariantCollection(currentPayload).variants;
      const archivedVariants = Array.isArray(currentPayload.archivedVariants)
        ? currentPayload.archivedVariants
        : [];
      const hasHiddenVariantStock = [...variants, ...archivedVariants]
        .some((variant) => !isStockSnapshotEmpty(variant));

      if (!isStockSnapshotEmpty(current) || hasHiddenVariantStock) {
        throw createInventoryGuardError(
          "Master inventory yang masih memiliki stok/reserved tidak boleh dihapus atau dinonaktifkan lewat delete.",
          "INVENTORY_MASTER_DELETE_BLOCKED",
          409,
        );
      }
    },
    afterDirectCreate: async ({ db, record }) => syncReadModel(db, record, "create"),
    afterDirectUpdate: async ({ db, record }) => syncReadModel(db, record, "update"),
    afterDirectDelete: async ({ db, current }) => softDeleteStockReadModel(db, sourceType, current.id),
  };
};

const insertEventRecord = async (db, tableName, payload = {}) => {
  const id = normalizeText(payload.id || payload.referenceNumber || payload.code || crypto.randomUUID());
  const columns = extractColumns({ ...payload, id });
  await db.run(
    `INSERT INTO ${tableName} (id, code, name, status, is_active, current_stock, reserved_stock, available_stock, min_stock_alert, total_amount, transaction_date, source_type, source_id, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      id,
      columns.code || normalizeText(payload.referenceNumber || payload.code || id).toUpperCase(),
      columns.name || normalizeText(payload.name || payload.description || payload.itemName || id),
      columns.status || "active",
      columns.isActive,
      columns.currentStock,
      columns.reservedStock,
      columns.availableStock,
      columns.minStockAlert,
      toInteger(payload.totalAmount ?? payload.total ?? payload.amount ?? 0),
      payload.transactionDate || payload.date || nowIso(),
      payload.sourceType || payload.type || null,
      payload.sourceId || payload.itemId || null,
      JSON.stringify({ ...payload, id, createdAt: payload.createdAt || nowIso(), updatedAt: nowIso() }),
    ]
  );
  return { id, ...payload };
};

const loadSourceItem = async (db, sourceType, sourceId) => {
  const tableName = getTableForSourceType(sourceType);
  const row = await db.get(`SELECT * FROM ${tableName} WHERE id = ? AND status != 'deleted'`, [sourceId]);
  if (!row) throw new Error("Item stok database lokal tidak ditemukan.");
  return { tableName, row, payload: toRowPayload(row) };
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

module.exports = {
  applyStockDeltaToPayload,
  commitStockMutation,
  createInventoryMasterRouteGuards,
  insertEventRecord,
  loadSourceItem,
  normalizeInventoryMasterCreate,
  sanitizeInventoryMasterUpdate,
  upsertJsonRecord,
  upsertStockReadModel,
  toInteger,
  nowIso,
  getTableForSourceType,
  matchesVariantReference,
  resolveInventoryVariantCollection,
};
