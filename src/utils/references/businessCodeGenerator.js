import { collection, getDocs, query, where } from "firebase/firestore";

const safeTrim = (value) => String(value ?? "").trim();

const WORD_ABBREVIATIONS = {
  BOM: "",
  BAHAN: "BHN",
  BAKU: "BK",
  RAW: "RW",
  MATERIAL: "MTL",
  PRODUK: "PRD",
  PRODUCT: "PRD",
  PRODUKSI: "",
  FINISH: "FNS",
  FINISHED: "FNS",
  SEMI: "SM",
  SETENGAH: "STG",
  JADI: "JD",
  POLA: "PL",
  DAUN: "DN",
  KEL: "KEL",
  KELOPAK: "KLP",
  KAWAT: "KWT",
  TANGKAI: "TGK",
  BUNGA: "BG",
  MAWAR: "MWR",
  MELATI: "MLT",
  TULIP: "TLP",
  ANGGREK: "AGK",
  MATAHARI: "MTH",
  LILY: "LLY",
  PUTIH: "PTH",
  MERAH: "MRH",
  PINK: "PNK",
  KUNING: "KNG",
  HIJAU: "HJU",
  BIRU: "BR",
  UNGU: "UNG",
  ORANGE: "ORG",
  OREN: "ORN",
  COKLAT: "CKL",
  HITAM: "HTM",
  ABU: "AB",
  FLANEL: "FLN",
  KAIN: "KN",
  PITA: "PT",
  LEM: "LM",
  BUKET: "BKT",
  BOUQUET: "BKT",
};

const normalizeText = (value = "") =>
  safeTrim(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const abbreviateWord = (word = "") => {
  const normalizedWord = normalizeText(word).replace(/[^A-Z0-9]/g, "");
  if (!normalizedWord) return "";
  if (Object.prototype.hasOwnProperty.call(WORD_ABBREVIATIONS, normalizedWord)) {
    return WORD_ABBREVIATIONS[normalizedWord];
  }
  if (/^\d+$/.test(normalizedWord)) return normalizedWord.slice(0, 4);
  if (normalizedWord.length <= 3) return normalizedWord;

  const consonants = normalizedWord.replace(/[AIUEO]/g, "");
  if (consonants.length >= 2) return consonants.slice(0, 3);
  return normalizedWord.slice(0, 3);
};

export const buildReadableCodeParts = (text = "", options = {}) => {
  const { maxParts = 8 } = options;
  const normalizedText = normalizeText(text);
  const words = normalizedText.match(/[A-Z0-9]+/g) || [];
  const parts = [];

  words.forEach((word) => {
    const part = abbreviateWord(word);
    if (part && !parts.includes(part)) {
      parts.push(part);
    }
  });

  return parts.slice(0, maxParts);
};

export const buildReadableBusinessCode = ({
  prefix = "CODE",
  text = "",
  fallbackText = "ITEM",
  maxParts = 8,
} = {}) => {
  const normalizedPrefix = normalizeText(prefix)
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "CODE";

  const parts = buildReadableCodeParts(text, { maxParts });
  const fallbackParts = buildReadableCodeParts(fallbackText, { maxParts });
  const suffix = (parts.length > 0 ? parts : fallbackParts).join("-") || "ITEM";

  return `${normalizedPrefix}-${suffix}`;
};

export const formatBusinessDateCode = (date = new Date()) => {
  const normalizedDate = date instanceof Date ? date : new Date(date);
  const year = normalizedDate.getFullYear();
  const month = String(normalizedDate.getMonth() + 1).padStart(2, "0");
  const day = String(normalizedDate.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
};

export const buildDailyBusinessCode = ({ prefix = "CODE", date = new Date(), sequence = 1 } = {}) => {
  const normalizedPrefix = normalizeText(prefix)
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "CODE";
  return `${normalizedPrefix}-${formatBusinessDateCode(date)}-${String(Number(sequence || 1)).padStart(4, "0")}`;
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
} = {}) => {
  const baseCode = buildReadableBusinessCode({ prefix, text, fallbackText, maxParts });

  for (let index = 1; index <= 100; index += 1) {
    const candidate = index === 1 ? baseCode : `${baseCode}-${index}`;
    const exists = await isBusinessCodeExists({
      db,
      collectionName,
      fieldNames,
      value: candidate,
      excludeId,
    });

    if (!exists) return candidate;
  }

  return `${baseCode}-${Date.now().toString().slice(-6)}`;
};

export const generateDailySequenceCode = async ({
  db,
  collectionName,
  fieldNames = ["code"],
  prefix = "CODE",
  date = new Date(),
} = {}) => {
  if (!db || !collectionName) {
    return buildDailyBusinessCode({ prefix, date, sequence: 1 });
  }

  const dateCode = formatBusinessDateCode(date);
  const normalizedPrefix = normalizeText(prefix)
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "CODE";
  const prefixDate = `${normalizedPrefix}-${dateCode}-`;
  const snapshot = await getDocs(collection(db, collectionName));
  let maxSequence = 0;

  snapshot.docs.forEach((item) => {
    const data = item.data() || {};
    fieldNames.forEach((fieldName) => {
      const value = safeTrim(data[fieldName]).toUpperCase();
      if (!value.startsWith(prefixDate)) return;

      const sequence = Number(value.slice(prefixDate.length).match(/^\d+/)?.[0] || 0);
      if (sequence > maxSequence) maxSequence = sequence;
    });
  });

  return buildDailyBusinessCode({ prefix: normalizedPrefix, date, sequence: maxSequence + 1 });
};
