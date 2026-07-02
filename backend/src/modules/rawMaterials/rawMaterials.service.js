const { normalizeLowerText, normalizeText } = require("../../utils/textNormalization");
const { createServiceError } = require("../../utils/httpError");
const {
  createInventoryMasterRouteGuards,
  resolveInventoryVariantCollection,
} = require("../stock/engine");
const { safeJsonParse } = require("../../utils/jsonUtils");

const RAW_MATERIAL_VALUATION_FIELDS = ["averageActualUnitCost"];
const RAW_MATERIAL_UNITS = new Set([
  "pcs",
  "meter",
  "yard",
  "kg",
  "gram",
  "liter",
  "ml",
  "roll",
  "pack",
  "batang",
  "tangkai",
  "lembar",
  "biji",
  "set",
]);
const ACTIVE_PRODUCTION_STATUSES = new Set([
  "draft",
  "planned",
  "ready",
  "active",
  "diproses",
  "in_progress",
  "processing",
  "scheduled",
  "open",
]);


const toNonNegativeInteger = (value, label) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0 || !Number.isInteger(numeric)) {
    throw createRawMaterialError(`${label} harus berupa angka bulat 0 atau lebih.`, "RAW_MATERIAL_INVALID_NUMBER", 400);
  }
  return numeric;
};

const createRawMaterialError = createServiceError;

const hasStockSnapshot = (record = {}) => (
  Number(record.currentStock ?? record.stock ?? 0) > 0
  || Number(record.reservedStock ?? 0) > 0
  || Number(record.availableStock ?? 0) > 0
);

const hasAnyVariantStock = (payload = {}) => {
  const activeVariants = resolveInventoryVariantCollection(payload).variants;
  const archivedVariants = Array.isArray(payload.archivedVariants) ? payload.archivedVariants : [];
  return [...activeVariants, ...archivedVariants].some(hasStockSnapshot);
};

const getRawMaterialReferences = (payload = {}) => {
  const sourceLists = [
    payload.materialLines,
    payload.materials,
    payload.requirementLines,
    payload.materialRequirementLines,
    payload.materialUsages,
    payload.items,
  ].filter(Array.isArray);

  return sourceLists.flatMap((items) => items).map((item = {}) => ({
    sourceType: normalizeLowerText(item.itemType || item.sourceType || item.type),
    sourceId: normalizeText(item.itemId || item.sourceId || item.materialId || item.rawMaterialId || item.id),
  }));
};

const payloadReferencesRawMaterial = (payload = {}, materialId) => getRawMaterialReferences(payload).some((reference) => (
  ["material", "raw", "raw_material", "raw_materials"].includes(reference.sourceType)
  && reference.sourceId === String(materialId)
));

const assertNoActiveProductionDependency = async (db, materialId) => {
  const bomRows = await db.all("SELECT id, name, status, payload_json FROM production_boms WHERE status != 'deleted'");
  const activeBom = bomRows.find((row) => {
    const payload = safeJsonParse(row.payload_json, {});
    const isActive = payload.isActive !== false && !["inactive", "archived"].includes(normalizeLowerText(payload.status || row.status));
    return isActive && payloadReferencesRawMaterial(payload, materialId);
  });
  if (activeBom) {
    const payload = safeJsonParse(activeBom.payload_json, {});
    throw createRawMaterialError(
      `Bahan masih dipakai pada BOM aktif ${payload.name || activeBom.name || activeBom.id}. Nonaktifkan atau revisi BOM lebih dulu.`,
      "RAW_MATERIAL_ACTIVE_BOM_DEPENDENCY",
      409,
    );
  }

  for (const tableName of ["production_planning", "production_orders", "production_work_logs"]) {
    const rows = await db.all(`SELECT id, name, status, payload_json FROM ${tableName} WHERE status != 'deleted'`);
    const activeRecord = rows.find((row) => {
      const payload = safeJsonParse(row.payload_json, {});
      const status = normalizeLowerText(payload.status || row.status);
      const isActive = ACTIVE_PRODUCTION_STATUSES.has(status) || (!status && payload.isActive !== false);
      return isActive && payloadReferencesRawMaterial(payload, materialId);
    });
    if (activeRecord) {
      const payload = safeJsonParse(activeRecord.payload_json, {});
      throw createRawMaterialError(
        `Bahan masih dipakai pada proses produksi aktif ${payload.name || activeRecord.name || activeRecord.id}. Selesaikan proses tersebut lebih dulu.`,
        "RAW_MATERIAL_ACTIVE_PRODUCTION_DEPENDENCY",
        409,
      );
    }
  }
};

