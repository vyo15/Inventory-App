const { getDb, runInTransaction } = require("../../db/connection");
const { createAuditLog } = require("../../utils/auditLog");
const {
  buildSupplierPayload,
  createServiceError,
  ensureSupplierCodeAvailable,
  generateNextSupplierCode,
  normalizeCode,
  resolveSupplierCreateCode,
  toCatalogOfferRecord,
  toSupplierRecord,
  validateSupplierCode,
  validateSupplierPayload,
} = require("./suppliers.shared");
const {
  getCatalogOffersBySupplierIds,
  insertCatalogHistory,
  syncSupplierCatalogOffers,
} = require("./suppliers.catalog.service");

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
  listSuppliers,
  softDeleteSupplier,
  updateSupplier,
};
