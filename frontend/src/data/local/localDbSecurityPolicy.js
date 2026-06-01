// =====================================================
// SECTION: Offline Local DB Security Policy — AKTIF / BATCH 49
// Fungsi:
// - Menjaga IndexedDB, backup JSON, sync_queue, dan conflict resolver agar tidak membawa credential/secret.
// - Policy ini tidak mengubah schema, tidak menulis Firebase, dan tidak membuka offline mutation baru.
// =====================================================

export const LOCAL_DB_SENSITIVE_FIELD_PATTERNS = Object.freeze([
  /(^|_)password($|_)/i,
  /(^|_)passphrase($|_)/i,
  /(^|_)secret($|_)/i,
  /(^|_)private[_-]?key($|_)/i,
  /(^|_)api[_-]?key($|_)/i,
  /(^|_)access[_-]?token($|_)/i,
  /(^|_)refresh[_-]?token($|_)/i,
  /(^|_)id[_-]?token($|_)/i,
  /(^|_)session[_-]?token($|_)/i,
  /(^|_)credential(s)?($|_)/i,
]);

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isSensitiveFieldName = (fieldName = "") =>
  LOCAL_DB_SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(String(fieldName)));

const joinPath = (path = "", key = "") => (path ? `${path}.${key}` : String(key));

const walkSensitiveFieldPaths = (value, { path = "", paths = [], depth = 0 } = {}) => {
  if (depth > 8 || value == null) return paths;

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkSensitiveFieldPaths(item, { path: `${path}[${index}]`, paths, depth: depth + 1 })
    );
    return paths;
  }

  if (!isPlainObject(value)) return paths;

  Object.entries(value).forEach(([key, nestedValue]) => {
    const nextPath = joinPath(path, key);
    if (isSensitiveFieldName(key)) {
      paths.push(nextPath);
      return;
    }

    if (isPlainObject(nestedValue) || Array.isArray(nestedValue)) {
      walkSensitiveFieldPaths(nestedValue, { path: nextPath, paths, depth: depth + 1 });
    }
  });

  return paths;
};

export const findSensitiveLocalDbFieldPaths = (value) => [
  ...new Set(walkSensitiveFieldPaths(value)),
];

export const hasSensitiveLocalDbFields = (value) =>
  findSensitiveLocalDbFieldPaths(value).length > 0;

export const assertNoSensitiveLocalDbPayload = (value, context = "payload") => {
  const paths = findSensitiveLocalDbFieldPaths(value);
  if (paths.length) {
    throw new Error(
      `${context} mengandung field sensitif yang tidak boleh disimpan di Offline DB: ${paths.slice(0, 5).join(", ")}`
    );
  }
};

export const sanitizeLocalDbBackupRow = (row) => {
  if (Array.isArray(row)) return row.map((item) => sanitizeLocalDbBackupRow(item));
  if (!isPlainObject(row)) return row;

  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !isSensitiveFieldName(key))
      .map(([key, value]) => [key, sanitizeLocalDbBackupRow(value)])
  );
};

export const sanitizeLocalDbBackupRows = (rows = []) =>
  Array.isArray(rows) ? rows.map((row) => sanitizeLocalDbBackupRow(row)) : [];
