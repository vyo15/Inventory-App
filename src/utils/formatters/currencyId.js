// =========================
// SECTION: Currency Formatter - Indonesia
// =========================
// ACTIVE / FINAL
// Helper ini adalah source of truth format Rupiah lintas aplikasi.
// Nominal uang bisnis dibulatkan tanpa sen agar konsisten dengan tampilan IMS.
const toFiniteNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

export const formatCurrencyId = (value, withPrefix = true) => {
  const formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(toFiniteNumber(value));

  return withPrefix ? `Rp ${formatted}` : formatted;
};

export const formatCurrencyIDR = formatCurrencyId;
export default formatCurrencyId;
