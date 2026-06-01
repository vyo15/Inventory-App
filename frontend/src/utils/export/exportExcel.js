import dayjs from "dayjs";

// =====================================================
// Helper export XLSX reusable.
// Fungsi:
// - membuat file Excel yang lebih rapi daripada CSV/JSON mentah
// - dipakai lintas laporan agar title, filter, header, dan lebar kolom konsisten
// Hubungan IMS:
// - laporan tetap membaca source masing-masing, helper ini hanya merapikan output file
// Status:
// - aktif dipakai sebagai helper export final laporan
// - kandidat cleanup hanya jika nanti diganti report/export engine yang lebih besar
// =====================================================
const toSafeSheetName = (value = "Sheet1") => String(value || "Sheet1").slice(0, 31);

const getColumnWidth = (value = "") => {
  const baseLength = String(value ?? "").length;
  return Math.min(Math.max(baseLength + 2, 12), 44);
};

// =====================================================
// ACTIVE / FINAL - Normalisasi definisi kolom export.
// Fungsi:
// - menerima format lama { label, key } dan format AntD-like { header, key, width }
// - alasan perubahan: beberapa laporan mengirim `header`, sedangkan helper lama hanya membaca `label`
// - masih aktif dipakai agar semua laporan XLSX punya header manusiawi tanpa refactor besar
// =====================================================
const normalizeColumns = (data = [], columns = null) => {
  const sourceColumns = Array.isArray(columns) && columns.length > 0
    ? columns
    : Object.keys(data?.[0] || {}).map((key) => ({ key, label: key }));

  return sourceColumns.map((column) => ({
    ...column,
    key: column.key,
    label: column.label || column.header || column.title || column.key || "-",
    width: column.width,
  }));
};

// =====================================================
// ACTIVE / FINAL - Normalisasi nilai cell.
// Fungsi:
// - mencegah object/array mentah masuk ke Excel sebagai data sulit dibaca
// - page report tetap bertanggung jawab memformat Rupiah/tanggal/angka sesuai konteks
// - ini safety net aktif, bukan perubahan source data laporan
// =====================================================
const toReadableCellValue = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return dayjs(value).format("DD/MM/YYYY HH:mm");
  if (Array.isArray(value)) return value.map(toReadableCellValue).join("; ");
  if (typeof value === "object") return value.name || value.label || value.title || value.code || "-";
  return value;
};

const normalizeTableRows = (rows = [], columns = []) =>
  rows.map((row) =>
    columns.reduce((accumulator, column) => {
      accumulator[column.label] = toReadableCellValue(row[column.key]);
      return accumulator;
    }, {}),
  );

export const exportJsonToExcel = async ({
  data = [],
  columns = null,
  sheetName = "Data",
  fileName = "export",
  title = "Laporan",
  subtitle = "",
  filters = [],
}) => {
  const XLSX = await import("xlsx");
  const { saveAs } = await import("file-saver");

  const normalizedColumns = normalizeColumns(data, columns);
  const normalizedRows = normalizeTableRows(data, normalizedColumns);
  const sheetRows = [];

  // =====================================================
  // ACTIVE / FINAL - Header export profesional.
  // Fungsi:
  // - memberi konteks laporan, tanggal export, dan filter aktif
  // - alasan perubahan: file XLSX harus siap baca tanpa user mengolah ulang
  // =====================================================
  sheetRows.push([title]);
  sheetRows.push([
    subtitle || `Dibuat pada ${dayjs().format("DD/MM/YYYY HH:mm")}`,
  ]);

  if (Array.isArray(filters) && filters.length > 0) {
    filters.filter(Boolean).forEach((line) => {
      sheetRows.push([line]);
    });
  }

  sheetRows.push([]);
  sheetRows.push(normalizedColumns.map((column) => column.label));

  normalizedRows.forEach((row) => {
    sheetRows.push(normalizedColumns.map((column) => row[column.label]));
  });

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  const lastColumnIndex = Math.max(normalizedColumns.length - 1, 0);

  worksheet["!merges"] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: lastColumnIndex },
    },
    {
      s: { r: 1, c: 0 },
      e: { r: 1, c: lastColumnIndex },
    },
  ];

  const headerRowIndex = Array.isArray(filters) && filters.length > 0
    ? filters.filter(Boolean).length + 3
    : 3;

  // =====================================================
  // ACTIVE / FINAL - Auto width kolom.
  // Fungsi:
  // - memakai width manual dari report bila tersedia
  // - fallback menghitung lebar dari header dan isi cell
  // =====================================================
  worksheet["!cols"] = normalizedColumns.map((column) => {
    if (Number.isFinite(Number(column.width))) {
      return { wch: Math.min(Math.max(Number(column.width), 12), 44) };
    }

    const widestCell = Math.max(
      getColumnWidth(column.label),
      ...normalizedRows.map((row) => getColumnWidth(row[column.label])),
    );
    return { wch: widestCell };
  });

  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIndex, c: 0 },
      e: { r: Math.max(sheetRows.length - 1, headerRowIndex), c: lastColumnIndex },
    }),
  };

  // Best effort freeze header. Beberapa viewer XLSX mendukung properti ini.
  worksheet["!freeze"] = {
    xSplit: 0,
    ySplit: headerRowIndex + 1,
    topLeftCell: XLSX.utils.encode_cell({ r: headerRowIndex + 1, c: 0 }),
    activePane: "bottomLeft",
    state: "frozen",
  };

  XLSX.utils.book_append_sheet(workbook, worksheet, toSafeSheetName(sheetName));

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  saveAs(blob, `${fileName}-${dayjs().format("YYYY-MM-DD")}.xlsx`);
};

export default exportJsonToExcel;