const assertUniqueName = async (db, name, currentId = "") => {
  const normalizedName = normalizeLowerText(name);
  if (!normalizedName) return;
  const rows = await db.all("SELECT id, name FROM raw_materials WHERE status != 'deleted'");
  const duplicate = rows.find((row) => row.id !== currentId && normalizeLowerText(row.name) === normalizedName);
  if (duplicate) {
    throw createRawMaterialError("Nama bahan baku sudah digunakan.", "RAW_MATERIAL_DUPLICATE_NAME", 409);
  }
};

const assertCategory = async (db, categoryId) => {
  const normalizedCategoryId = normalizeText(categoryId);
  if (!normalizedCategoryId) {
    throw createRawMaterialError("Kelompok bahan wajib dipilih.", "RAW_MATERIAL_CATEGORY_REQUIRED", 400);
  }
  const row = await db.get(
    "SELECT id, name, type, status FROM categories WHERE id = ? AND status != 'deleted'",
    [normalizedCategoryId],
  );
  if (!row) {
    throw createRawMaterialError("Kelompok bahan tidak ditemukan.", "RAW_MATERIAL_CATEGORY_NOT_FOUND", 400);
  }
  if (normalizeLowerText(row.type) !== "raw_material_group") {
    throw createRawMaterialError("Kategori yang dipilih bukan Kelompok Bahan.", "RAW_MATERIAL_CATEGORY_TYPE_INVALID", 400);
  }
  if (normalizeLowerText(row.status) === "inactive") {
    throw createRawMaterialError("Kelompok bahan sudah nonaktif.", "RAW_MATERIAL_CATEGORY_INACTIVE", 409);
  }
};

const validateVariants = (payload = {}) => {
  const hasVariants = payload.hasVariants === true || payload.hasVariantOptions === true;
  if (!hasVariants) return;

  const variants = resolveInventoryVariantCollection(payload).variants;
  if (variants.length === 0) {
    throw createRawMaterialError("Minimal satu varian bahan wajib diisi.", "RAW_MATERIAL_VARIANT_REQUIRED", 400);
  }

  const names = new Set();
  for (const variant of variants) {
    const name = normalizeText(variant.variantLabel || variant.variantName || variant.name);
    if (!name) {
      throw createRawMaterialError("Nama varian bahan wajib diisi.", "RAW_MATERIAL_VARIANT_NAME_REQUIRED", 400);
    }
    const normalizedName = name.toLowerCase();
    if (names.has(normalizedName)) {
      throw createRawMaterialError("Nama varian bahan tidak boleh duplikat.", "RAW_MATERIAL_VARIANT_DUPLICATE", 409);
    }
    names.add(normalizedName);
    toNonNegativeInteger(variant.minStockAlert ?? variant.minStock ?? 0, `Minimum stok varian ${name}`);
  }
};

const validateRawMaterialDomain = async ({ db, payload, current = null, currentPayload = null }) => {
  const name = normalizeText(payload.name);
  if (!name) {
    throw createRawMaterialError("Nama bahan baku wajib diisi.", "RAW_MATERIAL_NAME_REQUIRED", 400);
  }
  await assertUniqueName(db, name, current?.id || "");
  await assertCategory(db, payload.categoryId);

  const unit = normalizeLowerText(payload.stockUnit || payload.unit);
  const currentUnit = normalizeLowerText(currentPayload?.stockUnit || currentPayload?.unit);
  const isUnchangedLegacyUnit = Boolean(current && unit && currentUnit && unit === currentUnit);
  if (!RAW_MATERIAL_UNITS.has(unit) && !isUnchangedLegacyUnit) {
    throw createRawMaterialError("Satuan stok bahan baku tidak valid.", "RAW_MATERIAL_UNIT_INVALID", 400);
  }

  const hasVariants = payload.hasVariants === true || payload.hasVariantOptions === true;
  const openingStock = hasVariants
    ? resolveInventoryVariantCollection(payload).variants.reduce(
        (sum, variant) => sum + toNonNegativeInteger(
          variant.currentStock ?? variant.stock ?? 0,
          `Stok awal varian ${normalizeText(variant.name || variant.variantName || variant.variantLabel) || "tanpa nama"}`,
        ),
        0,
      )
    : toNonNegativeInteger(payload.currentStock ?? payload.stock ?? 0, "Stok awal");
  toNonNegativeInteger(payload.minStock ?? payload.minStockAlert ?? 0, "Minimum stok");
  toNonNegativeInteger(payload.restockReferencePrice ?? 0, "Harga referensi restock");
  toNonNegativeInteger(payload.sellingPrice ?? 0, "Harga jual");
  const openingUnitCost = toNonNegativeInteger(payload.averageActualUnitCost ?? 0, "Modal stok awal");
  if (!current && openingStock > 0 && openingUnitCost <= 0) {
    throw createRawMaterialError(
      "Modal stok awal per satuan wajib diisi jika stok awal lebih dari 0.",
      "RAW_MATERIAL_OPENING_COST_REQUIRED",
      400,
    );
  }

  validateVariants(payload);
};


