const LOCAL_SYNC_METADATA_FIELDS = new Set([
  "_deleted",
  "syncStatus",
  "localUpdatedAt",
  "lastSyncedAt",
  "remoteUpdatedAt",
  "updatedAt",
  "createdAt",
  "deletedAt",
  "deletedBy",
  "source",
  "readOnlySnapshot",
  "offlineMutationAllowed",
  "syncMetadata",
  "guardNotes",
]);

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  typeof value.toDate !== "function" &&
  typeof value.toMillis !== "function";

export const getComparableVersionTime = (value) => {
  if (!value) return null;

  if (typeof value?.toMillis === "function") {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }

  if (typeof value?.toDate === "function") {
    const millis = value.toDate().getTime();
    return Number.isFinite(millis) ? millis : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  const seconds = value.seconds ?? value._seconds;
  const nanoseconds = value.nanoseconds ?? value._nanoseconds ?? 0;
  if (Number.isFinite(Number(seconds))) {
    return Number(seconds) * 1000 + Math.floor(Number(nanoseconds || 0) / 1000000);
  }

  if (isPlainObject(value)) {
    for (const fieldName of ["updatedAt", "remoteUpdatedAt", "localUpdatedAt", "createdAt"]) {
      if (value[fieldName] && value[fieldName] !== value) {
        const nested = getComparableVersionTime(value[fieldName]);
        if (nested !== null) return nested;
      }
    }
  }

  return null;
};

const normalizeComparableValue = (value) => {
  const comparableTime = getComparableVersionTime(value);
  if (comparableTime !== null && typeof value === "object") {
    return { __timestamp: comparableTime };
  }

  if (Array.isArray(value)) {
    return value.map(normalizeComparableValue);
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .filter((key) => value[key] !== undefined && !LOCAL_SYNC_METADATA_FIELDS.has(key))
      .sort()
      .reduce((normalized, key) => {
        normalized[key] = normalizeComparableValue(value[key]);
        return normalized;
      }, {});
  }

  return value === undefined ? null : value;
};

export const buildComparableSyncRecord = (record = {}) => normalizeComparableValue(record || {});

export const createSyncRecordFingerprint = (record = {}) =>
  JSON.stringify(buildComparableSyncRecord(record || {}));

export const describeComparableVersion = (value) => {
  const comparableTime = getComparableVersionTime(value);
  if (comparableTime !== null) return new Date(comparableTime).toISOString();
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
