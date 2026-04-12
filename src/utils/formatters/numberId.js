// =========================
// SECTION: Number Formatter - Indonesia
// =========================
export const formatNumberId = (value) => {
  const safeValue = Number(value || 0);

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(safeValue);
};

// =========================
// SECTION: Percentage Formatter
// =========================
export const formatPercentId = (value) => {
  const safeValue = Number(value || 0);

  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(safeValue)}%`;
};

export const formatNumberID = formatNumberId;
export default formatNumberId;
