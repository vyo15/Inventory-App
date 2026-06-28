const { getDb, runInTransaction } = require("../../db/connection");
const { safeJsonParse } = require("../../utils/jsonUtils");
const {
  CATALOG_EVENT_TYPES,
  buildCatalogOfferSqlValues,
  createServiceError,
  normalizeCatalogOfferInput,
  normalizeItemType,
  normalizeText,
  toCatalogOfferRecord,
  toNonNegativeInteger,
  toPositiveInteger,
} = require("./suppliers.shared");

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
          ...buildCatalogOfferSqlValues(offer, isPrimary),
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
        ...buildCatalogOfferSqlValues(offer, isPrimary),
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


module.exports = {
  getCatalogOffersBySupplierIds,
  insertCatalogHistory,
  listSupplierCatalogHistory,
  syncSupplierCatalogOffers,
  verifyCatalogOfferWithDb,
  verifyPurchaseCatalogOfferWithDb,
  verifySupplierCatalogOffer,
};
