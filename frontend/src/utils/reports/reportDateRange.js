import dayjs from "dayjs";
import { Timestamp } from "firebase/firestore";

// =====================================================
// SECTION: Report date range helper — AKTIF / GUARDED
// Fungsi:
// - menyamakan default periode laporan ke bulan berjalan;
// - menyediakan batas tanggal eksklusif untuk query Firestore agar report tidak membaca seluruh collection.
// Hubungan flow:
// - hanya dipakai untuk read-only report/dashboard; tidak mengubah schema, transaksi, stok, kas, payroll, atau HPP.
// Risiko:
// - Jangan ubah default periode tanpa audit UX/report karena export mengikuti data yang tampil pada filter aktif.
// =====================================================
export const getDefaultReportDateRange = () => [dayjs().startOf("month"), dayjs().endOf("month")];

export const normalizeReportDateRange = (dateRange = []) => {
  if (!Array.isArray(dateRange) || !dateRange[0] || !dateRange[1]) {
    return null;
  }

  const start = dayjs(dateRange[0]).startOf("day");
  const end = dayjs(dateRange[1]).endOf("day");

  if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
    return null;
  }

  const endExclusive = end.add(1, "millisecond");

  return {
    start,
    end,
    endExclusive,
    startDate: start.toDate(),
    endDateExclusive: endExclusive.toDate(),
    startTimestamp: Timestamp.fromDate(start.toDate()),
    endTimestampExclusive: Timestamp.fromDate(endExclusive.toDate()),
    label: `${start.format("DD/MM/YYYY")} - ${end.format("DD/MM/YYYY")}`,
    dependencyKey: `${start.valueOf()}-${endExclusive.valueOf()}`,
  };
};

export const getReportDateRangeLabel = (dateRange = []) =>
  normalizeReportDateRange(dateRange)?.label || "Semua tanggal";
