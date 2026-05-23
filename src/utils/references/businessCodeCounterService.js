import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

export const BUSINESS_CODE_COUNTER_COLLECTION = "business_code_counters";

const safeTrim = (value) => String(value ?? "").trim();

const normalizeCounterSegment = (value = "CODE") => {
  const normalized = safeTrim(value)
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "CODE";
};

const normalizeCounterScope = (value = "daily") => {
  const normalized = safeTrim(value).toLowerCase();
  return normalized === "sequential" ? "sequential" : "daily";
};

const normalizePositiveSequence = (value = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? Math.floor(normalized) : 0;
};

export const buildBusinessCodeCounterId = ({
  scope = "daily",
  prefix = "CODE",
  dateCode = "",
} = {}) => {
  const normalizedScope = normalizeCounterScope(scope).toUpperCase();
  const normalizedPrefix = normalizeCounterSegment(prefix);
  const normalizedDateCode = safeTrim(dateCode).replace(/[^0-9]/g, "");

  if (normalizedScope === "DAILY") {
    return `${normalizedScope}__${normalizedPrefix}__${normalizedDateCode || "NO-DATE"}`;
  }

  return `${normalizedScope}__${normalizedPrefix}`;
};

export const prepareBusinessCodeCounterSequenceInTransaction = async ({
  transaction,
  db,
  scope = "daily",
  prefix = "CODE",
  dateCode = "",
  collectionName = "",
  minimumSequence = 0,
} = {}) => {
  if (!transaction || !db) {
    throw new Error("Transaction dan db wajib tersedia untuk counter kode bisnis atomic.");
  }

  const normalizedScope = normalizeCounterScope(scope);
  const normalizedPrefix = normalizeCounterSegment(prefix);
  const normalizedDateCode = safeTrim(dateCode).replace(/[^0-9]/g, "");
  const counterId = buildBusinessCodeCounterId({
    scope: normalizedScope,
    prefix: normalizedPrefix,
    dateCode: normalizedDateCode,
  });
  const counterRef = doc(db, BUSINESS_CODE_COUNTER_COLLECTION, counterId);
  const counterSnapshot = await transaction.get(counterRef);
  const storedSequence = counterSnapshot.exists()
    ? normalizePositiveSequence(counterSnapshot.data()?.lastSequence)
    : 0;
  const minimumSafeSequence = normalizePositiveSequence(minimumSequence);
  const previousSequence = Math.max(storedSequence, minimumSafeSequence);
  const nextSequence = previousSequence + 1;

  return {
    counterId,
    counterRef,
    sequence: nextSequence,
    previousSequence,
    commit: () => {
      const timestamp = serverTimestamp();

      transaction.set(
        counterRef,
        {
          scope: normalizedScope,
          prefix: normalizedPrefix,
          dateCode: normalizedScope === "daily" ? normalizedDateCode : "",
          collectionName: safeTrim(collectionName),
          lastSequence: nextSequence,
          updatedAt: timestamp,
          ...(counterSnapshot.exists() ? {} : { createdAt: timestamp }),
        },
        { merge: true },
      );
    },
  };
};

export const reserveBusinessCodeCounterSequenceInTransaction = async (options = {}) => {
  const reservation = await prepareBusinessCodeCounterSequenceInTransaction(options);
  reservation.commit();

  return {
    counterId: reservation.counterId,
    sequence: reservation.sequence,
    previousSequence: reservation.previousSequence,
  };
};

export const reserveBusinessCodeCounterSequence = ({ db, ...options } = {}) => {
  if (!db) {
    throw new Error("db wajib tersedia untuk counter kode bisnis atomic.");
  }

  return runTransaction(db, (transaction) =>
    reserveBusinessCodeCounterSequenceInTransaction({
      transaction,
      db,
      ...options,
    }),
  );
};
