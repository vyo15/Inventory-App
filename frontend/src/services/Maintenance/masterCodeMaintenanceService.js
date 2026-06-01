import { collection, doc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../../firebase";
import { buildDailyBusinessCode, buildSequentialBusinessCode, formatBusinessDateCode } from "../../utils/references/businessCodeGenerator";

const BATCH_LIMIT = 400;

const safeTrim = (value) => String(value ?? "").trim();
const normalizeCode = (value) => safeTrim(value).toUpperCase();

const MASTER_CODE_CONFIGS = [
  {
    key: "products",
    label: "Produk Jadi",
    collectionName: "products",
    prefix: "PRD",
    type: "sequential",
    fields: ["code", "productCode"],
    requiredFields: ["code", "productCode"],
  },
  {
    key: "raw_materials",
    label: "Raw Material",
    collectionName: "raw_materials",
    prefix: "RAW",
    type: "sequential",
    fields: ["code", "materialCode"],
    requiredFields: ["code", "materialCode"],
  },
  {
    key: "semi_finished_materials",
    label: "Semi Finished",
    collectionName: "semi_finished_materials",
    prefix: "SFP",
    type: "sequential",
    fields: ["code", "itemCode"],
    requiredFields: ["code", "itemCode"],
  },
  {
    key: "production_boms",
    label: "BOM Produksi",
    collectionName: "production_boms",
    prefix: "BOM",
    type: "sequential",
    fields: ["code", "bomCode"],
    requiredFields: ["code", "bomCode"],
  },
  {
    key: "production_steps",
    label: "Tahapan Produksi",
    collectionName: "production_steps",
    prefix: "STP",
    type: "sequential",
    fields: ["code", "stepCode"],
    requiredFields: ["code", "stepCode"],
  },
  {
    key: "supplierPurchases",
    label: "Supplier",
    collectionName: "supplierPurchases",
    prefix: "SUP",
    type: "daily",
    fields: ["code", "supplierCode"],
    requiredFields: ["code", "supplierCode"],
  },
];

const toDateSafe = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === "function") {
    const dateValue = value.toDate();
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }
  if (typeof value.seconds === "number") {
    const dateValue = new Date(value.seconds * 1000);
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }
  const dateValue = new Date(value);
  return Number.isNaN(dateValue.getTime()) ? null : dateValue;
};

const isActiveLike = (data = {}) => data.isActive !== false && data.active !== false;
const looksLikeFirestoreId = (value = "") => /^[A-Za-z0-9_]{16,}$/.test(safeTrim(value));

const getDisplayName = (data = {}, fallback = "-") => (
  safeTrim(data.name)
  || safeTrim(data.productName)
  || safeTrim(data.materialName)
  || safeTrim(data.itemName)
  || safeTrim(data.stepName)
  || safeTrim(data.bomName)
  || safeTrim(data.storeName)
  || safeTrim(data.supplierName)
  || safeTrim(data.title)
  || fallback
);

const getCodePattern = (config = {}) => (
  config.type === "daily"
    ? new RegExp(`^${config.prefix}-\\d{8}-\\d{3,}$`)
    : new RegExp(`^${config.prefix}-\\d{3,}$`)
);

const isValidConfigCode = (config = {}, value = "") => getCodePattern(config).test(normalizeCode(value));

const getCodeSequence = (config = {}, value = "") => {
  const normalized = normalizeCode(value);
  if (!isValidConfigCode(config, normalized)) return 0;
  const match = normalized.match(/-(\d{3,})$/);
  return Number(match?.[1] || 0);
};

const getDailyDateKey = (config = {}, item = {}) => {
  const existingCode = [item.id, ...config.fields.map((fieldName) => item[fieldName])]
    .map(normalizeCode)
    .find((code) => isValidConfigCode(config, code));

  if (existingCode) {
    const match = existingCode.match(new RegExp(`^${config.prefix}-(\\d{8})-`));
    if (match?.[1]) return match[1];
  }

  return formatBusinessDateCode(toDateSafe(item.createdAt) || new Date(), "DDMMYYYY");
};

const getCodeOwners = (items = [], config = {}) => {
  const owners = new Map();

  items.forEach((item) => {
    [item.id, ...config.fields.map((fieldName) => item[fieldName])].forEach((rawValue) => {
      const code = normalizeCode(rawValue);
      if (!isValidConfigCode(config, code)) return;
      if (!owners.has(code)) owners.set(code, new Set());
      owners.get(code).add(item.id);
    });
  });

  return owners;
};

