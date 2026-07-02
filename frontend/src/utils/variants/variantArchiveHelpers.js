import { toRoundedInteger } from "../number/numberNormalization";
import { normalizeText as safeTrim } from "../text/textNormalization";
/* =====================================================
SECTION: Variant Archive/Restore Helpers — GUARDED
Fungsi:
- Menormalisasi lifecycle archive, restore, duplicate guard, dan audit history varian tanpa menulis database langsung.

Dipakai oleh:
- productsService, rawMaterialsService, semiFinishedMaterialsService, dan UI guard Product/Raw/Semi.

Alasan perubahan:
- Varian stok 0 boleh disembunyikan dari transaksi baru, tetapi variantKey dan tombstone harus tetap ada agar histori transaksi lama aman.

Catatan cleanup:
- Jika nanti dibuat audit collection khusus, helper ini bisa menjadi sumber payload audit non-stok.

Risiko:
- Jika matching signature diubah sembarangan, varian lama bisa gagal direstore atau malah membuat duplicate variantKey.
===================================================== */

const normalizeToken = (value) =>
  safeTrim(value)
    .toLowerCase()
    .replace(/\s+/g, ' ');

export const toVariantArchiveStockNumber = (value = 0) => toRoundedInteger(value);

export const getVariantStockSnapshot = (variant = {}) => {
  const currentStock = toVariantArchiveStockNumber(variant.currentStock ?? variant.stock ?? 0);
  const reservedStock = toVariantArchiveStockNumber(variant.reservedStock || 0);
  const availableStock = toVariantArchiveStockNumber(
    variant.availableStock ?? Math.max(currentStock - reservedStock, 0),
  );

  return {
    currentStock,
    stock: currentStock,
    reservedStock,
    availableStock,
  };
};

export const isVariantStockEmpty = (variant = {}) => {
  const stock = getVariantStockSnapshot(variant);
  return stock.currentStock <= 0 && stock.reservedStock <= 0 && stock.availableStock <= 0;
};

export const areAllVariantsStockEmpty = (variants = []) =>
  (Array.isArray(variants) ? variants : []).every((variant) => isVariantStockEmpty(variant));

const pickFirstText = (variant = {}, fields = []) => {
  for (const field of fields) {
    const value = safeTrim(variant?.[field]);
    if (value) return value;
  }
  return '';
};

export const getVariantDisplayName = (variant = {}, fallback = 'Varian') =>
  pickFirstText(variant, [
    'variantLabel',
    'label',
    'variantName',
    'name',
    'color',
    'variantCode',
    'code',
    'sku',
    'variantKey',
  ]) || fallback;

const getVariantCode = (variant = {}) =>
  pickFirstText(variant, ['variantCode', 'code', 'sku']);

export const buildVariantCanonicalSignature = (variant = {}) => {
  const code = normalizeToken(getVariantCode(variant));
  const label = normalizeToken(getVariantDisplayName(variant, ''));
  const variantKey = normalizeToken(variant.variantKey);

  if (label || code) return `identity:${label}|${code}`;
  return variantKey ? `key:${variantKey}` : '';
};

export const buildVariantIdentitySignatures = (variant = {}) => {
  const signatures = [
    normalizeToken(variant.variantKey) ? `key:${normalizeToken(variant.variantKey)}` : '',
    normalizeToken(getVariantCode(variant)) ? `code:${normalizeToken(getVariantCode(variant))}` : '',
    normalizeToken(getVariantDisplayName(variant, '')) ? `label:${normalizeToken(getVariantDisplayName(variant, ''))}` : '',
    buildVariantCanonicalSignature(variant),
  ];

  return Array.from(new Set(signatures.filter(Boolean)));
};

export const buildVariantArchiveLookup = (variants = []) => {
  const lookup = new Map();

  (Array.isArray(variants) ? variants : []).forEach((variant) => {
    buildVariantIdentitySignatures(variant).forEach((signature) => {
      if (!lookup.has(signature)) lookup.set(signature, variant);
    });
  });

  return lookup;
};

export const findMatchingVariant = (variant = {}, variants = []) => {
  const lookup = buildVariantArchiveLookup(variants);
  return buildVariantIdentitySignatures(variant)
    .map((signature) => lookup.get(signature))
    .find(Boolean) || null;
};

const removeArchiveFields = (variant = {}) => {
  const rest = { ...variant };

  delete rest.archivedAt;
  delete rest.archivedBy;
  delete rest.archiveReason;
  delete rest.isArchived;

  return rest;
};

