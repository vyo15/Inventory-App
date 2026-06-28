const pad = (value) => String(value || 0).padStart(2, "0");

const normalizeSqliteTimestamp = (value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)) {
    return `${trimmed.replace(" ", "T")}Z`;
  }
  return trimmed;
};

export const parseDateTimeId = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const date = new Date(normalizeSqliteTimestamp(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateId = (value, options = false) => {
  const withTime = typeof options === "boolean" ? options : options?.withTime === true;
  const fallback = typeof options === "object" ? options?.fallback ?? "-" : "-";
  const date = parseDateTimeId(value);
  if (!date) return fallback;

  const base = `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
  return withTime ? `${base} ${pad(date.getHours())}:${pad(date.getMinutes())}` : base;
};

export const formatDateTimeId = (value, options = {}) => {
  const {
    fallback = "-",
    dateStyle = "medium",
    timeStyle = "short",
  } = options;
  const date = parseDateTimeId(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat("id-ID", { dateStyle, timeStyle }).format(date);
};

export const getDateAgeDays = (value, referenceDate = new Date()) => {
  const date = parseDateTimeId(value);
  if (!date) return null;
  return Math.floor((referenceDate.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
};

export const isDateToday = (value, referenceDate = new Date()) => {
  const date = parseDateTimeId(value);
  if (!date) return false;
  return date.getFullYear() === referenceDate.getFullYear()
    && date.getMonth() === referenceDate.getMonth()
    && date.getDate() === referenceDate.getDate();
};

export default formatDateId;
