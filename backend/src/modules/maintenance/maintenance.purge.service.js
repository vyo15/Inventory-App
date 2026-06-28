const { getDb, runInTransaction, runSerializedDbOperation } = require("../../db/connection");
const { TABLES } = require("../../db/schema");
const { createAuditLog } = require("../../utils/auditLog");
const { safeJsonParse } = require("../../utils/jsonUtils");
const { createOfficialSqliteBackup } = require("./backup");
const { createHttpError } = require("./maintenance.shared");

const INACTIVE_PURGE_CONFIRM_KEYWORD = "HAPUS PERMANEN";

const JSON_REFERENCE_TABLES = Object.freeze([
  TABLES.PRODUCTS,
  TABLES.RAW_MATERIALS,
  TABLES.SEMI_FINISHED_MATERIALS,
  TABLES.STOCK_READ_MODELS,
  TABLES.STOCK_ADJUSTMENTS,
  TABLES.INVENTORY_LOGS,
  TABLES.PURCHASES,
  TABLES.SALES,
  TABLES.RETURNS,
  TABLES.INCOMES,
  TABLES.EXPENSES,
  TABLES.MONEY_MOVEMENT_LEDGER,
  TABLES.PRODUCTION_STEPS,
  TABLES.PRODUCTION_EMPLOYEES,
  TABLES.PRODUCTION_PROFILES,
  TABLES.PRODUCTION_BOMS,
  TABLES.PRODUCTION_PLANNING,
  TABLES.PRODUCTION_ORDERS,
  TABLES.PRODUCTION_WORK_LOGS,
  TABLES.PRODUCTION_PAYROLLS,
  TABLES.REPORT_SNAPSHOTS,
]);

const ENTITY_CONFIGS = Object.freeze({
  customer: {
    table: TABLES.CUSTOMERS,
    label: "Customer",
    inactiveWhere: "status IN ('inactive', 'deleted')",
    codeFields: ["customer_code"],
    idReferenceKeys: ["customerid", "customer_id", "relatedcustomerid", "related_customer_id"],
    codeReferenceKeys: ["customercode", "customer_code"],
  },
  category: {
    table: TABLES.CATEGORIES,
    label: "Kategori",
    inactiveWhere: "status IN ('inactive', 'deleted')",
    codeFields: ["code"],
    idReferenceKeys: [
      "categoryid",
      "category_id",
      "productformid",
      "product_form_id",
      "flowertypeid",
      "flower_type_id",
      "materialgroupid",
      "material_group_id",
      "componentgroupid",
      "component_group_id",
    ],
    codeReferenceKeys: ["categorycode", "category_code"],
  },
  supplier: {
    table: TABLES.SUPPLIERS,
    label: "Supplier",
    inactiveWhere: "status IN ('inactive', 'deleted')",
    codeFields: ["supplier_code"],
    idReferenceKeys: ["supplierid", "supplier_id", "vendorid", "vendor_id"],
    codeReferenceKeys: ["suppliercode", "supplier_code", "vendorcode", "vendor_code"],
  },
  pricing_rule: {
    table: TABLES.PRICING_RULES,
    label: "Aturan Harga",
    inactiveWhere: "status IN ('inactive', 'deleted') OR is_active = 0",
    codeFields: ["code"],
    idReferenceKeys: ["pricingruleid", "pricing_rule_id", "ruleid", "rule_id", "pricingruleids"],
    codeReferenceKeys: ["pricingrulecode", "pricing_rule_code", "rulecode", "rule_code"],
  },
  user: {
    table: TABLES.USERS,
    label: "User",
    inactiveWhere: "status = 'inactive'",
    codeFields: ["username"],
    idReferenceKeys: [],
    codeReferenceKeys: [],
  },
});

const JSON_REFERENCE_KEYS = new Set(
  Object.values(ENTITY_CONFIGS).flatMap((config) => [
    ...(config.idReferenceKeys || []),
    ...(config.codeReferenceKeys || []),
  ]),
);
const SENSITIVE_SNAPSHOT_KEYS = new Set([
  "password_hash",
  "password",
  "token",
  "secret",
  "email",
  "phone",
  "telephone",
  "mobile",
  "whatsapp",
  "wa",
  "address",
  "alamat",
  "contact",
  "contactperson",
  "contact_person",
  "pic",
]);

