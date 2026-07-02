const { normalizeTruthyText: normalizeText, normalizeUpperText } = require("../../utils/textNormalization");
const { createServiceError } = require("../../utils/httpError");
const { safeJsonParse } = require("../../utils/jsonUtils");
const businessCodeContract = require("../../../../shared/businessCodeContract.json");
const {
  calculateSupplierCatalogMetrics,
  toNonNegativeInteger,
  toPositiveInteger,
} = require("../../../../shared/supplierCatalogPricing.cjs");
const {
  formatBusinessDateStamp,
  getBusinessCodePreview,
  resolveBusinessCode,
} = require("../../utils/businessCodeCounter");


const SUPPLIER_CODE_PREFIX = businessCodeContract.supplier.prefix;
const SUPPLIER_CODE_PATTERN = new RegExp(businessCodeContract.supplier.pattern);
const CATALOG_ITEM_TYPES = new Set(["product", "raw_material"]);
const CATALOG_EVENT_TYPES = new Set([
  "offer_created",
  "offer_updated",
  "offer_disabled",
  "offer_enabled",
  "link_changed",
  "price_checked",
  "price_changed",
  "purchase_price_checked",
  "purchase_price_changed",
  "stock_unavailable",
  "link_unavailable",
]);


const normalizeItemType = (value = "") => {
  const normalized = normalizeText(value).toLowerCase();
  if (["material", "raw", "raw_material", "raw_materials"].includes(normalized)) return "raw_material";
  if (["product", "products"].includes(normalized)) return "product";
  return normalized;
};


const assertSafeHttpUrl = (value, fieldLabel) => {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw createServiceError(`${fieldLabel} tidak valid. Gunakan link http:// atau https://.`, "VALIDATION_ERROR", 400);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw createServiceError(`${fieldLabel} hanya boleh memakai http:// atau https://.`, "VALIDATION_ERROR", 400);
  }
  return normalized;
};


const getSupplierCounterOptions = (dateStamp = formatBusinessDateStamp()) => ({
  counterKey: `suppliers:${SUPPLIER_CODE_PREFIX}:${dateStamp}`,
  prefix: `${SUPPLIER_CODE_PREFIX}-${dateStamp}`,
  tableName: "suppliers",
  columnName: "supplier_code",
  minWidth: 3,
  notes: "Runtime counter supplier per tanggal",
});

const generateNextSupplierCode = (db) => getBusinessCodePreview(
  db,
  getSupplierCounterOptions(),
);

const validateSupplierCode = (code) => {
  if (!SUPPLIER_CODE_PATTERN.test(code)) {
    throw createServiceError(
      "Kode supplier database lokal belum valid",
      "VALIDATION_ERROR",
      400,
    );
  }
};

const resolveSupplierCreateCode = async (db, requestedCode = "") => {
  const normalizedCode = normalizeUpperText(requestedCode);
  if (!normalizedCode) {
    return resolveBusinessCode(db, "", getSupplierCounterOptions());
  }

  validateSupplierCode(normalizedCode);
  const dateStamp = normalizedCode.split("-")[1];
  return resolveBusinessCode(
    db,
    normalizedCode,
    getSupplierCounterOptions(dateStamp),
  );
};

const calculateCatalogMetrics = (offer = {}) => calculateSupplierCatalogMetrics(offer);

const buildCatalogOfferSqlValues = (offer = {}, isPrimary = false) => [
  offer.itemType,
  offer.itemId,
  offer.itemName,
  offer.variantKey,
  offer.variantLabel,
  offer.listingName,
  offer.channel,
  offer.productLink,
  offer.purchaseType,
  offer.purchaseUnit,
  offer.purchaseQty,
  offer.conversionValue,
  offer.stockUnit,
  offer.supplierItemPrice,
  offer.estimatedShippingCost,
  offer.serviceFee,
  offer.discount,
  isPrimary ? 1 : 0,
  offer.status,
  offer.availabilityStatus,
  offer.notes,
];

