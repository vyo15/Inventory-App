const safeTrim = (value) => String(value ?? "").trim();
const normalizeCounterSegment = (value = "CODE") => safeTrim(value).toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "CODE";
export const normalizeCounterScope = (scope = "daily") => ["daily", "global"].includes(scope) ? scope : "daily";
export const buildBusinessCodeCounterId = ({ scope = "daily", prefix = "CODE", dateCode = "" } = {}) => {
  const normalizedScope = normalizeCounterScope(scope);
  const normalizedPrefix = normalizeCounterSegment(prefix);
  const normalizedDateCode = safeTrim(dateCode).replace(/[^0-9]/g, "");
  return normalizedScope === "daily" ? `${normalizedScope}__${normalizedPrefix}__${normalizedDateCode}` : `${normalizedScope}__${normalizedPrefix}`;
};
export const prepareBusinessCodeCounterSequenceInTransaction = async ({ minimumSequence = 0 } = {}) => ({
  counterId: "sqlite-local-counter",
  sequence: Math.max(0, Number(minimumSequence || 0)) + 1,
  previousSequence: Math.max(0, Number(minimumSequence || 0)),
  commit: () => {},
});
export const reserveBusinessCodeCounterSequenceInTransaction = async (options = {}) => {
  const reservation = await prepareBusinessCodeCounterSequenceInTransaction(options);
  reservation.commit();
  return { counterId: reservation.counterId, sequence: reservation.sequence, previousSequence: reservation.previousSequence };
};
export const reserveBusinessCodeCounterSequence = async (options = {}) => reserveBusinessCodeCounterSequenceInTransaction(options);
