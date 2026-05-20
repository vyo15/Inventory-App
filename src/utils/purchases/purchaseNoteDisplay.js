// =========================
// SECTION: Purchase note display helpers — AKTIF / GUARDED
// Fungsi:
// - menormalisasi catatan purchase/OCR untuk tampilan tabel yang ringkas;
// - menjaga klik Terapkan OCR idempotent dengan menghapus segmen OCR lama sebelum menambah segmen baru;
// - menyediakan parser display OCR yang sama untuk Purchases dan Stock Management.
// Hubungan flow:
// - helper ini hanya membaca/merapikan teks catatan untuk UI; tidak mengubah payload transaksi,
//   stok, kas, expense, inventory log writer, parser OCR, atau schema Firestore.
// =========================
export const normalizePurchaseNoteText = (value = "") =>
  String(value || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const splitPurchaseNoteSegments = (note = "") =>
  normalizePurchaseNoteText(note)
    .split(/\n|\s+\|\s+/)
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);

export const hasShopeeOcrNote = (note = "") => /(^|\n|\|)\s*OCR Shopee\b/i.test(normalizePurchaseNoteText(note));

export const stripExistingShopeeOcrNote = (note = "") => {
  const normalizedNote = String(note || "").replace(/\r/g, "\n");
  const markerMatch = normalizedNote.match(/(^|\n|\|)\s*OCR Shopee\b/i);

  // Guard idempotent: segmen OCR lama dihapus, catatan manual sebelum marker tetap dipertahankan.
  if (!markerMatch) return normalizePurchaseNoteText(normalizedNote);

  return normalizePurchaseNoteText(normalizedNote.slice(0, markerMatch.index).replace(/[ \t]*\|[ \t]*$/, ""));
};

export const getShopeeOcrNoteSegment = (note = "") => {
  const normalizedNote = normalizePurchaseNoteText(note);
  const markerMatch = normalizedNote.match(/(^|\n|\|)\s*OCR Shopee\b/i);

  if (!markerMatch) return "";

  return normalizePurchaseNoteText(normalizedNote.slice(markerMatch.index).replace(/^[\s|]+/, ""));
};

const getShopeeOcrDetailMeta = (label = "") => {
  const normalizedLabel = String(label || "").toLowerCase();

  if (normalizedLabel.includes("subtotal")) {
    return { label: "Subtotal barang", iconKey: "subtotal", tone: "blue", order: 10 };
  }

  if (normalizedLabel.includes("ongkir") && !normalizedLabel.includes("diskon")) {
    return { label: "Ongkir pengiriman", iconKey: "shipping", tone: "purple", order: 20 };
  }

  if (normalizedLabel.includes("diskon ongkir")) {
    return { label: "Diskon ongkir", iconKey: "discount", tone: "green", order: 30, isDiscount: true };
  }

  if (normalizedLabel.includes("voucher") || normalizedLabel.includes("koin") || normalizedLabel.includes("potongan")) {
    return { label: "Voucher / koin / potongan", iconKey: "discount", tone: "green", order: 40, isDiscount: true };
  }

  if (normalizedLabel.includes("biaya layanan")) {
    return { label: "Biaya layanan marketplace", iconKey: "serviceFee", tone: "orange", order: 50 };
  }

  if (normalizedLabel.includes("qty")) {
    return { label: "Qty beli", iconKey: "qty", tone: "cyan", order: 60 };
  }

  if (normalizedLabel.includes("total screenshot") || normalizedLabel.includes("total pesanan")) {
    return { label: "Total pesanan", iconKey: "total", tone: "blue", order: 90, isTotal: true };
  }

  return { label: label || "Info", iconKey: "info", tone: "default", order: 80 };
};

const normalizeShopeeOcrDetailValue = (value = "", { isDiscount = false } = {}) => {
  const trimmedValue = String(value || "").trim();

  if (!trimmedValue) return "-";

  // Diskon/potongan harus terbaca sebagai pengurang biaya walau data lama tidak menyimpan minus.
  if (isDiscount && !trimmedValue.startsWith("-")) {
    return `-${trimmedValue}`;
  }

  return trimmedValue;
};

export const buildShopeeOcrDetailRows = (note = "") => {
  const rawText = getShopeeOcrNoteSegment(note);

  if (!rawText) {
    return { rawText: "", rows: [], totalRow: null };
  }

  const normalizedRows = rawText
    .split(/\n|\|/)
    .map((line) => line.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean)
    .filter((line) => !/^OCR Shopee$/i.test(line))
    .map((line) => {
      const separatorIndex = line.indexOf(":");

      if (separatorIndex === -1) {
        const meta = getShopeeOcrDetailMeta("Info");
        return { ...meta, sourceLabel: "Info", value: line };
      }

      const sourceLabel = line.slice(0, separatorIndex).trim();
      const meta = getShopeeOcrDetailMeta(sourceLabel);

      return {
        ...meta,
        sourceLabel,
        value: normalizeShopeeOcrDetailValue(line.slice(separatorIndex + 1), meta),
      };
    })
    .filter((row) => row.label || row.value)
    .sort((a, b) => a.order - b.order);

  const totalRow = normalizedRows.find((row) => row.isTotal) || null;
  const rows = normalizedRows.filter((row) => !row.isTotal);

  return { rawText, rows, totalRow };
};

export const buildPurchaseNoteTableMeta = (note = "") => {
  const normalizedNote = normalizePurchaseNoteText(note);
  const hasOcrNote = hasShopeeOcrNote(normalizedNote);
  const manualNote = hasOcrNote ? stripExistingShopeeOcrNote(normalizedNote) : normalizedNote;

  return {
    hasShopeeOcrNote: hasOcrNote,
    manualNote,
    manualPreview: manualNote.replace(/\s*\n+\s*/g, " ").trim(),
  };
};

export const extractPurchaseConversionNote = (note = "") => {
  const segments = splitPurchaseNoteSegments(note);

  return segments.find((line) => /^Pembelian\b/i.test(line) && line.includes("=")) || "";
};

export const buildPurchaseLogNoteDisplayMeta = (note = "") => {
  const tableMeta = buildPurchaseNoteTableMeta(note);
  const conversionNote = extractPurchaseConversionNote(note);
  const compactLines = [tableMeta.manualPreview, conversionNote]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);

  return {
    ...tableMeta,
    conversionNote,
    compactPreview: compactLines.join(" | "),
    fullNote: normalizePurchaseNoteText(note),
  };
};
