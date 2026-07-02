const { normalizeTruthyText: normalizeText, normalizeUpperText } = require("../../utils/textNormalization");
const { createServiceError } = require("../../utils/httpError");
const { getDb, runInTransaction } = require("../../db/connection");
const { createAuditLog } = require("../../utils/auditLog");
const { safeJsonParse } = require("../../utils/jsonUtils");
const categoryContract = require("../../../../shared/categoryContract.json");

const CATEGORY_TYPES = new Set(Object.values(categoryContract.types));

const CATEGORY_TYPE_ALIASES = Object.freeze({ ...categoryContract.aliases });

const CATEGORY_CODE_PREFIX = Object.freeze({ ...categoryContract.codePrefixes });


const normalizeCategoryType = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  return CATEGORY_TYPE_ALIASES[normalized] || normalized || categoryContract.defaultType;
};
const normalizeParentId = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
const normalizeSortOrder = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
};
const normalizeStatus = (value, fallback = "active") => {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === "inactive" || normalized === "active" ? normalized : fallback;
};


const toCategoryRecord = (row = {}, meta = {}) => ({
  id: row.id,
  code: row.code || "",
  name: row.name || "",
  description: row.notes || "",
  notes: row.notes || "",
  type: normalizeCategoryType(row.type),
  parentId: row.parent_id || null,
  sortOrder: Number(row.sort_order || 0),
  status: row.status || "active",
  isActive: row.status !== "inactive" && row.status !== "deleted",
  directUsageCount: Number(meta.directUsageCount || 0),
  usageCount: Number(meta.usageCount ?? meta.directUsageCount ?? 0),
  childCount: Number(meta.childCount || 0),
  activeChildCount: Number(meta.activeChildCount || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildCategoryPayload = (body = {}, current = {}) => ({
  code: normalizeUpperText(body.code || current.code),
  name: normalizeText(body.name ?? current.name),
  type: normalizeCategoryType(body.type || current.type),
  parentId: body.parentId === undefined && body.parent_id === undefined
    ? normalizeParentId(current.parent_id)
    : normalizeParentId(body.parentId ?? body.parent_id),
  sortOrder: body.sortOrder === undefined && body.sort_order === undefined
    ? normalizeSortOrder(current.sort_order)
    : normalizeSortOrder(body.sortOrder ?? body.sort_order),
  notes: normalizeText(body.description ?? body.notes ?? current.notes),
  status: normalizeStatus(body.status, current.status || "active"),
});

const ensureCategoryTypeSupported = (type) => {
  if (!CATEGORY_TYPES.has(type)) {
    throw createServiceError("Jenis kelompok kategori tidak didukung.", "INVALID_CATEGORY_TYPE", 400);
  }
};

const buildGeneratedCode = (type, name) => {
  const slug = normalizeText(name)
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase()
    .slice(0, 40) || "KATEGORI";
  return `${CATEGORY_CODE_PREFIX[type] || "KATEGORI"}-${slug}`;
};

const ensureCategoryCodeAvailable = async (db, code, excludeId = null) => {
  if (!code) return;

  const existing = await db.get(
    "SELECT id FROM categories WHERE code = ? AND id != ?",
    [code, excludeId || 0]
  );

  if (existing) {
    throw createServiceError(
      "Kode kategori sudah digunakan di database lokal.",
      "DUPLICATE_CODE",
      409
    );
  }
};

const generateAvailableCategoryCode = async (db, type, name) => {
  const baseCode = buildGeneratedCode(type, name);
  let candidate = baseCode;
  let suffix = 2;

  while (await db.get("SELECT id FROM categories WHERE code = ?", [candidate])) {
    candidate = `${baseCode}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

const ensureCategoryNameAvailable = async (db, payload, excludeId = null) => {
  const existing = await db.get(
    `
      SELECT id
      FROM categories
      WHERE status != 'deleted'
        AND type = ?
        AND LOWER(TRIM(name)) = LOWER(TRIM(?))
        AND COALESCE(parent_id, 0) = COALESCE(?, 0)
        AND id != ?
      LIMIT 1
    `,
    [payload.type, payload.name, payload.parentId, excludeId || 0]
  );

  if (existing) {
    throw createServiceError(
      "Nama kategori sudah digunakan pada kelompok dan induk yang sama.",
      "DUPLICATE_NAME",
      409
    );
  }
};

const ensureValidParent = async (db, payload, currentId = null) => {
  if (!payload.parentId) return null;
  if (String(payload.parentId) === String(currentId || "")) {
    throw createServiceError("Kategori tidak dapat menjadi induk bagi dirinya sendiri.", "INVALID_PARENT", 400);
  }

  const parent = await db.get(
    "SELECT * FROM categories WHERE id = ? AND status != 'deleted'",
    [payload.parentId]
  );

  if (!parent) {
    throw createServiceError("Kategori induk tidak ditemukan.", "PARENT_NOT_FOUND", 404);
  }
  if (normalizeCategoryType(parent.type) !== payload.type) {
    throw createServiceError("Kategori induk harus berada pada kelompok yang sama.", "PARENT_SCOPE_MISMATCH", 400);
  }
  if (parent.parent_id) {
    throw createServiceError("Struktur kategori dibatasi maksimal dua tingkat.", "CATEGORY_DEPTH_LIMIT", 400);
  }
  if (payload.status === "active" && parent.status === "inactive") {
    throw createServiceError("Aktifkan kategori induk terlebih dahulu.", "PARENT_INACTIVE", 409);
  }

  return parent;
};

const readUsageSnapshots = async (db) => {
  const [products, rawMaterials, semiFinished] = await Promise.all([
    db.all("SELECT payload_json FROM products WHERE status != 'deleted'"),
    db.all("SELECT payload_json FROM raw_materials WHERE status != 'deleted'"),
    db.all("SELECT payload_json FROM semi_finished_materials WHERE status != 'deleted'"),
  ]);

  return {
    products: products.map((row) => safeJsonParse(row.payload_json, {})),
    rawMaterials: rawMaterials.map((row) => safeJsonParse(row.payload_json, {})),
    semiFinished: semiFinished.map((row) => safeJsonParse(row.payload_json, {})),
  };
};

const matchesCategoryId = (value, categoryId) => String(value || "") === String(categoryId || "");
const matchesLegacyLabel = (value, category = {}) => {
  const normalizedValue = normalizeText(value).toLowerCase();
  if (!normalizedValue) return false;
  return [category.name, category.code]
    .map((candidate) => normalizeText(candidate).toLowerCase())
    .filter(Boolean)
    .includes(normalizedValue);
};

const countDirectCategoryUsage = (category = {}, snapshots = {}) => {
  const type = normalizeCategoryType(category.type);
  if (type === "product_form") {
    return snapshots.products.filter((item) => (
      matchesCategoryId(item.categoryId, category.id)
      || (!item.categoryId && matchesLegacyLabel(item.category || item.categoryName, category))
    )).length;
  }
  if (type === "flower_type") {
    const productUsage = snapshots.products.filter((item) => (
      matchesCategoryId(item.flowerTypeId, category.id)
      || (!item.flowerTypeId && matchesLegacyLabel(item.flowerType || item.flowerTypeName, category))
    )).length;
    const semiUsage = snapshots.semiFinished.filter((item) => (
      matchesCategoryId(item.flowerTypeId, category.id)
      || (!item.flowerTypeId && matchesLegacyLabel(item.flowerGroup, category))
    )).length;
    return productUsage + semiUsage;
  }
  if (type === "raw_material_group") {
    return snapshots.rawMaterials.filter((item) => (
      matchesCategoryId(item.categoryId, category.id)
      || (!item.categoryId && matchesLegacyLabel(item.category || item.categoryName, category))
    )).length;
  }
  if (type === "semi_finished_group") {
    return snapshots.semiFinished.filter((item) => (
      matchesCategoryId(item.categoryId, category.id)
      || (!item.categoryId && matchesLegacyLabel(item.componentGroup || item.componentGroupName, category))
    )).length;
  }
  return 0;
};

const attachCategoryMeta = async (db, rows = []) => {
  const snapshots = await readUsageSnapshots(db);
  const directUsageMap = new Map();
  const childMap = new Map();

  rows.forEach((row) => {
    directUsageMap.set(String(row.id), countDirectCategoryUsage(row, snapshots));
    const parentKey = String(row.parent_id || "");
    if (!parentKey) return;
    if (!childMap.has(parentKey)) childMap.set(parentKey, []);
    childMap.get(parentKey).push(row);
  });

  return rows.map((row) => {
    const children = childMap.get(String(row.id)) || [];
    const directUsageCount = directUsageMap.get(String(row.id)) || 0;
    const childUsageCount = children.reduce(
      (total, child) => total + (directUsageMap.get(String(child.id)) || 0),
      0
    );

    return toCategoryRecord(row, {
      directUsageCount,
      usageCount: directUsageCount + childUsageCount,
      childCount: children.length,
      activeChildCount: children.filter((child) => child.status === "active").length,
    });
  });
};

const listCategories = async ({ type = "", status = "" } = {}) => {
  const db = await getDb();
  const normalizedType = type ? normalizeCategoryType(type) : "";
  const normalizedStatus = normalizeText(status).toLowerCase();
  const clauses = ["status != 'deleted'"];
  const params = [];

  if (normalizedType) {
    ensureCategoryTypeSupported(normalizedType);
    clauses.push("type = ?");
    params.push(normalizedType);
  }
  if (normalizedStatus === "active" || normalizedStatus === "inactive") {
    clauses.push("status = ?");
    params.push(normalizedStatus);
  }

  const rows = await db.all(
    `
      SELECT *
      FROM categories
      WHERE ${clauses.join(" AND ")}
      ORDER BY type ASC, COALESCE(parent_id, 0) ASC, sort_order ASC, name ASC, id ASC
      LIMIT 1000
    `,
    params
  );
  return attachCategoryMeta(db, rows);
};

const getCategoryByIdFromDb = async (db, id) => {
  const row = await db.get(
    "SELECT * FROM categories WHERE id = ? AND status != 'deleted'",
    [id]
  );
  if (!row) return null;

  // Metadata parent/child membutuhkan seluruh kategori pada scope yang sama.
  const scopedRows = await db.all(
    "SELECT * FROM categories WHERE type = ? AND status != 'deleted'",
    [row.type]
  );
  const records = await attachCategoryMeta(db, scopedRows);
  return records.find((record) => String(record.id) === String(id)) || null;
};

const getCategoryById = async (id) => {
  const db = await getDb();
  return getCategoryByIdFromDb(db, id);
};

const createCategory = async (body = {}, actor = "system") => runInTransaction(async (db) => {
  const payload = buildCategoryPayload(body);

  if (!payload.name) {
    throw createServiceError("Nama kategori wajib diisi", "VALIDATION_ERROR", 400);
  }
  ensureCategoryTypeSupported(payload.type);
  await ensureValidParent(db, payload);
  await ensureCategoryNameAvailable(db, payload);

  const code = payload.code || await generateAvailableCategoryCode(db, payload.type, payload.name);
  await ensureCategoryCodeAvailable(db, code);

  const result = await db.run(
    `
      INSERT INTO categories (
        code, name, type, parent_id, sort_order, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [code, payload.name, payload.type, payload.parentId, payload.sortOrder, payload.notes, payload.status]
  );

  await createAuditLog({
    module: "categories",
    action: "create",
    entityType: "category",
    entityId: result.lastID,
    actor,
    description: `Kategori ${payload.name} dibuat di database lokal`,
    metadata: {
      code,
      name: payload.name,
      type: payload.type,
      parentId: payload.parentId,
    },
  });

  return getCategoryByIdFromDb(db, result.lastID);
});

const updateCategory = async (id, body = {}, actor = "system") => runInTransaction(async (db) => {
  const current = await db.get(
    "SELECT * FROM categories WHERE id = ? AND status != 'deleted'",
    [id]
  );

  if (!current) {
    throw createServiceError("Kategori database lokal tidak ditemukan", "NOT_FOUND", 404);
  }

  const payload = buildCategoryPayload(body, current);
  if (!payload.name) {
    throw createServiceError("Nama kategori wajib diisi", "VALIDATION_ERROR", 400);
  }
  ensureCategoryTypeSupported(payload.type);

  const children = await db.get(
    `
      SELECT
        COUNT(*) AS count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count
      FROM categories
      WHERE parent_id = ? AND status != 'deleted'
    `,
    [current.id]
  );
  const snapshots = await readUsageSnapshots(db);
  const directUsageCount = countDirectCategoryUsage(current, snapshots);

  if (payload.type !== normalizeCategoryType(current.type) && (children.count > 0 || directUsageCount > 0)) {
    throw createServiceError(
      "Kelompok kategori tidak dapat diubah karena sudah memiliki subkategori atau sedang digunakan.",
      "CATEGORY_SCOPE_LOCKED",
      409
    );
  }
  if (payload.parentId && children.count > 0) {
    throw createServiceError(
      "Kategori yang memiliki subkategori tidak dapat dipindahkan menjadi subkategori.",
      "CATEGORY_HAS_CHILDREN",
      409
    );
  }

  await ensureValidParent(db, payload, current.id);
  await ensureCategoryNameAvailable(db, payload, current.id);

  if (payload.status === "inactive" && current.status !== "inactive") {
    if (Number(children.active_count || 0) > 0) {
      throw createServiceError(
        "Nonaktifkan subkategori aktif terlebih dahulu.",
        "CATEGORY_HAS_ACTIVE_CHILDREN",
        409
      );
    }
    if (directUsageCount > 0) {
      throw createServiceError(
        `Kategori masih digunakan oleh ${directUsageCount} data. Pindahkan data tersebut terlebih dahulu.`,
        "CATEGORY_IN_USE",
        409
      );
    }
  }

  const immutableCode = normalizeUpperText(current.code)
    || payload.code
    || await generateAvailableCategoryCode(db, payload.type, payload.name);
  await ensureCategoryCodeAvailable(db, immutableCode, current.id);

  await db.run(
    `
      UPDATE categories
      SET code = ?, name = ?, type = ?, parent_id = ?, sort_order = ?, notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [
      immutableCode,
      payload.name,
      payload.type,
      payload.parentId,
      payload.sortOrder,
      payload.notes,
      payload.status,
      current.id,
    ]
  );

  await createAuditLog({
    module: "categories",
    action: payload.status !== current.status ? "status_change" : "update",
    entityType: "category",
    entityId: current.id,
    actor,
    description: `Kategori ${payload.name} diubah di database lokal`,
    metadata: {
      code: immutableCode,
      name: payload.name,
      type: payload.type,
      parentId: payload.parentId,
      previousStatus: current.status,
      status: payload.status,
    },
  });

  return getCategoryByIdFromDb(db, current.id);
});

const softDeleteCategory = async (id, actor = "system") => updateCategory(
  id,
  { status: "inactive" },
  actor
);

module.exports = {
  CATEGORY_TYPES,
  countDirectCategoryUsage,
  createCategory,
  getCategoryById,
  listCategories,
  normalizeCategoryType,
  softDeleteCategory,
  updateCategory,
};