const normalizeKey = (value = "") => String(value || "").trim().toLowerCase();
const normalizeComparable = (value) => String(value ?? "").trim().toLowerCase();

const getCandidateCode = (row = {}, config = {}) => {
  for (const field of config.codeFields || []) {
    if (row[field]) return String(row[field]);
  }
  return String(row.code || row.username || row.id || "");
};

const getCandidateName = (row = {}) => String(
  row.name || row.display_name || row.username || row.code || row.id || "Data nonaktif"
);

const redactSnapshotValue = (value, key = "") => {
  const normalizedKey = normalizeKey(key).replace(/[^a-z0-9_]/g, "");
  if (SENSITIVE_SNAPSHOT_KEYS.has(normalizedKey)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redactSnapshotValue(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      redactSnapshotValue(childValue, childKey),
    ]),
  );
};

const sanitizeSnapshot = (entityType, row = {}) => {
  const snapshot = redactSnapshotValue({ ...row });
  if (entityType === "user") delete snapshot.password_hash;
  if (snapshot.payload_json) {
    snapshot.payload = redactSnapshotValue(safeJsonParse(snapshot.payload_json, null));
    delete snapshot.payload_json;
  }
  return snapshot;
};

const addReferenceIndexEntry = (index, key, value, reference) => {
  const normalizedKey = normalizeKey(key);
  const normalizedValue = normalizeComparable(value);
  if (!JSON_REFERENCE_KEYS.has(normalizedKey) || !normalizedValue) return;
  const token = `${normalizedKey}::${normalizedValue}`;
  const entries = index.get(token) || [];
  entries.push(reference);
  index.set(token, entries);
};

const collectPayloadReferenceIndex = ({
  payload,
  tableName,
  referenceRow,
  index,
  path = "",
  parentKey = "",
}) => {
  if (Array.isArray(payload)) {
    payload.forEach((item, itemIndex) => {
      if (!item || typeof item !== "object") {
        addReferenceIndexEntry(index, parentKey, item, {
          table: tableName,
          id: referenceRow.id,
          code: referenceRow.code || "",
          name: referenceRow.name || "",
          status: referenceRow.status || "",
          path: `${path}[${itemIndex}]`,
        });
      } else {
        collectPayloadReferenceIndex({
          payload: item,
          tableName,
          referenceRow,
          index,
          path: `${path}[${itemIndex}]`,
          parentKey,
        });
      }
    });
    return;
  }

  if (!payload || typeof payload !== "object") return;

  for (const [key, value] of Object.entries(payload)) {
    const normalizedKey = normalizeKey(key);
    const normalizedParentKey = normalizeKey(parentKey);
    const compoundKey = normalizedParentKey ? `${normalizedParentKey}${normalizedKey}` : "";
    const nextPath = path ? `${path}.${key}` : key;
    const reference = {
      table: tableName,
      id: referenceRow.id,
      code: referenceRow.code || "",
      name: referenceRow.name || "",
      status: referenceRow.status || "",
      path: nextPath,
    };

    if (Array.isArray(value)) {
      value.forEach((item, indexPosition) => {
        if (!item || typeof item !== "object") {
          addReferenceIndexEntry(index, normalizedKey, item, {
            ...reference,
            path: `${nextPath}[${indexPosition}]`,
          });
          addReferenceIndexEntry(index, compoundKey, item, {
            ...reference,
            path: `${nextPath}[${indexPosition}]`,
          });
        }
      });
    } else if (!value || typeof value !== "object") {
      addReferenceIndexEntry(index, normalizedKey, value, reference);
      addReferenceIndexEntry(index, compoundKey, value, reference);
    }

    if (value && typeof value === "object") {
      collectPayloadReferenceIndex({
        payload: value,
        tableName,
        referenceRow,
        index,
        path: nextPath,
        parentKey: key,
      });
    }
  }
};

