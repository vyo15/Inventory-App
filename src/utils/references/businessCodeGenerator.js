import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

const safeTrim = (value) => String(value ?? "").trim();

const READABLE_STOPWORDS = new Set([
  "BOM",
  "UNTUK",
  "DAN",
  "THE",
  "OF",
  "PRODUK",
  "PRODUCT",
  "PRODUKSI",
  "ITEM",
]);

const normalizeText = (value = "") =>
  safeTrim(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

export const normalizeBusinessPrefix = (prefix = "CODE") =>
  normalizeText(prefix)
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "CODE";

const normalizeCodeToken = (value = "") =>
  normalizeText(value).replace(/[^A-Z0-9]/g, "");

/* =====================================================
SECTION: Universal readable code abbreviation — AKTIF
Fungsi:
- Mengubah nama bisnis menjadi token kode manusiawi tanpa dictionary manual per kata.
- Angka dipertahankan, kata pendek dipakai langsung, kata panjang dikompresi dari konsonan utama.

Dipakai oleh:
- generateUniqueReadableCode untuk Product, Raw Material, Semi Finished, BOM, dan Production Step.
- productionCodeGenerator sebagai compatibility wrapper.

Alasan perubahan:
- Standar kode IMS dikunci agar tidak bergantung mapping manual seperti MAWAR -> MWR atau PUTIH -> PTH.

Catatan cleanup:
- Stopword minimal bisa ditinjau jika nama item valid ikut terbuang, tetapi jangan jadikan dictionary arti kata.

Risiko:
- Mengubah algoritma ini membuat format kode baru berbeda lintas master item dan bisa membingungkan audit operasional.
===================================================== */
const abbreviateWord = (word = "") => {
  const normalizedWord = normalizeCodeToken(word);
  if (!normalizedWord || READABLE_STOPWORDS.has(normalizedWord)) return "";
  if (/^\d+$/.test(normalizedWord)) return normalizedWord.slice(0, 4);
  if (normalizedWord.length <= 3) return normalizedWord;

  const consonants = normalizedWord.replace(/[AIUEO]/g, "");
  if (consonants.length >= 3) return consonants.slice(0, 3);
  if (consonants.length > 0) return (consonants + normalizedWord).slice(0, 3);
  return normalizedWord.slice(0, 3);
};

export const buildReadableCodeParts = (text = "", options = {}) => {
  const { maxParts = 8, stopwords = [] } = options;
  const extraStopwords = new Set((stopwords || []).map((item) => normalizeCodeToken(item)).filter(Boolean));
  const normalizedText = normalizeText(text);
  const words = normalizedText.match(/[A-Z0-9]+/g) || [];
  const parts = [];

  words.forEach((word) => {
    const normalizedWord = normalizeCodeToken(word);
    if (extraStopwords.has(normalizedWord)) return;

    const part = abbreviateWord(word);
    if (part && !parts.includes(part)) {
      parts.push(part);
    }
  });

  return parts.slice(0, maxParts);
};

export const stripTrailingReadableSequence = (value = "") =>
  normalizeText(value)
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-\d{3}$/, "");

export const buildReadableBusinessCode = ({
  prefix = "CODE",
  text = "",
  fallbackText = "ITEM",
  maxParts = 8,
  stopwords = [],
} = {}) => {
  const normalizedPrefix = normalizeBusinessPrefix(prefix);
  const parts = buildReadableCodeParts(text, { maxParts, stopwords });
  const fallbackParts = buildReadableCodeParts(fallbackText, { maxParts, stopwords });
  const suffix = (parts.length > 0 ? parts : fallbackParts).join("-") || "ITEM";

  return `${normalizedPrefix}-${suffix}`;
};

export const formatBusinessDateCode = (date = new Date(), dateFormat = "DDMMYYYY") => {
  const normalizedDate = date instanceof Date ? date : new Date(date);
  const year = normalizedDate.getFullYear();
  const month = String(normalizedDate.getMonth() + 1).padStart(2, "0");
  const day = String(normalizedDate.getDate()).padStart(2, "0");

  if (dateFormat === "YYYYMMDD") {
    return `${year}${month}${day}`;
  }

  return `${day}${month}${year}`;
};