const toCatalogOfferRecord = (row = {}) => {
  const metrics = calculateCatalogMetrics({
    purchaseType: row.purchase_type,
    purchaseQty: row.purchase_qty,
    conversionValue: row.conversion_value,
    supplierItemPrice: row.supplier_item_price,
    estimatedShippingCost: row.estimated_shipping_cost,
    serviceFee: row.service_fee,
    discount: row.discount,
  });

  return {
    id: row.id,
    catalogOfferId: row.id,
    supplierId: row.supplier_id,
    itemType: row.item_type,
    itemId: row.item_id,
    itemName: row.item_name,
    variantKey: row.variant_key || "",
    variantLabel: row.variant_label || "",
    listingName: row.listing_name || "",
    channel: row.channel || "",
    productLink: row.product_link || "",
    purchaseType: metrics.purchaseType,
    purchaseUnit: row.purchase_unit || "",
    purchaseQty: metrics.purchaseQty,
    conversionValue: metrics.conversionValue,
    stockUnit: row.stock_unit || "",
    supplierItemPrice: metrics.supplierItemPrice,
    estimatedShippingCost: metrics.estimatedShippingCost,
    serviceFee: metrics.serviceFee,
    discount: metrics.discount,
    totalStockQty: metrics.totalStockQty,
    totalEstimatedSupplier: metrics.totalEstimatedSupplier,
    estimatedUnitPrice: metrics.estimatedUnitPrice,
    referencePrice: metrics.estimatedUnitPrice,
    isPrimary: Boolean(row.is_primary),
    status: row.status || "active",
    availabilityStatus: row.availability_status || "available",
    isActive: (row.status || "active") === "active",
    note: row.notes || "",
    notes: row.notes || "",
    lastCheckedAt: row.last_checked_at || null,
    lastCheckedBy: row.last_checked_by || "",
    priceUpdatedAt: row.price_updated_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
};

const buildLegacyMaterialDetails = (offers = []) => offers
  .filter((offer) => offer.itemType === "raw_material" && offer.status !== "deleted")
  .map((offer) => ({
    ...offer,
    materialId: offer.itemId,
    rawMaterialId: offer.itemId,
    materialName: offer.itemName,
  }));

const toSupplierRecord = (row = {}, offers = []) => {
  const payload = safeJsonParse(row.payload_json, {});
  const activeOffers = offers.filter((offer) => offer.status === "active");
  const materialDetails = buildLegacyMaterialDetails(offers);
  const supportedMaterialIds = [...new Set(
    activeOffers
      .filter((offer) => offer.itemType === "raw_material")
      .map((offer) => offer.itemId)
      .filter(Boolean),
  )];
  const supportedMaterialNames = [...new Set(
    activeOffers
      .filter((offer) => offer.itemType === "raw_material")
      .map((offer) => offer.itemName)
      .filter(Boolean),
  )];

  return {
    ...payload,
    id: row.id,
    code: row.supplier_code || payload.code || "",
    supplierCode: row.supplier_code || payload.supplierCode || "",
    name: row.name || payload.name || "",
    storeName: row.name || payload.storeName || "",
    storeLink: row.store_link || payload.storeLink || "",
    link: row.store_link || payload.link || "",
    contact: row.phone || payload.contact || "",
    phone: row.phone || payload.phone || "",
    address: row.address || payload.address || "",
    note: row.notes || payload.note || "",
    notes: row.notes || payload.notes || "",
    catalogOffers: offers,
    materialDetails,
    supportedMaterialIds,
    supportedMaterialNames,
    supportedItemNames: [...new Set(activeOffers.map((offer) => offer.itemName).filter(Boolean))],
    status: row.status || payload.status || "active",
    isActive: (row.status || payload.status || "active") === "active",
    createdAt: row.created_at || payload.createdAt,
    updatedAt: row.updated_at || payload.updatedAt,
  };
};

const buildSupplierPayload = (body = {}) => ({
  supplierCode: normalizeUpperText(body.code || body.supplierCode || body.supplier_code),
  name: normalizeText(body.name || body.storeName || body.supplierName),
  storeLink: assertSafeHttpUrl(body.storeLink || body.link || body.url || body.shopLink, "Link toko"),
  phone: normalizeText(body.contact || body.phone),
  address: normalizeText(body.address),
  notes: normalizeText(body.note || body.notes || body.description),
  catalogOffers: Array.isArray(body.catalogOffers)
    ? body.catalogOffers
    : Array.isArray(body.materialDetails)
      ? body.materialDetails.map((detail) => ({
          ...detail,
          itemType: "raw_material",
          itemId: detail.itemId || detail.materialId || detail.rawMaterialId,
          itemName: detail.itemName || detail.materialName,
        }))
      : null,
  payload: {
    ...body,
    catalogOffers: undefined,
    materialDetails: undefined,
    supportedMaterialIds: undefined,
    supportedMaterialNames: undefined,
  },
});

const ensureSupplierCodeAvailable = async (db, code, excludeId = null) => {
  if (!code) return;

  const existing = await db.get(
    "SELECT id FROM suppliers WHERE supplier_code = ? AND id != ?",
    [code, excludeId || 0],
  );

  if (existing) {
    throw createServiceError(
      "Kode supplier sudah digunakan di database lokal.",
      "DUPLICATE_CODE",
      409,
    );
  }
};

const validateSupplierPayload = (payload) => {
  if (!payload.name) {
    throw createServiceError("Nama supplier wajib diisi", "VALIDATION_ERROR", 400);
  }
};

const getCatalogItemRow = async (db, itemType, itemId) => {
  const tableName = itemType === "product" ? "products" : "raw_materials";
  const row = await db.get(
    `SELECT id, name, status, is_active, payload_json FROM ${tableName} WHERE id = ? AND status != 'deleted'`,
    [itemId],
  );
  return row || null;
};

const normalizeCatalogOfferInput = async (db, rawOffer = {}) => {
  const itemType = normalizeItemType(rawOffer.itemType || rawOffer.type || (rawOffer.materialId ? "raw_material" : ""));
  if (!CATALOG_ITEM_TYPES.has(itemType)) {
    throw createServiceError("Jenis barang katalog Supplier tidak valid.", "VALIDATION_ERROR", 400);
  }

  const itemId = normalizeText(rawOffer.itemId || rawOffer.materialId || rawOffer.rawMaterialId);
  if (!itemId) {
    throw createServiceError("Barang katalog Supplier wajib dipilih.", "VALIDATION_ERROR", 400);
  }

  const itemRow = await getCatalogItemRow(db, itemType, itemId);
  if (!itemRow) {
    throw createServiceError("Barang katalog Supplier tidak ditemukan pada master data aktif.", "CATALOG_ITEM_NOT_FOUND", 400);
  }

  const itemPayload = safeJsonParse(itemRow.payload_json, {});
  const purchaseType = rawOffer.purchaseType === "offline" ? "offline" : "online";
  const productLink = assertSafeHttpUrl(rawOffer.productLink || rawOffer.link || rawOffer.url, "Link produk");
  const status = rawOffer.status === "inactive" || rawOffer.isActive === false ? "inactive" : "active";

  return {
    id: rawOffer.id || rawOffer.catalogOfferId || null,
    itemType,
    itemId,
    itemName: normalizeText(rawOffer.itemName || rawOffer.materialName || itemRow.name || itemPayload.name) || itemId,
    variantKey: normalizeText(rawOffer.variantKey || rawOffer.productVariantKey || rawOffer.materialVariantId),
    variantLabel: normalizeText(rawOffer.variantLabel || rawOffer.variantName),
    listingName: normalizeText(rawOffer.listingName || rawOffer.supplierListingName),
    channel: normalizeText(rawOffer.channel || rawOffer.marketplace),
    productLink,
    purchaseType,
    purchaseUnit: normalizeText(rawOffer.purchaseUnit),
    purchaseQty: toPositiveInteger(rawOffer.purchaseQty, 1),
    conversionValue: toPositiveInteger(rawOffer.conversionValue, 1),
    stockUnit: normalizeText(rawOffer.stockUnit || itemPayload.stockUnit || itemPayload.unit),
    supplierItemPrice: toNonNegativeInteger(rawOffer.supplierItemPrice, 0),
    estimatedShippingCost: purchaseType === "offline" ? 0 : toNonNegativeInteger(rawOffer.estimatedShippingCost, 0),
    serviceFee: purchaseType === "offline" ? 0 : toNonNegativeInteger(rawOffer.serviceFee, 0),
    discount: purchaseType === "offline" ? 0 : toNonNegativeInteger(rawOffer.discount, 0),
    isPrimary: Boolean(rawOffer.isPrimary),
    status,
    availabilityStatus: ["stock_unavailable", "link_unavailable"].includes(rawOffer.availabilityStatus)
      ? rawOffer.availabilityStatus
      : "available",
    notes: normalizeText(rawOffer.note || rawOffer.notes),
  };
};


module.exports = {
  CATALOG_EVENT_TYPES,
  assertSafeHttpUrl,
  buildCatalogOfferSqlValues,
  buildSupplierPayload,
  createServiceError,
  ensureSupplierCodeAvailable,
  generateNextSupplierCode,
  normalizeCatalogOfferInput,
  normalizeCode: normalizeUpperText,
  normalizeItemType,
  normalizeText,
  resolveSupplierCreateCode,
  toCatalogOfferRecord,
  toNonNegativeInteger,
  toPositiveInteger,
  toSupplierRecord,
  validateSupplierCode,
  validateSupplierPayload,
};
