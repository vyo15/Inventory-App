import { collection, doc, documentId, getDoc, getDocs, orderBy, query, where } from "firebase/firestore";

const safeTrim = (value) => String(value ?? "").trim();

const normalizeBusinessPrefix = (value = "CODE") => {
  const normalized = safeTrim(value).toUpperCase().replace(/[^A-Z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return normalized || "CODE";
};
const collectSnapshotDocsById = (snapshots = []) => {
  const docsById = new Map();

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((item) => {
      docsById.set(item.id, item);
    });
  });

  return Array.from(docsById.values());
};

const fetchBusinessCodeCandidatesByPrefix = async ({
  db,
  collectionName,
  fieldNames = [],
  codePrefix = "",
} = {}) => {
  const normalizedPrefix = safeTrim(codePrefix).toUpperCase();
  if (!db || !collectionName || !normalizedPrefix) return [];

  const upperBound = `${normalizedPrefix}\uf8ff`;
  const uniqueFieldNames = [...new Set(fieldNames.filter(Boolean))];
  const queryPromises = [
    getDocs(
      query(
        collection(db, collectionName),
        where(documentId(), ">=", normalizedPrefix),
        where(documentId(), "<=", upperBound),
        orderBy(documentId()),
      ),
    ),
    ...uniqueFieldNames.map((fieldName) =>
      getDocs(
        query(
          collection(db, collectionName),
          where(fieldName, ">=", normalizedPrefix),
          where(fieldName, "<=", upperBound),
          orderBy(fieldName),
        ),
      ),
    ),
  ];

  const results = await Promise.allSettled(queryPromises);
  const fulfilledSnapshots = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);

  if (fulfilledSnapshots.length === 0) {
    throw results.find((result) => result.status === "rejected")?.reason || new Error("Query prefix kode gagal");
  }

  return collectSnapshotDocsById(fulfilledSnapshots);
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


/* =====================================================
SECTION: Sequential internal master/config code — AKTIF
Fungsi:
- Membuat kode internal yang sederhana dan stabil dengan format PREFIX-001.
- Dipakai untuk master/config yang tidak perlu menampilkan konteks nama di kode UI.

Dipakai oleh:
- Product, Raw Material, Semi Finished, BOM, dan Production Step.

Alasan perubahan:
- Kode master produksi sekarang dipakai sebagai internal ID/backstage saja, sedangkan UI operasional menampilkan nama dan konteks bisnis.

Catatan cleanup:
- Generator tetap membaca kode legacy readable agar data lama tidak dimigrasi otomatis, tetapi sequence baru hanya menghitung pola PREFIX-angka.

Risiko:
- Jangan pakai generator ini untuk transaksi/history karena transaksi tetap butuh kode audit tanggal.
===================================================== */
export const buildSequentialBusinessCode = ({
  prefix = "CODE",
  sequence = 1,
  sequenceLength = 3,
} = {}) => {
  const normalizedPrefix = normalizeBusinessPrefix(prefix);
  return `${normalizedPrefix}-${String(Number(sequence || 1)).padStart(sequenceLength, "0")}`;
};

export const generateUniqueSequentialCode = async ({
  db,
  collectionName,
  fieldNames = ["code"],
  prefix = "CODE",
  excludeId = null,
  sequenceLength = 3,
} = {}) => {
  const normalizedPrefix = normalizeBusinessPrefix(prefix);

  if (!db || !collectionName) {
    return buildSequentialBusinessCode({ prefix: normalizedPrefix, sequence: 1, sequenceLength });
  }

  const fieldsToCheck = [
    ...new Set([
      ...fieldNames,
      "code",
      "productCode",
      "materialCode",
      "itemCode",
      "bomCode",
      "stepCode",
    ]),
  ];
  let candidateDocs = [];

  try {
    candidateDocs = await fetchBusinessCodeCandidatesByPrefix({
      db,
      collectionName,
      fieldNames: fieldsToCheck,
      codePrefix: `${normalizedPrefix}-`,
    });
  } catch (error) {
    // LEGACY-COMPAT: fallback full scan hanya jika semua prefix query gagal, agar data lama tetap aman.
    console.warn("Prefix query kode sequential gagal, fallback full scan", error);
    const snapshot = await getDocs(collection(db, collectionName));
    candidateDocs = snapshot.docs;
  }

  const codePattern = new RegExp(`^${normalizedPrefix}-(\\d{${sequenceLength},})$`);
  const usedSequences = new Set();
  const usedCodes = new Set();
  let maxSequence = 0;

  candidateDocs.forEach((item) => {
    if (excludeId && item.id === excludeId) return;

    const data = item.data() || {};
    const valuesToCheck = [item.id, ...fieldsToCheck.map((fieldName) => data[fieldName])];

    valuesToCheck.forEach((rawValue) => {
      const value = safeTrim(rawValue).toUpperCase();
      if (!value) return;

      usedCodes.add(value);
      const match = value.match(codePattern);
      if (!match) return;

      const sequence = Number(match[1] || 0);
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

  let candidate = buildSequentialBusinessCode({
    prefix: normalizedPrefix,
    sequence: nextSequence,
    sequenceLength,
  });

  while (usedCodes.has(candidate)) {
    nextSequence += 1;
    candidate = buildSequentialBusinessCode({
      prefix: normalizedPrefix,
      sequence: nextSequence,
      sequenceLength,
    });
  }

  return candidate;
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
  const fieldsToCheck = [
    ...new Set([
      ...fieldNames,
      "code",
      "referenceNumber",
      "referenceCode",
      "sourceRef",
    ]),
  ];
  let candidateDocs = [];

  try {
    candidateDocs = await fetchBusinessCodeCandidatesByPrefix({
      db,
      collectionName,
      fieldNames: fieldsToCheck,
      codePrefix: prefixDate,
    });
  } catch (error) {
    // LEGACY-COMPAT: fallback full scan hanya jika semua prefix query gagal, agar collision guard lama tetap jalan.
    console.warn("Prefix query kode harian gagal, fallback full scan", error);
    const snapshot = await getDocs(collection(db, collectionName));
    candidateDocs = snapshot.docs;
  }

  const usedSequences = new Set();
  const usedCodes = new Set();
  let maxSequence = 0;

  candidateDocs.forEach((item) => {
    if (excludeId && item.id === excludeId) return;

    const data = item.data() || {};
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