const isCodeOwnedOnlyByItem = (code = "", itemId = "", owners = new Map()) => {
  const codeOwners = owners.get(normalizeCode(code));
  if (!codeOwners || codeOwners.size === 0) return true;
  return codeOwners.size === 1 && codeOwners.has(itemId);
};

const collectUsedSequentialSequences = (items = [], config = {}) => {
  const usedSequences = new Set();
  let maxSequence = 0;

  items.forEach((item) => {
    [item.id, ...config.fields.map((fieldName) => item[fieldName])].forEach((rawValue) => {
      const sequence = getCodeSequence(config, rawValue);
      if (!sequence) return;
      usedSequences.add(sequence);
      if (sequence > maxSequence) maxSequence = sequence;
    });
  });

  return { usedSequences, maxSequence };
};

const collectUsedDailySequences = (items = [], config = {}) => {
  const byDate = new Map();

  items.forEach((item) => {
    [item.id, ...config.fields.map((fieldName) => item[fieldName])].forEach((rawValue) => {
      const normalized = normalizeCode(rawValue);
      if (!isValidConfigCode(config, normalized)) return;
      const match = normalized.match(new RegExp(`^${config.prefix}-(\\d{8})-(\\d{3,})$`));
      if (!match) return;

      const dateKey = match[1];
      const sequence = Number(match[2] || 0);
      if (!byDate.has(dateKey)) byDate.set(dateKey, { usedSequences: new Set(), maxSequence: 0 });
      const dateMeta = byDate.get(dateKey);
      dateMeta.usedSequences.add(sequence);
      if (sequence > dateMeta.maxSequence) dateMeta.maxSequence = sequence;
    });
  });

  return byDate;
};

const createSequentialAllocator = (items = [], config = {}) => {
  const { usedSequences, maxSequence } = collectUsedSequentialSequences(items, config);
  let nextSequence = maxSequence + 1;

  return () => {
    while (usedSequences.has(nextSequence)) nextSequence += 1;
    const code = buildSequentialBusinessCode({ prefix: config.prefix, sequence: nextSequence });
    usedSequences.add(nextSequence);
    nextSequence += 1;
    return code;
  };
};

const createDailyAllocator = (items = [], config = {}) => {
  const sequenceByDate = collectUsedDailySequences(items, config);

  return (dateKey = formatBusinessDateCode(new Date(), "DDMMYYYY")) => {
    if (!sequenceByDate.has(dateKey)) sequenceByDate.set(dateKey, { usedSequences: new Set(), maxSequence: 0 });
    const dateMeta = sequenceByDate.get(dateKey);
    let nextSequence = dateMeta.maxSequence + 1;
    while (dateMeta.usedSequences.has(nextSequence)) nextSequence += 1;
    dateMeta.usedSequences.add(nextSequence);
    dateMeta.maxSequence = Math.max(dateMeta.maxSequence, nextSequence);

    const day = Number(dateKey.slice(0, 2));
    const month = Number(dateKey.slice(2, 4)) - 1;
    const year = Number(dateKey.slice(4));
    return buildDailyBusinessCode({ prefix: config.prefix, date: new Date(year, month, day), sequence: nextSequence });
  };
};

const resolveExistingSafeCode = ({ item = {}, config = {}, owners = new Map() }) => {
  const candidates = [item.code, ...config.fields.map((fieldName) => item[fieldName]), item.id]
    .map(normalizeCode)
    .filter((code, index, list) => code && list.indexOf(code) === index);

  return candidates.find((code) => isValidConfigCode(config, code) && isCodeOwnedOnlyByItem(code, item.id, owners)) || "";
};

const buildIssueList = ({ item = {}, config = {}, owners = new Map(), proposedCode = "" }) => {
  const issues = [];
  const displayFields = config.requiredFields || ["code"];
  const normalizedProposed = normalizeCode(proposedCode);

  displayFields.forEach((fieldName) => {
    const value = normalizeCode(item[fieldName]);
    if (!value) issues.push(`${fieldName} kosong`);
    else if (looksLikeFirestoreId(value)) issues.push(`${fieldName} masih technical ID`);
    else if (!isValidConfigCode(config, value)) issues.push(`${fieldName} tidak sesuai ${config.prefix}`);
    else if (!isCodeOwnedOnlyByItem(value, item.id, owners)) issues.push(`${fieldName} duplikat`);
    else if (value !== normalizedProposed) issues.push(`${fieldName} belum sinkron`);
  });

  return [...new Set(issues)];
};

