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

// ACTIVE / GUARDED: formatter khusus HPP/unit dan cost kecil.
// Nominal HPP internal tidak boleh dibulatkan terlalu cepat karena semi product
// seperti kelopak dipakai sebagai komponen batch. Helper ini hanya untuk display;
// kalkulasi BOM/Work Log tetap memakai angka numeric asli dari source data.
export const formatCurrencyDecimalId = (value, options = {}) => {
  const {
    withPrefix = true,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  const formatted = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(toFiniteNumber(value));

  return withPrefix ? `Rp ${formatted}` : formatted;
};

export const formatHppUnitCurrencyId = (value, options = {}) =>
  formatCurrencyDecimalId(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  });

export const formatCurrencyIDR = formatCurrencyId;
export default formatCurrencyId;