/* =====================================================
SECTION: Daily sequence business code — AKTIF
Fungsi:
- Membuat kode bisnis harian final IMS dengan format DDMMYYYY dan sequence 3 digit.
- Mendukung prefix bertanda hyphen seperti STK-ADJ, CSH-IN, dan CSH-OUT.

Dipakai oleh:
- Customer, Supplier, Purchase, Sales/Order, Return, Production Order, Stock Adjustment, Cash In/Out, Work Log, dan Payroll.

Alasan perubahan:
- Final locked code standard IMS memakai DDMMYYYY-001 untuk data baru.

Catatan cleanup:
- Generator scan-based masih bisa diganti counter atomic setelah ada approval arsitektur.

Risiko:
- Mengubah default dateFormat/sequenceLength akan membuat kode data baru tidak sesuai standar final.
===================================================== */
export const buildDailyBusinessCode = ({
  prefix = "CODE",
  date = new Date(),
  sequence = 1,
  dateFormat = "DDMMYYYY",
  sequenceLength = 3,
} = {}) => {
  const normalizedPrefix = normalizeBusinessPrefix(prefix);
  return `${normalizedPrefix}-${formatBusinessDateCode(date, dateFormat)}-${String(Number(sequence || 1)).padStart(sequenceLength, "0")}`;
};

export const isBusinessCodeExists = async ({
  db,
  collectionName,
  fieldNames = ["code"],
  value,
  excludeId = null,
} = {}) => {
  const normalizedValue = safeTrim(value).toUpperCase();
  if (!db || !collectionName || !normalizedValue) return false;

  const documentSnapshot = await getDoc(doc(db, collectionName, normalizedValue));
  if (documentSnapshot.exists() && documentSnapshot.id !== excludeId) return true;

  for (const fieldName of fieldNames) {
    const snapshot = await getDocs(
      query(
        collection(db, collectionName),
        where(fieldName, "==", normalizedValue),
      ),
    );

    const found = snapshot.docs.find((item) => item.id !== excludeId);
    if (found) return true;
  }

  return false;
};

export const generateUniqueReadableCode = async ({
  db,
  collectionName,
  fieldNames = ["code"],
  prefix = "CODE",
  text = "",
  fallbackText = "ITEM",
  excludeId = null,
  maxParts = 8,
  stopwords = [],
} = {}) => {
  const baseCode = buildReadableBusinessCode({ prefix, text, fallbackText, maxParts, stopwords });

  for (let index = 1; index <= 999; index += 1) {
    const candidate = `${baseCode}-${String(index).padStart(3, "0")}`;
    const exists = await isBusinessCodeExists({
      db,
      collectionName,
      fieldNames,
      value: candidate,
      excludeId,
    });

    if (!exists) return candidate;
  }

  throw new Error(`Tidak dapat membuat kode unik untuk ${baseCode}.`);
};

export const generateDailySequenceCode = async ({
  db,
  collectionName,
  fieldNames = ["code"],
  prefix = "CODE",
  date = new Date(),
  excludeId = null,
  dateFormat = "DDMMYYYY",
  sequenceLength = 3,
} = {}) => {
  if (!db || !collectionName) {
    return buildDailyBusinessCode({ prefix, date, sequence: 1, dateFormat, sequenceLength });
  }

  const dateCode = formatBusinessDateCode(date, dateFormat);
  const normalizedPrefix = normalizeBusinessPrefix(prefix);
  const prefixDate = `${normalizedPrefix}-${dateCode}-`;
  const snapshot = await getDocs(collection(db, collectionName));
  const usedSequences = new Set();
  const usedCodes = new Set();
  let maxSequence = 0;

  snapshot.docs.forEach((item) => {
    if (excludeId && item.id === excludeId) return;

    const data = item.data() || {};
    const fieldsToCheck = [
      ...new Set([
        ...fieldNames,
        "code",
        "referenceNumber",
        "referenceCode",
        "sourceRef",
      ]),
    ];
    const valuesToCheck = [item.id, ...fieldsToCheck.map((fieldName) => data[fieldName])];

    valuesToCheck.forEach((rawValue) => {
      const value = safeTrim(rawValue).toUpperCase();
      if (!value.startsWith(prefixDate)) return;

      usedCodes.add(value);
      const sequence = Number(value.slice(prefixDate.length).match(/^\d+/)?.[0] || 0);
      if (sequence > 0) {
        usedSequences.add(sequence);
        if (sequence > maxSequence) maxSequence = sequence;
      }
    });
  });

  let nextSequence = maxSequence + 1;
  while (usedSequences.has(nextSequence)) {
    nextSequence += 1;
  }

  let candidate = buildDailyBusinessCode({
    prefix: normalizedPrefix,
    date,
    sequence: nextSequence,
    dateFormat,
    sequenceLength,
  });

  while (usedCodes.has(candidate)) {
    nextSequence += 1;
    candidate = buildDailyBusinessCode({
      prefix: normalizedPrefix,
      date,
      sequence: nextSequence,
      dateFormat,
      sequenceLength,
    });
  }

  return candidate;
};
