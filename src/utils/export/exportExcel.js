import dayjs from "dayjs";

// =====================================================
// Helper export XLSX reusable.
// Fungsi:
// - membuat file Excel yang lebih rapi daripada CSV mentah
// - dipakai lintas laporan agar format header, subtitle, filter info, dan lebar kolom konsisten
// Status:
// - aktif dipakai sebagai helper export final batch laporan
// - kandidat cleanup hanya jika nanti diganti helper report/export yang lebih besar
// =====================================================
const toSafeSheetName = (value = "Sheet1") => String(value || "Sheet1").slice(0, 31);

const getColumnWidth = (value = "") => {
  const baseLength = String(value ?? "").length;
  return Math.min(Math.max(baseLength + 2, 12), 40);
};

const normalizeTableRows = (rows = [], columns = []) =>
  rows.map((row) =>
    columns.reduce((accumulator, column) => {
      accumulator[column.label] = row[column.key];
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

  const normalizedColumns = Array.isArray(columns) && columns.length > 0
    ? columns
    : Object.keys(data?.[0] || {}).map((key) => ({
        key,
        label: key,
      }));

  const normalizedRows = normalizeTableRows(data, normalizedColumns);
  const sheetRows = [];

  // =====================================================
  // Header export yang lebih profesional.
  // Fungsi:
  // - memberi konteks laporan, tanggal export, dan filter aktif
  // - membantu user memakai file hasil export tanpa harus menebak isi sheet
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

  // Merge judul dan subtitle agar tampilan sheet lebih rapi saat dibuka.
  worksheet["!merges"] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: Math.max(normalizedColumns.length - 1, 0) },
    },
    {
      s: { r: 1, c: 0 },
      e: { r: 1, c: Math.max(normalizedColumns.length - 1, 0) },
    },
  ];

  const headerRowIndex = Array.isArray(filters) && filters.length > 0 ? filters.filter(Boolean).length + 3 : 3;

  worksheet["!cols"] = normalizedColumns.map((column) => {
    const widestCell = Math.max(
      getColumnWidth(column.label),
      ...normalizedRows.map((row) => getColumnWidth(row[column.label])),
    );
    return { wch: widestCell };
  });

  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIndex, c: 0 },
      e: { r: Math.max(sheetRows.length - 1, headerRowIndex), c: Math.max(normalizedColumns.length - 1, 0) },
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
