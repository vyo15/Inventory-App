// =========================
// SECTION: Number Formatter - Indonesia
// =========================
// ACTIVE / FINAL
// Helper ini adalah source of truth format angka lintas aplikasi.
// Gunakan helper ini untuk qty, stok, jumlah baris, persentase, dan angka umum
// agar tidak ada lagi formatter lokal yang menampilkan .00 secara tidak perlu.
const toFiniteNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

export const formatNumberId = (value, options = {}) => {
  const safeValue = toFiniteNumber(value);
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = options;

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(safeValue);
};

// =========================
// SECTION: Quantity / Stock Formatter
// =========================
// ACTIVE / FINAL
// Alias khusus qty/stok agar page tidak membuat formatter sendiri.
// Angka bulat tetap tampil tanpa desimal, sedangkan pecahan tetap terbaca bila ada.
export const formatQuantityId = (value, options = {}) =>
  formatNumberId(value, { maximumFractionDigits: 2, ...options });

// =========================
// SECTION: Percentage Formatter
// =========================
// ACTIVE / FINAL
// Persentase memakai helper angka final agar tidak ada .00 jika nilainya bulat.
export const formatPercentId = (value, options = {}) =>
  `${formatNumberId(value, { maximumFractionDigits: 2, ...options })}%`;

export const formatNumberID = formatNumberId;
export const formatQuantityID = formatQuantityId;
export const formatPercentID = formatPercentId;
export default formatNumberId;
