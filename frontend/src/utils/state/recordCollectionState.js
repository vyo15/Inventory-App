const normalizeRecordId = (value) => String(value ?? '').trim();

const getComparableRecordId = (record = {}) => normalizeRecordId(
  record?.id || record?.code || record?.referenceNumber || '',
);

const toTimestamp = (value) => {
  if (!value) return 0;

  if (typeof value?.toDate === 'function') {
    const dateValue = value.toDate();
    return dateValue instanceof Date && !Number.isNaN(dateValue.getTime())
      ? dateValue.getTime()
      : 0;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  }

  if (typeof value === 'object' && Number.isFinite(Number(value.seconds))) {
    return Number(value.seconds) * 1000;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const compareRecordsByNameAsc = (left = {}, right = {}) => String(left?.name || '')
  .localeCompare(String(right?.name || ''), 'id-ID', { sensitivity: 'base' });

export const compareRecordsByDateDesc = (left = {}, right = {}) => {
  const leftTimestamp = [left?.date, left?.transactionDate, left?.createdAt, left?.updatedAt]
    .map(toTimestamp)
    .find((value) => value > 0) || 0;
  const rightTimestamp = [right?.date, right?.transactionDate, right?.createdAt, right?.updatedAt]
    .map(toTimestamp)
    .find((value) => value > 0) || 0;

  return rightTimestamp - leftTimestamp;
};

export const upsertRecordById = (records = [], nextRecord = null, { comparator } = {}) => {
  const currentRecords = Array.isArray(records) ? records : [];
  const nextId = getComparableRecordId(nextRecord || {});
  if (!nextRecord || !nextId) return currentRecords;

  const nextRecords = [
    nextRecord,
    ...currentRecords.filter((item) => getComparableRecordId(item) !== nextId),
  ];

  return typeof comparator === 'function'
    ? [...nextRecords].sort(comparator)
    : nextRecords;
};

export const upsertRecordsById = (records = [], nextRecords = [], { comparator } = {}) => {
  const sourceRecords = Array.isArray(nextRecords) ? nextRecords : [];
  const merged = sourceRecords.reduce(
    (current, item) => upsertRecordById(current, item),
    Array.isArray(records) ? records : [],
  );

  return typeof comparator === 'function' ? [...merged].sort(comparator) : merged;
};


export const mergeRecordById = (records = [], recordPatch = null, { comparator } = {}) => {
  const currentRecords = Array.isArray(records) ? records : [];
  const patchId = getComparableRecordId(recordPatch || {});
  if (!recordPatch || !patchId) return currentRecords;

  const existingRecord = currentRecords.find((item) => getComparableRecordId(item) === patchId);
  if (!existingRecord) return currentRecords;

  return upsertRecordById(currentRecords, { ...existingRecord, ...recordPatch }, { comparator });
};

export const mergeRecordsById = (records = [], recordPatches = [], { comparator } = {}) => {
  const patches = Array.isArray(recordPatches) ? recordPatches : [];
  const merged = patches.reduce(
    (current, patch) => mergeRecordById(current, patch),
    Array.isArray(records) ? records : [],
  );

  return typeof comparator === 'function' ? [...merged].sort(comparator) : merged;
};

export const removeRecordById = (records = [], recordId = '') => {
  const normalizedId = normalizeRecordId(recordId);
  if (!normalizedId) return Array.isArray(records) ? records : [];

  return (Array.isArray(records) ? records : []).filter(
    (item) => getComparableRecordId(item) !== normalizedId,
  );
};


export const getInventoryMutationItems = (mutationResults = [], sourceType = "") => (
  (Array.isArray(mutationResults) ? mutationResults : [])
    .filter((entry) => entry?.stockReadModel?.sourceType === sourceType)
    .map((entry) => entry?.item)
    .filter(Boolean)
);

export const mergeInventoryMutationResults = (
  records = [],
  mutationResults = [],
  sourceType = "",
  { comparator = compareRecordsByNameAsc } = {},
) => upsertRecordsById(
  records,
  getInventoryMutationItems(mutationResults, sourceType),
  { comparator },
);
