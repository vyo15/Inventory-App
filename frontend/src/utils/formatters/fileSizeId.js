export const formatFileSizeId = (value, options = {}) => {
  const bytes = Number(value || 0);
  const { fallback = "0 B", maximumFractionDigits = 1 } = options;
  if (!Number.isFinite(bytes) || bytes <= 0) return fallback;

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const normalized = bytes / (1024 ** unitIndex);
  const formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: unitIndex === 0 ? 0 : maximumFractionDigits,
  }).format(normalized);

  return `${formatted} ${units[unitIndex]}`;
};

export default formatFileSizeId;
