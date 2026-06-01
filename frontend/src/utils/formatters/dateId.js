const pad = (value) => String(value || 0).padStart(2, '0');

export const formatDateId = (value, withTime = false) => {
  if (!value) return '-';

  const date =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : value instanceof Date
        ? value
        : new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  const base = `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;

  if (!withTime) return base;

  return `${base} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default formatDateId;