const buildPayload = (config = {}, proposedCode = "") => {
  const payload = {
    code: proposedCode,
    updatedAt: serverTimestamp(),
    codeMaintenanceSyncedAt: serverTimestamp(),
  };

  (config.requiredFields || []).forEach((fieldName) => {
    payload[fieldName] = proposedCode;
  });

  return payload;
};

const buildAuditForConfig = async (config = {}) => {
  const snapshot = await getDocs(collection(db, config.collectionName));
  const items = snapshot.docs.map((itemDoc) => ({ id: itemDoc.id, ref: itemDoc.ref, ...(itemDoc.data() || {}) }));
  const owners = getCodeOwners(items, config);
  const allocate = config.type === "daily" ? createDailyAllocator(items, config) : createSequentialAllocator(items, config);

  const rows = [];

  items.forEach((item) => {
    if (!isActiveLike(item)) return;

    const existingSafeCode = resolveExistingSafeCode({ item, config, owners });
    const proposedCode = existingSafeCode || (config.type === "daily" ? allocate(getDailyDateKey(config, item)) : allocate());
    const issues = buildIssueList({ item, config, owners, proposedCode });

    if (!issues.length) return;

    rows.push({
      key: `${config.collectionName}:${item.id}`,
      collectionName: config.collectionName,
      area: config.label,
      recordId: item.id,
      itemName: getDisplayName(item, item.id),
      currentCode: normalizeCode(item.code) || "-",
      currentAlias: (config.requiredFields || [])
        .filter((fieldName) => fieldName !== "code")
        .map((fieldName) => `${fieldName}: ${normalizeCode(item[fieldName]) || "-"}`)
        .join(" | ") || "-",
      proposedCode,
      issue: issues.join("; "),
      category: "safe_repair",
      recommendation: `Normalisasi ke ${config.prefix} tanpa rename/delete document ID dan tanpa menyentuh transaksi/history.`,
      payload: buildPayload(config, proposedCode),
    });
  });

  return { checkedRecords: items.filter(isActiveLike).length, rows };
};

const sanitizeRows = (rows = []) => rows.map((row) => {
  const cleanRow = { ...row };
  delete cleanRow.payload;
  return cleanRow;
});

const buildSummary = ({ checkedRecords = 0, rows = [] } = {}) => ({
  checkedRecords,
  okCount: Math.max(checkedRecords - rows.length, 0),
  issueCount: rows.length,
  safeRepairCount: rows.length,
  executablePlanCount: rows.length,
});

export const getMasterCodeMaintenanceAudit = async () => {
  const resultByConfig = await Promise.all(MASTER_CODE_CONFIGS.map(buildAuditForConfig));
  const checkedRecords = resultByConfig.reduce((total, item) => total + item.checkedRecords, 0);
  const rows = resultByConfig.flatMap((item) => item.rows);

  return {
    rows: sanitizeRows(rows),
    summary: buildSummary({ checkedRecords, rows }),
    affectedCollections: MASTER_CODE_CONFIGS.map((item) => item.collectionName),
  };
};

export const repairMasterCodeMaintenance = async () => {
  const resultByConfig = await Promise.all(MASTER_CODE_CONFIGS.map(buildAuditForConfig));
  const rows = resultByConfig.flatMap((item) => item.rows).filter((row) => row.payload);

  let batch = writeBatch(db);
  let operationCount = 0;
  let updatedCount = 0;

  for (const row of rows) {
    batch.update(doc(db, row.collectionName, row.recordId), row.payload);
    operationCount += 1;
    updatedCount += 1;

    if (operationCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) await batch.commit();

  const checkedRecords = resultByConfig.reduce((total, item) => total + item.checkedRecords, 0);

  return {
    message: `Normalisasi kode master selesai. ${updatedCount} record diperbarui tanpa rename document ID.`,
    updatedCount,
    summary: buildSummary({ checkedRecords, rows }),
    affectedCollections: MASTER_CODE_CONFIGS.map((item) => item.collectionName),
  };
};
