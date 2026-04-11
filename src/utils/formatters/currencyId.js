import { formatNumberId } from "./numberId";

// =========================
// SECTION: Currency Formatter - Indonesia
// =========================
export const formatCurrencyId = (value, prefix = "Rp") => {
  const safeValue = Number(value || 0);
  return `${prefix} ${formatNumberId(safeValue)}`;
};
