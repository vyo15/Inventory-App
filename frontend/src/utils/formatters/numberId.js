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
    maximumFractionDigits = 0,
  } = options;

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(safeValue);
};

// =========================
// SECTION: Quantity / Stock Formatter
// =========================
// AKTIF / GUARDED
// Alias khusus qty/stok agar page tidak membuat formatter sendiri.
// Semua tampilan qty/stok diarahkan tanpa desimal; data lama pecahan tidak dimigrasi,
// hanya dibulatkan pada display agar tidak mengubah service calculation.
export const formatQuantityId = (value, options = {}) =>
  formatNumberId(value, { maximumFractionDigits: 0, ...options });

// =========================
// SECTION: Percentage Formatter
// =========================
// AKTIF / GUARDED
// Persentase memakai helper angka final agar tidak ada .00 dan tidak membuka pecahan
// baru pada tampilan operasional. Rumus persentase tetap berada di modul asal.
export const formatPercentId = (value, options = {}) =>
  `${formatNumberId(value, { maximumFractionDigits: 0, ...options })}%`;

// =========================
// SECTION: Integer Input Parser
// =========================
// AKTIF / GUARDED
// Fungsi blok:
// - parser sederhana untuk InputNumber yang hanya boleh menerima angka bulat.
// Hubungan flow aplikasi:
// - dipakai di form aktif agar user tidak memasukkan decimal baru, tanpa mengubah
//   formula service seperti totalStockIn, actualUnitCost, HPP, payroll, atau report.
// Alasan logic:
// - titik tetap dianggap pemisah ribuan Indonesia; koma dianggap awal pecahan dan
//   dipotong agar input pasted seperti "1.000,5" tetap menjadi 1000, bukan 10005.
// Status: AKTIF untuk input baru, GUARDED terhadap data lama decimal.
export const parseIntegerIdInput = (value) => {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return "";

  const withoutCurrency = rawValue.replace(/[Rr][Pp]|\s/g, "");
  const integerPart = withoutCurrency.split(",")[0];
  const normalized = integerPart.replace(/\./g, "").replace(/[^\d-]/g, "");

  return normalized ? Number(normalized) : "";
};

export const formatNumberID = formatNumberId;
export const formatQuantityID = formatQuantityId;
export const formatPercentID = formatPercentId;
export default formatNumberId;