const buildJsonReferenceIndex = async (db) => {
  const index = new Map();
  for (const tableName of JSON_REFERENCE_TABLES) {
    const rows = await db.all(
      `SELECT id, code, name, status, payload_json FROM ${tableName} ORDER BY updated_at DESC`,
    );
    for (const referenceRow of rows) {
      collectPayloadReferenceIndex({
        payload: safeJsonParse(referenceRow.payload_json, {}),
        tableName,
        referenceRow,
        index,
      });
    }
  }
  return index;
};

const buildJsonReferenceBlockers = (row, config, referenceIndex = new Map()) => {
  if (!(config.idReferenceKeys?.length || config.codeReferenceKeys?.length)) return [];

  const idTargets = [row.id].map(normalizeComparable).filter(Boolean);
  const codeTargets = (config.codeFields || [])
    .map((field) => row[field])
    .map(normalizeComparable)
    .filter(Boolean);
  const matchesByTable = new Map();

  const collectMatches = (keys, targets) => {
    for (const key of keys || []) {
      for (const target of targets) {
        for (const reference of referenceIndex.get(`${normalizeKey(key)}::${target}`) || []) {
          if (reference.table === config.table) continue;
          const tableMatches = matchesByTable.get(reference.table) || new Map();
          const recordKey = String(reference.id);
          const current = tableMatches.get(recordKey) || {
            id: reference.id,
            code: reference.code,
            name: reference.name,
            status: reference.status,
            paths: new Set(),
          };
          current.paths.add(reference.path);
          tableMatches.set(recordKey, current);
          matchesByTable.set(reference.table, tableMatches);
        }
      }
    }
  };

  collectMatches(config.idReferenceKeys, idTargets);
  collectMatches(config.codeReferenceKeys, codeTargets);

  return [...matchesByTable.entries()].map(([tableName, tableMatches]) => {
    const rows = [...tableMatches.values()];
    return {
      type: "business_reference",
      table: tableName,
      count: rows.length,
      message: `${config.label} masih direferensikan oleh ${rows.length} record pada ${tableName}.`,
      samples: rows.slice(0, 5).map((item) => ({
        ...item,
        paths: [...item.paths].slice(0, 5),
      })),
    };
  });
};

const buildDirectReferenceBlockers = async (db, entityType, row) => {
  const blockers = [];

  const legacyIdentityCount = await db.get(
    "SELECT COUNT(*) AS count FROM migration_identity_map WHERE sqlite_id = ?",
    [String(row.id)],
  );
  if (Number(legacyIdentityCount?.count || 0) > 0) {
    blockers.push({
      type: "legacy_identity_reference",
      table: TABLES.MIGRATION_IDENTITY_MAP,
      count: Number(legacyIdentityCount.count),
      message: "Record masih dipakai oleh mapping kompatibilitas data lama dan tidak boleh dipurge.",
    });
  }

  if (entityType === "category") {
    const childCount = await db.get(
      "SELECT COUNT(*) AS count FROM categories WHERE parent_id = ?",
      [row.id],
    );
    if (Number(childCount?.count || 0) > 0) {
      blockers.push({
        type: "category_children",
        table: TABLES.CATEGORIES,
        count: Number(childCount.count),
        message: "Kategori masih memiliki subkategori dan tidak boleh dihapus permanen.",
      });
    }

    for (const tableName of [TABLES.PRODUCTS, TABLES.RAW_MATERIALS, TABLES.SEMI_FINISHED_MATERIALS]) {
      const result = await db.get(`SELECT COUNT(*) AS count FROM ${tableName} WHERE category_id = ?`, [String(row.id)]);
      if (Number(result?.count || 0) > 0) {
        blockers.push({
          type: "category_column_reference",
          table: tableName,
          count: Number(result.count),
          message: `Kategori masih dipakai pada ${tableName}.`,
        });
      }
    }
  }

  if (entityType === "supplier") {
    const [offerCount, historyCount] = await Promise.all([
      db.get("SELECT COUNT(*) AS count FROM supplier_catalog_offers WHERE supplier_id = ?", [row.id]),
      db.get("SELECT COUNT(*) AS count FROM supplier_catalog_history WHERE supplier_id = ?", [row.id]),
    ]);
    if (Number(offerCount?.count || 0) > 0) {
      blockers.push({
        type: "supplier_catalog",
        table: TABLES.SUPPLIER_CATALOG_OFFERS,
        count: Number(offerCount.count),
        message: "Supplier masih memiliki katalog. Histori toko tidak boleh ikut terhapus oleh cascade.",
      });
    }
    if (Number(historyCount?.count || 0) > 0) {
      blockers.push({
        type: "supplier_history",
        table: TABLES.SUPPLIER_CATALOG_HISTORY,
        count: Number(historyCount.count),
        message: "Supplier memiliki histori toko. Hapus permanen diblokir agar histori tetap utuh.",
      });
    }
  }

  return blockers;
};