const normalizeRawMaterialPolicyPayload = (payload = {}) => {
  const hasVariants = payload.hasVariants === true || payload.hasVariantOptions === true;
  const normalizeVariantList = (variants) => (Array.isArray(variants)
    ? variants.map((variant) => ({
        ...variant,
        minStockAlert: toNonNegativeInteger(
          variant.minStockAlert ?? variant.minStock ?? 0,
          `Minimum stok varian ${normalizeText(variant.name || variant.variantName || variant.variantLabel) || "tanpa nama"}`,
        ),
      }))
    : variants);

  return {
    ...payload,
    minStock: hasVariants ? 0 : toNonNegativeInteger(payload.minStock ?? payload.minStockAlert ?? 0, "Minimum stok"),
    minStockAlert: hasVariants ? 0 : toNonNegativeInteger(payload.minStockAlert ?? payload.minStock ?? 0, "Minimum stok"),
    variants: normalizeVariantList(payload.variants),
    variantOptions: normalizeVariantList(payload.variantOptions),
  };
};

const inventoryGuards = createInventoryMasterRouteGuards({
  sourceType: "raw_material",
  sourceCollection: "raw_materials",
  preserveVariantOptions: true,
  protectedFields: RAW_MATERIAL_VALUATION_FIELDS,
  protectedVariantFields: RAW_MATERIAL_VALUATION_FIELDS,
});

const getRawMaterialsRouterConfig = () => ({
  tableName: "raw_materials",
  moduleKey: "raw_materials",
  entityType: "raw_material",
  codePrefix: "RAW",
  requiredName: true,
  orderBy: "name ASC, updated_at DESC",
  protectedWriteNote: [
    "Edit master Raw Material hanya boleh mengubah metadata dan nilai reference/manual yang diizinkan.",
    "Stok, stok varian, dan average actual cost hasil transaksi dipertahankan dari database terbaru.",
    "Stock read model disinkronkan backend dalam transaction yang sama.",
  ].join(" "),
  ...inventoryGuards,
  sanitizeDirectCreate: async (context) => normalizeRawMaterialPolicyPayload(
    await inventoryGuards.sanitizeDirectCreate(context),
  ),
  sanitizeDirectUpdate: async (context) => normalizeRawMaterialPolicyPayload(
    await inventoryGuards.sanitizeDirectUpdate(context),
  ),
  validateDirectCreate: async ({ db, payload }) => validateRawMaterialDomain({ db, payload }),
  validateDirectUpdate: async ({ db, current, currentPayload, mergedPayload }) => {
    await validateRawMaterialDomain({ db, payload: mergedPayload, current, currentPayload });

    const wasActive = currentPayload.isActive !== false && normalizeLowerText(currentPayload.status || current.status) !== "inactive";
    const willBeInactive = mergedPayload.isActive === false || normalizeLowerText(mergedPayload.status) === "inactive";
    if (wasActive && willBeInactive) {
      if (hasStockSnapshot(current) || hasAnyVariantStock(currentPayload)) {
        throw createRawMaterialError(
          "Bahan baku masih memiliki stok atau reserved stock. Habiskan/pindahkan stok melalui flow resmi sebelum dinonaktifkan.",
          "RAW_MATERIAL_DEACTIVATE_STOCK_BLOCKED",
          409,
        );
      }
      await assertNoActiveProductionDependency(db, current.id);
    }
  },
});

module.exports = {
  RAW_MATERIAL_VALUATION_FIELDS,
  getRawMaterialsRouterConfig,
};
