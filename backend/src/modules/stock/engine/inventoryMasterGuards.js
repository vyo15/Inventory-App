const { resolveInventoryVariantCollection } = require("./stockSourceRegistry");
const { softDeleteStockReadModel, upsertStockReadModel } = require("./stockPersistence");
const {
  createInventoryGuardError,
  isStockSnapshotEmpty,
  normalizeInventoryMasterCreate,
  sanitizeInventoryMasterUpdate,
} = require("./stockVariantDomain");

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


module.exports = { createInventoryMasterRouteGuards };
