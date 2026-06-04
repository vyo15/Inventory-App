const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const normalizeReportDateValue = (value) => toDate(value);
export const toReportDate = (value) => toDate(value);
export const toFirestoreTimestampRange = ({ startDate, endDateExclusive } = {}) => ({
  startTimestamp: toDate(startDate),
  endTimestamp: toDate(endDateExclusive),
});
export const getDateValueTime = (value) => toDate(value)?.getTime() || 0;
export const isDateValueInRange = (value, { startDate, endDateExclusive } = {}) => {
  const time = getDateValueTime(value);
  if (!time) return false;
  const start = startDate ? getDateValueTime(startDate) : null;
  const end = endDateExclusive ? getDateValueTime(endDateExclusive) : null;
  if (start && time < start) return false;
  if (end && time >= end) return false;
  return true;
};

export const getDefaultReportDateRange = () => {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  const endExclusive = new Date(end.getFullYear(), end.getMonth() + 1, 1);
  return { startDate: start, endDate: end, endDateExclusive: endExclusive };
};
export const normalizeReportDateRange = (range = {}) => {
  const defaults = getDefaultReportDateRange();
  const startDate = toDate(range.startDate || range.start || defaults.startDate) || defaults.startDate;
  const endDate = toDate(range.endDate || range.end || defaults.endDate) || defaults.endDate;
  const endDateExclusive = toDate(range.endDateExclusive) || new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1);
  return { startDate, endDate, endDateExclusive };
};
export const getReportDateRangeLabel = (range = {}) => {
  const { startDate, endDate } = normalizeReportDateRange(range);
  return `${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`;
};
