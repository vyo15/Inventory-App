const { getDb, runInTransaction } = require("../../db/connection");
const { createAuditLog } = require("../../utils/auditLog");
const { safeJsonParse } = require("../../utils/jsonUtils");
const {
  getBusinessCodePreview,
  resolveBusinessCode,
} = require("../../utils/businessCodeCounter");

const SUPPLIER_CODE_PREFIX = "SUP";
const SUPPLIER_CODE_PATTERN = /^SUP-\d{8}-\d{3,}$/;
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

const normalizeText = (value) => String(value || "").trim();
const normalizeCode = (value) => normalizeText(value).toUpperCase();
const toNonNegativeInteger = (value, fallback = 0) => {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
};
const toPositiveInteger = (value, fallback = 1) => {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};
const normalizeItemType = (value = "") => {
  const normalized = normalizeText(value).toLowerCase();
  if (["material", "raw", "raw_material", "raw_materials"].includes(normalized)) return "raw_material";
  if (["product", "products"].includes(normalized)) return "product";
  return normalized;
};

const createServiceError = (message, code = "ERROR", statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.isServiceError = true;
  return error;
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

const getDateStamp = (date = new Date()) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
};

const getSupplierCounterOptions = (dateStamp = getDateStamp()) => ({
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
  const normalizedCode = normalizeCode(requestedCode);
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

const calculateCatalogMetrics = (offer = {}) => {
  const purchaseType = offer.purchaseType === "offline" ? "offline" : "online";
  const purchaseQty = toPositiveInteger(offer.purchaseQty, 1);
  const conversionValue = toPositiveInteger(offer.conversionValue, 1);
  const supplierItemPrice = toNonNegativeInteger(offer.supplierItemPrice, 0);
  const estimatedShippingCost = purchaseType === "offline"
    ? 0
    : toNonNegativeInteger(offer.estimatedShippingCost, 0);
  const serviceFee = purchaseType === "offline"
    ? 0
    : toNonNegativeInteger(offer.serviceFee, 0);
  const discount = purchaseType === "offline"
    ? 0
    : toNonNegativeInteger(offer.discount, 0);
  const totalStockQty = purchaseQty * conversionValue;
  const totalEstimatedSupplier = Math.max(
    0,
    (purchaseQty * supplierItemPrice) + estimatedShippingCost + serviceFee - discount,
  );
  const estimatedUnitPrice = totalStockQty > 0
    ? Math.round(totalEstimatedSupplier / totalStockQty)
    : 0;

  return {
    purchaseType,
    purchaseQty,
    conversionValue,
    supplierItemPrice,
    estimatedShippingCost,
    serviceFee,
    discount,
    totalStockQty,
    totalEstimatedSupplier,
    estimatedUnitPrice,
  };
};

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
  supplierCode: normalizeCode(body.code || body.supplierCode || body.supplier_code),
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

const insertCatalogHistory = async (db, {
  supplierId,
  offerId = null,
  eventType,
  offer = {},
  previousPrice = null,
  newPrice = null,
  resultStatus = "",
  description = "",
  metadata = null,
  actor = "system",
}) => {
  if (!CATALOG_EVENT_TYPES.has(eventType)) {
    throw createServiceError("Jenis histori katalog Supplier tidak valid.", "INVALID_HISTORY_EVENT", 500);
  }

  await db.run(
    `
      INSERT INTO supplier_catalog_history (
        supplier_id, offer_id, event_type, item_type, item_id, item_name,
        previous_price, new_price, result_status, description, metadata_json, actor
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      supplierId,
      offerId,
      eventType,
      offer.itemType || offer.item_type || null,
      offer.itemId || offer.item_id || null,
      offer.itemName || offer.item_name || null,
      previousPrice,
      newPrice,
      resultStatus || null,
      description,
      metadata ? JSON.stringify(metadata) : null,
      actor,
    ],
  );
};

const getCatalogOffersBySupplierIds = async (db, supplierIds = [], { includeInactive = true } = {}) => {
  if (!supplierIds.length) return [];
  const placeholders = supplierIds.map(() => "?").join(", ");
  const statusClause = includeInactive ? "status != 'deleted'" : "status = 'active'";
  const rows = await db.all(
    `SELECT * FROM supplier_catalog_offers WHERE supplier_id IN (${placeholders}) AND ${statusClause} ORDER BY item_name ASC, is_primary DESC, id ASC`,
    supplierIds,
  );
  return rows.map(toCatalogOfferRecord);
};

const syncSupplierCatalogOffers = async (db, supplierId, rawOffers = [], actor = "system") => {
  const normalizedOffers = [];
  for (const rawOffer of rawOffers) {
    normalizedOffers.push(await normalizeCatalogOfferInput(db, rawOffer));
  }

  const duplicateKeys = new Set();
  for (const offer of normalizedOffers) {
    const key = [offer.itemType, offer.itemId, offer.variantKey, offer.productLink || "offline", offer.listingName].join("::").toLowerCase();
    if (duplicateKeys.has(key)) {
      throw createServiceError("Katalog Supplier memiliki baris barang/link yang sama.", "DUPLICATE_CATALOG_OFFER", 409);
    }
    duplicateKeys.add(key);
  }

  const existingRows = await db.all(
    "SELECT * FROM supplier_catalog_offers WHERE supplier_id = ? AND status != 'deleted' ORDER BY id ASC",
    [supplierId],
  );
  const existingById = new Map(existingRows.map((row) => [String(row.id), row]));
  const retainedIds = new Set();
  const primaryByItem = new Set();

  for (const offer of normalizedOffers) {
    const primaryKey = [offer.itemType, offer.itemId, offer.variantKey].join("::");
    const isPrimary = offer.isPrimary && !primaryByItem.has(primaryKey);
    if (isPrimary) primaryByItem.add(primaryKey);

    if (offer.id) {
      const current = existingById.get(String(offer.id));
      if (!current) {
        throw createServiceError("Penawaran katalog Supplier tidak ditemukan.", "CATALOG_OFFER_NOT_FOUND", 404);
      }
      retainedIds.add(String(current.id));

      const previous = toCatalogOfferRecord(current);
      await db.run(
        `
          UPDATE supplier_catalog_offers
          SET item_type = ?, item_id = ?, item_name = ?, variant_key = ?, variant_label = ?,
              listing_name = ?, channel = ?, product_link = ?, purchase_type = ?, purchase_unit = ?,
              purchase_qty = ?, conversion_value = ?, stock_unit = ?, supplier_item_price = ?,
              estimated_shipping_cost = ?, service_fee = ?, discount = ?, is_primary = ?, status = ?,
              availability_status = ?, notes = ?, price_updated_at = CASE WHEN supplier_item_price != ? THEN CURRENT_TIMESTAMP ELSE price_updated_at END,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND supplier_id = ?
        `,
        [
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
          offer.supplierItemPrice,
          current.id,
          supplierId,
        ],
      );

      if (previous.supplierItemPrice !== offer.supplierItemPrice) {
        await insertCatalogHistory(db, {
          supplierId,
          offerId: current.id,
          eventType: "price_changed",
          offer,
          previousPrice: previous.supplierItemPrice,
          newPrice: offer.supplierItemPrice,
          resultStatus: offer.supplierItemPrice > previous.supplierItemPrice ? "price_up" : "price_down",
          description: `Harga katalog ${offer.itemName} diperbarui.`,
          actor,
        });
      }
      if (previous.productLink !== offer.productLink) {
        await insertCatalogHistory(db, {
          supplierId,
          offerId: current.id,
          eventType: "link_changed",
          offer,
          description: `Link katalog ${offer.itemName} diperbarui.`,
          metadata: { previousLink: previous.productLink, newLink: offer.productLink },
          actor,
        });
      }
      if (previous.status !== offer.status) {
        await insertCatalogHistory(db, {
          supplierId,
          offerId: current.id,
          eventType: offer.status === "active" ? "offer_enabled" : "offer_disabled",
          offer,
          description: `Penawaran ${offer.itemName} ${offer.status === "active" ? "diaktifkan" : "dinonaktifkan"}.`,
          actor,
        });
      }
      if (
        previous.itemType !== offer.itemType
        || previous.itemId !== offer.itemId
        || previous.variantKey !== offer.variantKey
        || previous.purchaseUnit !== offer.purchaseUnit
        || previous.purchaseQty !== offer.purchaseQty
        || previous.conversionValue !== offer.conversionValue
        || previous.stockUnit !== offer.stockUnit
        || previous.channel !== offer.channel
        || previous.listingName !== offer.listingName
        || previous.notes !== offer.notes
      ) {
        await insertCatalogHistory(db, {
          supplierId,
          offerId: current.id,
          eventType: "offer_updated",
          offer,
          description: `Detail katalog ${offer.itemName} diperbarui.`,
          actor,
        });
      }
      continue;
    }

    const result = await db.run(
      `
        INSERT INTO supplier_catalog_offers (
          supplier_id, item_type, item_id, item_name, variant_key, variant_label,
          listing_name, channel, product_link, purchase_type, purchase_unit,
          purchase_qty, conversion_value, stock_unit, supplier_item_price,
          estimated_shipping_cost, service_fee, discount, is_primary, status, availability_status, notes,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `,
      [
        supplierId,
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
      ],
    );
    retainedIds.add(String(result.lastID));
    await insertCatalogHistory(db, {
      supplierId,
      offerId: result.lastID,
      eventType: "offer_created",
      offer,
      newPrice: offer.supplierItemPrice,
      resultStatus: "active",
      description: `Penawaran ${offer.itemName} ditambahkan ke katalog toko.`,
      actor,
    });
  }

  for (const current of existingRows) {
    if (retainedIds.has(String(current.id))) continue;
    if (current.status !== "inactive") {
      await db.run(
        "UPDATE supplier_catalog_offers SET status = 'inactive', is_primary = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND supplier_id = ?",
        [current.id, supplierId],
      );
      await insertCatalogHistory(db, {
        supplierId,
        offerId: current.id,
        eventType: "offer_disabled",
        offer: toCatalogOfferRecord(current),
        description: `Penawaran ${current.item_name} dinonaktifkan dari katalog toko.`,
        actor,
      });
    }
  }
};

const generateSupplierCode = async () => {
  const db = await getDb();
  return generateNextSupplierCode(db);
};

const listSuppliers = async () => {
  const db = await getDb();
  const rows = await db.all(
    "SELECT * FROM suppliers WHERE status != 'deleted' ORDER BY name ASC, id DESC LIMIT 500",
  );
  const offers = await getCatalogOffersBySupplierIds(db, rows.map((row) => row.id));
  const offersBySupplier = new Map();
  for (const offer of offers) {
    const key = String(offer.supplierId);
    offersBySupplier.set(key, [...(offersBySupplier.get(key) || []), offer]);
  }
  return rows.map((row) => toSupplierRecord(row, offersBySupplier.get(String(row.id)) || []));
};

const getSupplierById = async (id) => {
  const db = await getDb();
  const row = await db.get(
    "SELECT * FROM suppliers WHERE id = ? AND status != 'deleted'",
    [id],
  );
  if (!row) return null;
  const offers = await getCatalogOffersBySupplierIds(db, [row.id]);
  return toSupplierRecord(row, offers);
};

const createSupplier = async (body = {}, actor = "system") => runInTransaction(async (db) => {
  const payload = buildSupplierPayload(body);
  validateSupplierPayload(payload);

  const finalCode = await resolveSupplierCreateCode(db, payload.supplierCode);
  validateSupplierCode(finalCode);
  await ensureSupplierCodeAvailable(db, finalCode);

  const result = await db.run(
    `
      INSERT INTO suppliers (supplier_code, name, store_link, phone, address, notes, payload_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [
      finalCode,
      payload.name,
      payload.storeLink,
      payload.phone,
      payload.address,
      payload.notes,
      JSON.stringify(payload.payload),
    ],
  );

  await syncSupplierCatalogOffers(db, result.lastID, payload.catalogOffers || [], actor);
  const supplier = await db.get("SELECT * FROM suppliers WHERE id = ?", [result.lastID]);
  const offers = await getCatalogOffersBySupplierIds(db, [result.lastID]);

  await createAuditLog({
    module: "suppliers",
    action: "create",
    entityType: "supplier",
    entityId: result.lastID,
    actor,
    description: `Supplier ${payload.name} dibuat di database lokal`,
    metadata: { supplierCode: finalCode, name: payload.name, catalogCount: offers.length },
  });

  return toSupplierRecord(supplier, offers);
});

const updateSupplier = async (id, body = {}, actor = "system") => runInTransaction(async (db) => {
  const current = await db.get(
    "SELECT * FROM suppliers WHERE id = ? AND status != 'deleted'",
    [id],
  );

  if (!current) {
    throw createServiceError("Supplier database lokal tidak ditemukan", "NOT_FOUND", 404);
  }

  const payload = buildSupplierPayload(body);
  const immutableCode = normalizeCode(current.supplier_code || payload.supplierCode);
  validateSupplierPayload(payload);
  validateSupplierCode(immutableCode);
  await ensureSupplierCodeAvailable(db, immutableCode, current.id);

  await db.run(
    `
      UPDATE suppliers
      SET supplier_code = ?, name = ?, store_link = ?, phone = ?, address = ?, notes = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [
      immutableCode,
      payload.name,
      payload.storeLink,
      payload.phone,
      payload.address,
      payload.notes,
      JSON.stringify(payload.payload),
      current.id,
    ],
  );

  if (Array.isArray(payload.catalogOffers)) {
    await syncSupplierCatalogOffers(db, current.id, payload.catalogOffers, actor);
  }
  const updated = await db.get("SELECT * FROM suppliers WHERE id = ?", [current.id]);
  const offers = await getCatalogOffersBySupplierIds(db, [current.id]);

  await createAuditLog({
    module: "suppliers",
    action: "update",
    entityType: "supplier",
    entityId: current.id,
    actor,
    description: `Supplier ${payload.name} diubah di database lokal`,
    metadata: { supplierCode: immutableCode, name: payload.name, catalogCount: offers.length },
  });

  return toSupplierRecord(updated, offers);
});

const toCatalogHistoryRecord = (row = {}) => ({
  id: row.id,
  supplierId: row.supplier_id,
  catalogOfferId: row.offer_id,
  eventType: row.event_type,
  itemType: row.item_type || "",
  itemId: row.item_id || "",
  itemName: row.item_name || "",
  previousPrice: row.previous_price,
  newPrice: row.new_price,
  resultStatus: row.result_status || "",
  description: row.description || "",
  metadata: safeJsonParse(row.metadata_json, null),
  actor: row.actor || "system",
  createdAt: row.created_at,
});

const listSupplierCatalogHistory = async (supplierId, { limit = 100, offset = 0, eventType = "" } = {}) => {
  const db = await getDb();
  const supplier = await db.get(
    "SELECT id FROM suppliers WHERE id = ? AND status != 'deleted'",
    [supplierId],
  );
  if (!supplier) {
    throw createServiceError("Supplier database lokal tidak ditemukan", "NOT_FOUND", 404);
  }

  const safeLimit = Math.min(Math.max(toPositiveInteger(limit, 100), 1), 200);
  const safeOffset = Math.max(toNonNegativeInteger(offset, 0), 0);
  const normalizedEventType = normalizeText(eventType);
  const params = [supplierId];
  let eventClause = "";
  if (normalizedEventType) {
    eventClause = "AND event_type = ?";
    params.push(normalizedEventType);
  }
  params.push(safeLimit, safeOffset);

  const rows = await db.all(
    `
      SELECT * FROM supplier_catalog_history
      WHERE supplier_id = ? ${eventClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    params,
  );
  return rows.map(toCatalogHistoryRecord);
};

const verifyCatalogOfferWithDb = async (db, {
  supplierId,
  offerId,
  actualPrice,
  resultStatus = "verified",
  note = "",
  actor = "system",
  eventSource = "manual",
}) => {
  const row = await db.get(
    "SELECT * FROM supplier_catalog_offers WHERE id = ? AND supplier_id = ? AND status = 'active'",
    [offerId, supplierId],
  );
  if (!row) {
    throw createServiceError("Penawaran katalog Supplier tidak ditemukan.", "CATALOG_OFFER_NOT_FOUND", 404);
  }

  const normalizedStatus = normalizeText(resultStatus).toLowerCase();
  const normalizedActualPrice = toNonNegativeInteger(actualPrice, 0);
  if (!["stock_unavailable", "link_unavailable"].includes(normalizedStatus) && normalizedActualPrice <= 0) {
    throw createServiceError("Harga aktual harus lebih dari 0.", "VALIDATION_ERROR", 400);
  }
  const previousPrice = toNonNegativeInteger(row.supplier_item_price, 0);
  const offer = toCatalogOfferRecord(row);
  const priceChanged = ["verified", "price_same", "price_up", "price_down"].includes(normalizedStatus)
    && normalizedActualPrice !== previousPrice;
  const timestamp = new Date().toISOString();

  let eventType = eventSource === "purchase" ? "purchase_price_checked" : "price_checked";
  let description = `Harga ${offer.itemName} diperiksa dan masih sesuai.`;
  let finalResultStatus = "price_same";
  let nextAvailabilityStatus = "available";

  if (normalizedStatus === "stock_unavailable") {
    nextAvailabilityStatus = "stock_unavailable";
    eventType = "stock_unavailable";
    description = `${offer.itemName} sedang tidak tersedia di toko.`;
    finalResultStatus = "stock_unavailable";
  } else if (normalizedStatus === "link_unavailable") {
    nextAvailabilityStatus = "link_unavailable";
    eventType = "link_unavailable";
    description = `Link ${offer.itemName} tidak tersedia.`;
    finalResultStatus = "link_unavailable";
  } else if (priceChanged) {
    eventType = eventSource === "purchase" ? "purchase_price_changed" : "price_changed";
    finalResultStatus = normalizedActualPrice > previousPrice ? "price_up" : "price_down";
    description = `Harga ${offer.itemName} ${normalizedActualPrice > previousPrice ? "naik" : "turun"} dan katalog diperbarui.`;
  }

  await db.run(
    `
      UPDATE supplier_catalog_offers
      SET supplier_item_price = ?, last_checked_at = ?, last_checked_by = ?,
          price_updated_at = CASE WHEN supplier_item_price != ? THEN ? ELSE price_updated_at END,
          availability_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND supplier_id = ?
    `,
    [
      ["stock_unavailable", "link_unavailable"].includes(normalizedStatus) ? previousPrice : normalizedActualPrice,
      timestamp,
      actor,
      normalizedActualPrice,
      timestamp,
      nextAvailabilityStatus,
      offerId,
      supplierId,
    ],
  );

  await insertCatalogHistory(db, {
    supplierId,
    offerId,
    eventType,
    offer,
    previousPrice,
    newPrice: ["stock_unavailable", "link_unavailable"].includes(normalizedStatus)
      ? previousPrice
      : normalizedActualPrice,
    resultStatus: finalResultStatus,
    description,
    metadata: { note: normalizeText(note), eventSource },
    actor,
  });

  const updated = await db.get("SELECT * FROM supplier_catalog_offers WHERE id = ?", [offerId]);
  return {
    offer: toCatalogOfferRecord(updated),
    priceChanged,
    previousPrice,
    actualPrice: ["stock_unavailable", "link_unavailable"].includes(normalizedStatus)
      ? previousPrice
      : normalizedActualPrice,
    resultStatus: finalResultStatus,
    checkedAt: timestamp,
  };
};

const verifySupplierCatalogOffer = async ({
  supplierId,
  offerId,
  actualPrice,
  resultStatus,
  note,
  actor = "system",
}) => runInTransaction((db) => verifyCatalogOfferWithDb(db, {
  supplierId,
  offerId,
  actualPrice,
  resultStatus,
  note,
  actor,
  eventSource: "manual",
}));

const verifyPurchaseCatalogOfferWithDb = async (db, body = {}, actor = "system") => {
  const supplierId = normalizeText(body.supplierId);
  if (!supplierId) {
    throw createServiceError(
      "Supplier wajib dipilih sebelum menyimpan Pembelian.",
      "PURCHASE_SUPPLIER_REQUIRED",
      400,
    );
  }

  const offerId = normalizeText(body.catalogOfferId || body.offerId);
  if (!offerId) {
    throw createServiceError(
      "Pilih penawaran/link katalog Supplier sebelum menyimpan Pembelian.",
      "CATALOG_OFFER_REQUIRED",
      400,
    );
  }
  if (body.priceVerified !== true || !normalizeText(body.priceVerifiedAt)) {
    throw createServiceError(
      "Harga aktual wajib diperiksa dan dikonfirmasi sebelum menyimpan Pembelian.",
      "PURCHASE_PRICE_VERIFICATION_REQUIRED",
      400,
    );
  }

  const row = await db.get(
    "SELECT * FROM supplier_catalog_offers WHERE id = ? AND supplier_id = ? AND status = 'active' AND availability_status = 'available'",
    [offerId, supplierId],
  );
  if (!row) {
    throw createServiceError("Penawaran katalog Supplier tidak aktif atau tidak ditemukan.", "CATALOG_OFFER_NOT_FOUND", 404);
  }

  const offer = toCatalogOfferRecord(row);
  const itemType = normalizeItemType(body.sourceType || body.itemType || body.type);
  const itemId = normalizeText(body.sourceId || body.itemId);
  const variantKey = normalizeText(body.variantKey || body.productVariantKey || body.materialVariantId);
  if (offer.itemType !== itemType || String(offer.itemId) !== String(itemId)) {
    throw createServiceError("Penawaran Supplier tidak sesuai dengan barang Pembelian.", "CATALOG_OFFER_ITEM_MISMATCH", 400);
  }
  if (offer.variantKey && offer.variantKey !== variantKey) {
    throw createServiceError("Penawaran Supplier tidak sesuai dengan varian Pembelian.", "CATALOG_OFFER_VARIANT_MISMATCH", 400);
  }

  const quantity = toPositiveInteger(body.quantity || body.qty, 1);
  const subtotalItems = toNonNegativeInteger(body.subtotalItems, 0);
  const actualPackagePrice = quantity > 0 ? Math.round(subtotalItems / quantity) : 0;
  const verifiedCatalogPrice = toNonNegativeInteger(body.verifiedCatalogPrice, 0);
  if (actualPackagePrice <= 0 || verifiedCatalogPrice !== actualPackagePrice) {
    throw createServiceError(
      "Harga yang diverifikasi tidak lagi sama dengan subtotal dan Qty Pembelian. Verifikasi ulang harga.",
      "PURCHASE_PRICE_VERIFICATION_STALE",
      400,
    );
  }

  const verification = await verifyCatalogOfferWithDb(db, {
    supplierId,
    offerId,
    actualPrice: actualPackagePrice,
    resultStatus: actualPackagePrice === offer.supplierItemPrice ? "price_same" : "verified",
    note: body.priceVerificationNote || "Verifikasi sebelum Pembelian",
    actor,
    eventSource: "purchase",
  });

  return {
    catalogOfferId: Number(offerId),
    supplierId: Number(supplierId),
    itemType: offer.itemType,
    itemId: offer.itemId,
    itemName: offer.itemName,
    variantKey: offer.variantKey,
    listingName: offer.listingName,
    channel: offer.channel,
    productLink: offer.productLink,
    purchaseUnit: offer.purchaseUnit,
    conversionValue: offer.conversionValue,
    stockUnit: offer.stockUnit,
    referencePriceBeforeVerification: verification.previousPrice,
    verifiedCatalogPrice: verification.actualPrice,
    priceVerificationResult: verification.resultStatus,
    priceVerifiedAt: verification.checkedAt,
    priceVerifiedBy: actor,
  };
};

const softDeleteSupplier = async (id, actor = "system") => runInTransaction(async (db) => {
  const current = await db.get(
    "SELECT * FROM suppliers WHERE id = ? AND status != 'deleted'",
    [id],
  );

  if (!current) {
    throw createServiceError("Supplier database lokal tidak ditemukan", "NOT_FOUND", 404);
  }

  const activeOffers = await db.all(
    "SELECT * FROM supplier_catalog_offers WHERE supplier_id = ? AND status = 'active'",
    [current.id],
  );
  for (const offerRow of activeOffers) {
    await db.run(
      "UPDATE supplier_catalog_offers SET status = 'inactive', is_primary = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [offerRow.id],
    );
    await insertCatalogHistory(db, {
      supplierId: current.id,
      offerId: offerRow.id,
      eventType: "offer_disabled",
      offer: toCatalogOfferRecord(offerRow),
      description: `Penawaran ${offerRow.item_name} dinonaktifkan bersama Supplier.`,
      actor,
    });
  }

  await db.run(
    "UPDATE suppliers SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [current.id],
  );

  await createAuditLog({
    module: "suppliers",
    action: "soft_delete",
    entityType: "supplier",
    entityId: current.id,
    actor,
    description: `Supplier ${current.name} dinonaktifkan di database lokal`,
    metadata: { supplierCode: current.supplier_code, name: current.name },
  });

  return {
    id: current.id,
    deleted: true,
    softDeleted: true,
  };
});

module.exports = {
  createSupplier,
  generateSupplierCode,
  getSupplierById,
  listSupplierCatalogHistory,
  listSuppliers,
  softDeleteSupplier,
  updateSupplier,
  verifyPurchaseCatalogOfferWithDb,
  verifySupplierCatalogOffer,
};
