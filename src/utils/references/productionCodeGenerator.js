import { collection, getDocs, query, where } from "firebase/firestore";

const safeTrim = (value) => String(value ?? "").trim();

// =====================================================
// SECTION: Production readable code generator — AKTIF
// Fungsi:
// - Membuat kode bisnis produksi dari nama item/BOM dengan singkatan yang mudah dibaca.
//
// Dipakai oleh:
// - productionBomsService.js
// - semiFinishedMaterialsService.js
//
// Alasan perubahan:
// - Kode BOM dan Semi Finished boleh kosong di form, lalu service mengisi kode otomatis yang manusiawi.
//
// Catatan cleanup:
// - Mapping kata bisa diperluas nanti jika ada istilah produksi baru.
//
// Risiko:
// - Jika rule singkatan diubah sembarangan, kode baru bisa tidak konsisten dengan data lama.
// =====================================================
const WORD_ABBREVIATIONS = {
  BOM: "",
  RESEP: "",
  PRODUK: "",
  PRODUCT: "",
  PRODUKSI: "",
  UNTUK: "",
  DAN: "",
  THE: "",
  OF: "",
  POLA: "PL",
  DAUN: "DN",
  MAWAR: "MWR",
  PUTIH: "PTH",
  MERAH: "MRH",
  KUNING: "KNG",
  HIJAU: "HJ",
  BIRU: "BR",
  FLANEL: "FLN",
  KELOPAK: "KLPK",
  POTONG: "PTG",
  KAWAT: "KWT",
  BUNGA: "BNG",
  MELATI: "MLT",
  TULIP: "TLP",
  ANGGREK: "ANG",
  MATAHARI: "MTH",
  PINK: "PNK",
  UNGU: "UNG",
  ORANGE: "ORG",
  OREN: "ORN",
  COKLAT: "CKL",
  HITAM: "HTM",
  ABU: "AB",
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

const normalizeCodePart = (value = "") =>
  normalizeText(value).replace(/[^A-Z0-9]/g, "");

const normalizePrefix = (prefix = "CODE") =>
  normalizeText(prefix)
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "CODE";

const abbreviateWord = (word = "") => {
  const normalizedWord = normalizeCodePart(word);
  if (!normalizedWord) return "";

  if (Object.prototype.hasOwnProperty.call(WORD_ABBREVIATIONS, normalizedWord)) {
    return WORD_ABBREVIATIONS[normalizedWord];
  }

  if (/^\d+$/.test(normalizedWord)) return normalizedWord.slice(0, 4);
  if (normalizedWord.length <= 2) return normalizedWord;
  if (normalizedWord.length <= 4) return normalizedWord.slice(0, 3);
  return normalizedWord.slice(0, 4);
};

export const buildProductionReadableCodeParts = (text = "", options = {}) => {
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

export const buildProductionReadableCode = ({
  prefix = "CODE",
  text = "",
  fallbackText = "ITEM",
  maxParts = 8,
} = {}) => {
  const parts = buildProductionReadableCodeParts(text, { maxParts });
  const fallbackParts = buildProductionReadableCodeParts(fallbackText, { maxParts });
  const suffix = (parts.length > 0 ? parts : fallbackParts).join("-") || "ITEM";

  return `${normalizePrefix(prefix)}-${suffix}`;
};

export const isProductionBusinessCodeExists = async ({
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

export const generateUniqueProductionReadableCode = async ({
  db,
  collectionName,
  fieldNames = ["code"],
  prefix = "CODE",
  text = "",
  fallbackText = "ITEM",
  excludeId = null,
  maxParts = 8,
} = {}) => {
  const baseCode = buildProductionReadableCode({
    prefix,
    text,
    fallbackText,
    maxParts,
  });

  for (let index = 1; index <= 100; index += 1) {
    const candidate = index === 1 ? baseCode : `${baseCode}-${index}`;
    const exists = await isProductionBusinessCodeExists({
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