const buildInactivePurgeCandidate = async (
  db,
  entityType,
  row,
  actorUser = {},
  referenceIndex = new Map(),
) => {
  const config = ENTITY_CONFIGS[entityType];
  const blockers = [
    ...await buildDirectReferenceBlockers(db, entityType, row),
    ...buildJsonReferenceBlockers(row, config, referenceIndex),
  ];

  if (entityType === "user") {
    blockers.push({
      type: "protected_user_history",
      table: TABLES.USERS,
      count: 1,
      message: "Akun lokal dipertahankan sebagai identitas histori audit. Gunakan status inactive; hard purge user tidak didukung.",
    });
  }

  if (entityType === "user" && Number(actorUser?.id || 0) === Number(row.id)) {
    blockers.push({
      type: "self_user",
      table: TABLES.USERS,
      count: 1,
      message: "Akun yang sedang dipakai tidak boleh dihapus permanen.",
    });
  }

  return {
    entityType,
    entityLabel: config.label,
    id: String(row.id),
    code: getCandidateCode(row, config),
    name: getCandidateName(row),
    status: row.is_active === 0 && row.status === "active"
      ? "inactive"
      : row.status || (row.is_active === 0 ? "inactive" : "unknown"),
    updatedAt: row.updated_at || null,
    safeToDelete: blockers.length === 0,
    blockers,
  };
};

const loadInactiveRows = async (db, entityType) => {
  const config = ENTITY_CONFIGS[entityType];
  if (!config) {
    throw createHttpError("Jenis data nonaktif tidak didukung untuk purge.", 400, "INACTIVE_PURGE_ENTITY_UNSUPPORTED");
  }
  return db.all(
    `SELECT * FROM ${config.table} WHERE ${config.inactiveWhere} ORDER BY updated_at DESC, id DESC`
  );
};

const listInactivePurgeCandidates = async ({ entityType = "", actorUser = {} } = {}) => (
  runSerializedDbOperation(async () => {
    const db = await getDb();
    if (entityType && !ENTITY_CONFIGS[entityType]) {
      throw createHttpError(
        "Jenis data nonaktif tidak didukung untuk purge.",
        400,
        "INACTIVE_PURGE_ENTITY_UNSUPPORTED",
      );
    }
    const entityTypes = entityType ? [entityType] : Object.keys(ENTITY_CONFIGS);
    const groups = [];
    const referenceIndex = await buildJsonReferenceIndex(db);

    for (const currentType of entityTypes) {
      const config = ENTITY_CONFIGS[currentType];
      if (!config) continue;
      const rows = await loadInactiveRows(db, currentType);
      const candidates = [];
      for (const row of rows) {
        candidates.push(await buildInactivePurgeCandidate(
          db,
          currentType,
          row,
          actorUser,
          referenceIndex,
        ));
      }
      groups.push({
        entityType: currentType,
        entityLabel: config.label,
        count: candidates.length,
        safeCount: candidates.filter((item) => item.safeToDelete).length,
        blockedCount: candidates.filter((item) => !item.safeToDelete).length,
        candidates,
      });
    }

    return {
      mode: "preview_only",
      confirmKeyword: INACTIVE_PURGE_CONFIRM_KEYWORD,
      policy: {
        regularDeleteMode: "soft_delete_or_inactive_only",
        hardDeleteLocation: "maintenance_only",
        automaticBackup: true,
        auditSnapshot: true,
        protectedDomains: [
          "stock",
          "inventory_logs",
          "purchases",
          "sales",
          "returns",
          "finance",
          "production_orders",
          "production_work_logs",
          "production_payrolls",
          "backup_restore_history",
        ],
      },
      groups,
      summary: {
        total: groups.reduce((total, group) => total + group.count, 0),
        safe: groups.reduce((total, group) => total + group.safeCount, 0),
        blocked: groups.reduce((total, group) => total + group.blockedCount, 0),
      },
      generatedAt: new Date().toISOString(),
    };
  }, { label: "maintenance_inactive_purge_preview" })
);

