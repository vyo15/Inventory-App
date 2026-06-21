const normalizeText = (value) => String(value ?? "").trim();
const normalizeCode = (value) => normalizeText(value).toUpperCase();

const formatBusinessDateStamp = (value = new Date()) => {
  const parsed = value instanceof Date ? value : new Date(value || Date.now());
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}${month}${year}`;
};

const assertSqlIdentifier = (value, label) => {
  const normalized = normalizeText(value);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
    throw new Error(`${label} business code counter tidak valid.`);
  }
  return normalized;
};

const getSequenceFromCode = (code, prefix) => {
  const normalizedCode = normalizeCode(code);
  const normalizedPrefix = normalizeCode(prefix);
  const escapedPrefix = normalizedPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = normalizedCode.match(new RegExp(`^${escapedPrefix}-(\\d+)$`));
  return match ? Number(match[1]) : 0;
};

const buildBusinessCode = (prefix, sequence, minWidth = 3) =>
  `${normalizeCode(prefix)}-${String(sequence).padStart(minWidth, "0")}`;

const getExistingMaxSequence = async (db, {
  tableName,
  columnName = "code",
  prefix,
}) => {
  const safeTableName = assertSqlIdentifier(tableName, "Table");
  const safeColumnName = assertSqlIdentifier(columnName, "Column");
  const normalizedPrefix = normalizeCode(prefix);
  const numericStart = normalizedPrefix.length + 2;
  const row = await db.get(
    `SELECT COALESCE(MAX(CAST(SUBSTR(${safeColumnName}, ?) AS INTEGER)), 0) AS max_sequence
     FROM ${safeTableName}
     WHERE ${safeColumnName} LIKE ?`,
    [numericStart, `${normalizedPrefix}-%`],
  );
  return Math.max(0, Number(row?.max_sequence || 0));
};

const getCounterRow = (db, counterKey) => db.get(
  "SELECT counter_key, prefix, last_number FROM business_code_counters WHERE counter_key = ?",
  [normalizeText(counterKey)],
);

const getBusinessCodePreview = async (db, options = {}) => {
  const {
    counterKey,
    prefix,
    tableName,
    columnName = "code",
    minWidth = 3,
  } = options;
  const normalizedCounterKey = normalizeText(counterKey);
  const normalizedPrefix = normalizeCode(prefix);
  if (!normalizedCounterKey || !normalizedPrefix) {
    throw new Error("Konfigurasi preview business code counter tidak lengkap.");
  }

  const counter = await getCounterRow(db, normalizedCounterKey);
  const existingMax = await getExistingMaxSequence(db, {
    tableName,
    columnName,
    prefix: normalizedPrefix,
  });
  const nextSequence = Math.max(Number(counter?.last_number || 0), existingMax) + 1;
  return buildBusinessCode(normalizedPrefix, nextSequence, minWidth);
};

const ensureCounterBaseline = async (db, {
  counterKey,
  prefix,
  tableName,
  columnName = "code",
  notes = "",
}) => {
  const normalizedCounterKey = normalizeText(counterKey);
  const normalizedPrefix = normalizeCode(prefix);
  if (!normalizedCounterKey || !normalizedPrefix) {
    throw new Error("Konfigurasi business code counter tidak lengkap.");
  }

  const existingMax = await getExistingMaxSequence(db, {
    tableName,
    columnName,
    prefix: normalizedPrefix,
  });

  await db.run(
    `INSERT INTO business_code_counters (counter_key, prefix, last_number, notes, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(counter_key) DO UPDATE SET
       prefix = excluded.prefix,
       last_number = MAX(business_code_counters.last_number, excluded.last_number),
       notes = CASE WHEN excluded.notes != '' THEN excluded.notes ELSE business_code_counters.notes END,
       updated_at = CURRENT_TIMESTAMP`,
    [normalizedCounterKey, normalizedPrefix, existingMax, normalizeText(notes)],
  );
};

const reserveBusinessCode = async (db, options = {}) => {
  const {
    counterKey,
    prefix,
    minWidth = 3,
  } = options;
  await ensureCounterBaseline(db, options);
  await db.run(
    `UPDATE business_code_counters
     SET last_number = last_number + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE counter_key = ?`,
    [normalizeText(counterKey)],
  );
  const counter = await getCounterRow(db, counterKey);
  return buildBusinessCode(prefix, Number(counter.last_number), minWidth);
};

const syncBusinessCodeCounter = async (db, code, options = {}) => {
  const sequence = getSequenceFromCode(code, options.prefix);
  if (sequence <= 0) return;

  await ensureCounterBaseline(db, options);
  await db.run(
    `UPDATE business_code_counters
     SET last_number = MAX(last_number, ?),
         updated_at = CURRENT_TIMESTAMP
     WHERE counter_key = ?`,
    [sequence, normalizeText(options.counterKey)],
  );
};

const resolveBusinessCode = async (db, requestedCode = "", options = {}) => {
  const normalizedRequestedCode = normalizeCode(requestedCode);
  if (!normalizedRequestedCode) {
    return reserveBusinessCode(db, options);
  }

  const safeTableName = assertSqlIdentifier(options.tableName, "Table");
  const safeColumnName = assertSqlIdentifier(options.columnName || "code", "Column");
  const existing = await db.get(
    `SELECT 1 AS found FROM ${safeTableName} WHERE ${safeColumnName} = ? LIMIT 1`,
    [normalizedRequestedCode],
  );
  const isManagedCode = getSequenceFromCode(normalizedRequestedCode, options.prefix) > 0;

  if (existing && isManagedCode) {
    return reserveBusinessCode(db, options);
  }
  if (existing) return null;

  if (isManagedCode) {
    const nextManagedCode = await getBusinessCodePreview(db, options);
    const requestedSequence = getSequenceFromCode(normalizedRequestedCode, options.prefix);
    const nextSequence = getSequenceFromCode(nextManagedCode, options.prefix);
    if (requestedSequence < nextSequence) {
      return reserveBusinessCode(db, options);
    }
    await syncBusinessCodeCounter(db, normalizedRequestedCode, options);
  }
  return normalizedRequestedCode;
};

module.exports = {
  buildBusinessCode,
  formatBusinessDateStamp,
  getBusinessCodePreview,
  getSequenceFromCode,
  reserveBusinessCode,
  resolveBusinessCode,
  syncBusinessCodeCounter,
};
