const {
  normalizeText,
  toRoundedInteger: toInteger,
} = require("../../../utils/textNormalization");
const { createHttpError } = require("../../../utils/httpError");
// Canonical inventory source registry and shared primitives.
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
    throw createHttpError(
      "Stock engine database lokal hanya mendukung Product, Raw Material, dan Semi Finished.",
      "STOCK_SOURCE_TYPE_UNSUPPORTED",
      400,
    );
  }
  return tableName;
};

const getSourceTypeForTable = (tableName = "") => SOURCE_TYPES[tableName] || "product";

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


module.exports = {
  SOURCE_TABLES,
  SOURCE_TYPES,
  getSourceTypeForTable,
  getTableForSourceType,
  getVariantReferenceTokens,
  matchesVariantReference,
  normalizeText,
  nowIso,
  resolveInventoryVariantCollection,
  toInteger,
};
