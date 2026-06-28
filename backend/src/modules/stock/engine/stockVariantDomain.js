const { createHttpError } = require("../../../utils/httpError");
const {
  normalizeText,
  nowIso,
  resolveInventoryVariantCollection,
  toInteger,
} = require("./stockSourceRegistry");

const INVENTORY_STOCK_FIELDS = Object.freeze([
  "stock",
  "currentStock",
  "reservedStock",
  "availableStock",
]);

const createInventoryGuardError = (publicMessage, errorCode, statusCode = 400) =>
  createHttpError(publicMessage, errorCode, statusCode);

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

module.exports = {
  assertStockSnapshotValid,
  buildVariantHistoryEntry,
  createInventoryGuardError,
  getStockSnapshot,
  getVariantDisplayName,
  isStockSnapshotEmpty,
  normalizeInventoryMasterCreate,
  reconcileInventoryVariants,
  removeArchiveMetadata,
  removeArchivedVariant,
  sanitizeInventoryMasterUpdate,
};