export const archiveVariantTombstone = (variant = {}, options = {}) => {
  const {
    now = new Date().toISOString(),
    actor = 'system',
    reason = 'Varian diarsipkan dari edit master setelah stok 0.',
  } = options;

  return {
    ...variant,
    ...getVariantStockSnapshot(variant),
    isActive: false,
    isArchived: true,
    archivedAt: now,
    archivedBy: actor,
    archiveReason: reason,
  };
};

export const restoreVariantFromArchive = (archivedVariant = {}, editedVariant = {}, options = {}) => {
  const {
    now = new Date().toISOString(),
    actor = 'system',
    reason = 'Varian lama direstore karena dibuat lagi dengan struktur yang sama.',
  } = options;
  const restoredBase = removeArchiveFields(archivedVariant);
  const variantKey = archivedVariant.variantKey || editedVariant.variantKey;

  return {
    ...restoredBase,
    ...editedVariant,
    variantKey,
    currentStock: 0,
    stock: 0,
    reservedStock: 0,
    availableStock: 0,
    isActive: true,
    isArchived: false,
    restoredAt: now,
    restoredBy: actor,
    restoreReason: reason,
  };
};

export const buildVariantModeHistoryEntry = (action, options = {}) => ({
  action,
  at: options.now || new Date().toISOString(),
  by: options.actor || 'system',
  reason: options.reason || '',
  variantKey: options.variantKey || '',
  variantLabel: options.variantLabel || '',
});

export const appendVariantModeHistory = (history = [], entries = [], limit = 50) => {
  const safeHistory = Array.isArray(history) ? history : [];
  const safeEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
  return [...safeHistory, ...safeEntries].slice(-limit);
};

const upsertArchivedVariant = (archivedVariants = [], archivedVariant = {}) => {
  const next = [];
  const incomingSignatures = new Set(buildVariantIdentitySignatures(archivedVariant));
  let replaced = false;

  (Array.isArray(archivedVariants) ? archivedVariants : []).forEach((item) => {
    const isSame = buildVariantIdentitySignatures(item).some((signature) => incomingSignatures.has(signature));
    if (isSame) {
      if (!replaced) {
        next.push(archivedVariant);
        replaced = true;
      }
      return;
    }
    next.push(item);
  });

  if (!replaced) next.push(archivedVariant);
  return next;
};

export const removeRestoredArchivedVariants = (archivedVariants = [], restoredVariants = []) => {
  const restoredSignatures = new Set(
    (Array.isArray(restoredVariants) ? restoredVariants : [])
      .flatMap((variant) => buildVariantIdentitySignatures(variant)),
  );

  return (Array.isArray(archivedVariants) ? archivedVariants : []).filter(
    (variant) => !buildVariantIdentitySignatures(variant).some((signature) => restoredSignatures.has(signature)),
  );
};

export const assertNoDuplicateActiveVariants = (variants = [], message = 'Nama varian tidak boleh duplikat') => {
  const seen = new Set();

  (Array.isArray(variants) ? variants : []).forEach((variant, index) => {
    if (variant?.isArchived === true || variant?.isActive === false) return;
    const signature = buildVariantCanonicalSignature(variant);
    if (!signature) return;
    if (seen.has(signature)) {
      throw {
        type: 'validation',
        errors: {
          [`variants.${index}`]: message,
          variants: message,
        },
      };
    }
    seen.add(signature);
  });
};


export const archiveActiveVariantsForModeDisable = ({
  activeVariants = [],
  archivedVariants = [],
  now = new Date().toISOString(),
  actor = 'system',
  archiveReason = 'Mode varian dimatikan setelah semua stok varian 0.',
  historyAction = 'variant_mode_disabled',
} = {}) => {
  const safeActiveVariants = Array.isArray(activeVariants) ? activeVariants : [];
  if (!areAllVariantsStockEmpty(safeActiveVariants)) {
    throw {
      type: 'validation',
      errors: {
        hasVariants: 'Mode varian hanya bisa dimatikan jika semua varian current/reserved/available stock 0.',
      },
    };
  }

  const archivedFromActive = safeActiveVariants.map((variant) =>
    archiveVariantTombstone(variant, { now, actor, reason: archiveReason }),
  );
  const nextArchivedVariants = archivedFromActive.reduce(
    (current, archivedVariant) => upsertArchivedVariant(current, archivedVariant),
    Array.isArray(archivedVariants) ? archivedVariants : [],
  );

  return {
    archivedVariants: nextArchivedVariants,
    historyEntries: [buildVariantModeHistoryEntry(historyAction, {
      now,
      actor,
      reason: archiveReason,
      variantLabel: `${safeActiveVariants.length} varian diarsipkan`,
    })],
    archivedFromActive,
  };
};