const purgeInactiveRecord = async ({
  entityType = "",
  id = "",
  confirmKeyword = "",
  confirmTarget = "",
  actorUser = {},
} = {}) => {
  const config = ENTITY_CONFIGS[entityType];
  if (!config) {
    throw createHttpError("Jenis data tidak didukung untuk hapus permanen.", 400, "INACTIVE_PURGE_ENTITY_UNSUPPORTED");
  }
  if (String(confirmKeyword || "").trim() !== INACTIVE_PURGE_CONFIRM_KEYWORD) {
    throw createHttpError(
      `Ketik ${INACTIVE_PURGE_CONFIRM_KEYWORD} untuk melanjutkan hapus permanen.`,
      400,
      "INACTIVE_PURGE_CONFIRMATION_REQUIRED",
    );
  }

  return runSerializedDbOperation(async () => {
    const db = await getDb();
    const rows = await loadInactiveRows(db, entityType);
    const row = rows.find((item) => String(item.id) === String(id));
    if (!row) {
      throw createHttpError(
        "Data nonaktif tidak ditemukan atau sudah tidak memenuhi syarat purge.",
        404,
        "INACTIVE_PURGE_NOT_FOUND",
      );
    }

    const referenceIndex = await buildJsonReferenceIndex(db);
    const candidate = await buildInactivePurgeCandidate(db, entityType, row, actorUser, referenceIndex);
    if (!candidate.safeToDelete) {
      const error = createHttpError(
        "Data masih memiliki referensi atau histori yang dilindungi dan tidak boleh dihapus permanen.",
        409,
        "INACTIVE_PURGE_REFERENCE_BLOCKED",
      );
      error.details = candidate;
      throw error;
    }

    const expectedTarget = String(candidate.code || candidate.name || candidate.id).trim();
    if (normalizeComparable(confirmTarget) !== normalizeComparable(expectedTarget)) {
      throw createHttpError(
        `Ketik target ${expectedTarget} untuk memastikan record yang dipilih benar.`,
        400,
        "INACTIVE_PURGE_TARGET_CONFIRMATION_REQUIRED",
      );
    }

    const actor = actorUser?.username || "system";
    const preRepairBackup = await createOfficialSqliteBackup(db, {
      type: "pre-repair",
      actor,
      action: "pre_inactive_record_purge_backup",
      notes: `Backup otomatis sebelum purge ${config.label} ${expectedTarget}.`,
    });

    return runInTransaction(async (transactionDb) => {
      const snapshot = sanitizeSnapshot(entityType, row);
      const result = await transactionDb.run(
        `DELETE FROM ${config.table} WHERE id = ?`,
        [row.id],
      );
      if (Number(result?.changes || 0) !== 1) {
        throw createHttpError("Hapus permanen tidak mengubah record target.", 409, "INACTIVE_PURGE_NO_CHANGE");
      }

      const metadata = {
        purgeMode: "maintenance_guarded_hard_delete",
        entityType,
        target: candidate,
        snapshot,
        preRepairBackup: preRepairBackup.filename,
        retainedHistory: "audit_logs",
      };
      await createAuditLog({
        module: "maintenance",
        action: "inactive_record_purge",
        entityType,
        entityId: row.id,
        actor,
        description: `${config.label} ${candidate.name} dihapus permanen dari Maintenance setelah backup, dependency check, dan konfirmasi ganda`,
        metadata,
      });

      return {
        purged: true,
        entityType,
        id: candidate.id,
        code: candidate.code,
        name: candidate.name,
        preRepairBackup,
        auditSnapshotRetained: true,
      };
    }, { label: `maintenance_inactive_purge_${entityType}` });
  }, { label: "maintenance_inactive_purge" });
};

module.exports = {
  ENTITY_CONFIGS,
  INACTIVE_PURGE_CONFIRM_KEYWORD,
  listInactivePurgeCandidates,
  purgeInactiveRecord,
};