export const reconcileVariantArchiveState = ({
  editedVariants = [],
  existingVariants = [],
  archivedVariants = [],
  normalizeVariants = (items) => (Array.isArray(items) ? items : []),
  mergeActiveVariant = (edited, existing) => ({ ...edited, variantKey: existing?.variantKey || edited?.variantKey }),
  buildNewVariant = (edited) => ({ ...edited, currentStock: 0, stock: 0, reservedStock: 0, availableStock: 0 }),
  noVariantsMessage = 'Minimal harus ada 1 varian',
  protectedRemovalMessage = 'Varian yang masih punya stock/reserved tidak boleh dihapus dari master. Nolkan lewat flow resmi lebih dulu.',
  duplicateActiveMessage = 'Nama varian tidak boleh duplikat',
  now = new Date().toISOString(),
  actor = 'system',
  archiveReason = 'Varian diarsipkan dari edit master setelah stok 0.',
  restoreReason = 'Varian lama direstore karena dibuat lagi dengan struktur yang sama.',
  historyActionArchive = 'variant_archived',
  historyActionRestore = 'variant_restored',
} = {}) => {
  const normalizedEdited = normalizeVariants(editedVariants);
  const normalizedExisting = normalizeVariants(existingVariants).filter((variant) => variant?.isArchived !== true);
  const normalizedArchived = normalizeVariants(archivedVariants).map((variant) => ({
    ...variant,
    isActive: false,
    isArchived: true,
  }));

  if (normalizedEdited.length === 0) {
    throw { type: 'validation', errors: { variants: noVariantsMessage } };
  }

  const activeLookup = buildVariantArchiveLookup(normalizedExisting);
  const archiveLookup = buildVariantArchiveLookup(normalizedArchived);
  const archivedNextInitial = [...normalizedArchived];
  const historyEntries = [];
  const restoredVariants = [];

  normalizedExisting.forEach((variant) => {
    const stillExists = buildVariantIdentitySignatures(variant).some((signature) =>
      normalizedEdited.some((edited) => buildVariantIdentitySignatures(edited).includes(signature)),
    );

    if (!stillExists) {
      if (!isVariantStockEmpty(variant)) {
        throw { type: 'validation', errors: { variants: protectedRemovalMessage } };
      }
      historyEntries.push(buildVariantModeHistoryEntry(historyActionArchive, {
        now,
        actor,
        reason: archiveReason,
        variantKey: variant.variantKey || '',
        variantLabel: getVariantDisplayName(variant, ''),
      }));
    }
  });

  const archivedFromRemoved = normalizedExisting
    .filter((variant) => !buildVariantIdentitySignatures(variant).some((signature) =>
      normalizedEdited.some((edited) => buildVariantIdentitySignatures(edited).includes(signature)),
    ))
    .map((variant) => archiveVariantTombstone(variant, { now, actor, reason: archiveReason }));

  let archivedNext = archivedFromRemoved.reduce(
    (current, archivedVariant) => upsertArchivedVariant(current, archivedVariant),
    archivedNextInitial,
  );

  const activeVariants = normalizedEdited.map((edited, index) => {
    const activeMatch = buildVariantIdentitySignatures(edited)
      .map((signature) => activeLookup.get(signature))
      .find(Boolean);

    if (activeMatch) {
      return mergeActiveVariant(edited, activeMatch, index);
    }

    const archivedMatch = buildVariantIdentitySignatures(edited)
      .map((signature) => archiveLookup.get(signature))
      .find(Boolean);

    if (archivedMatch) {
      const restored = restoreVariantFromArchive(archivedMatch, edited, { now, actor, reason: restoreReason });
      restoredVariants.push(restored);
      historyEntries.push(buildVariantModeHistoryEntry(historyActionRestore, {
        now,
        actor,
        reason: restoreReason,
        variantKey: restored.variantKey || '',
        variantLabel: getVariantDisplayName(restored, ''),
      }));
      return mergeActiveVariant(restored, restored, index);
    }

    return buildNewVariant(edited, index);
  });

  archivedNext = removeRestoredArchivedVariants(archivedNext, restoredVariants);
  assertNoDuplicateActiveVariants(activeVariants, duplicateActiveMessage);

  return {
    activeVariants,
    archivedVariants: archivedNext,
    historyEntries,
    archivedFromRemoved,
    restoredVariants,
  };
};
