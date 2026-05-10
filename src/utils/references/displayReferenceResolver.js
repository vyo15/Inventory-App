const safeTrim = (value) => String(value ?? "").trim();

const DEFAULT_REFERENCE_FIELDS = [
  "saleNumber",
  "purchaseNumber",
  "returnNumber",
  "cashInNumber",
  "cashOutNumber",
  "referenceNumber",
  "sourceRef",
  "referenceCode",
  "code",
  "planCode",
  "workNumber",
  "payrollNumber",
  "productionOrderCode",
  "planningCode",
  "bomCode",
  "itemCode",
  "productCode",
  "materialCode",
  "customerCode",
  "supplierCode",
  "employeeCode",
  "workerCode",
  "sku",
  "legacyCode",
];

const DEFAULT_NESTED_KEYS = ["details", "sourceMeta", "reference", "meta", "raw", "rawRecord"];

const TECHNICAL_ID_FIELDS = ["id", "docId", "documentId", "referenceId", "sourceId", "relatedId", "expenseId"];

const readNestedValue = (record = {}, fieldName = "") => {
  const directValue = safeTrim(record?.[fieldName]);
  if (directValue) return directValue;

  for (const nestedKey of DEFAULT_NESTED_KEYS) {
    const nestedValue = safeTrim(record?.[nestedKey]?.[fieldName]);
    if (nestedValue) return nestedValue;
  }

  return "";
};

const isLikelyTechnicalId = (value = "") => {
  const normalized = safeTrim(value);
  if (!normalized) return false;
  if (normalized.includes("-") || normalized.includes("/") || normalized.includes(" ")) return false;
  return /^[A-Za-z0-9_-]{18,28}$/.test(normalized);
};

const readTechnicalReference = (record = {}) => {
  for (const fieldName of TECHNICAL_ID_FIELDS) {
    const value = readNestedValue(record, fieldName);
    if (value) return value;
  }

  return "";
};

/*
=====================================================
SECTION: Display Reference Resolver — AKTIF / LEGACY-COMPAT
Fungsi:
- Memilih kode referensi manusiawi untuk UI, report, log, ledger, dan export.
- Memprioritaskan kode bisnis baru seperti saleNumber/purchaseNumber/returnNumber/cashInNumber/cashOutNumber.

Dipakai oleh:
- Stock Management, laporan, production pages, dan helper opsi referensi.

Alasan perubahan:
- Firestore document ID tetap dipakai sebagai relasi internal, tetapi user tidak perlu melihat ID random jika ada kode bisnis.

Catatan cleanup:
- Setelah data test dibuat ulang dan seluruh transaksi baru punya kode manusiawi, fallback ID teknis bisa makin disembunyikan.

Risiko:
- Hasil resolver ini hanya untuk display/search/export. Jangan dipakai sebagai ID relasi/write Firestore.
=====================================================
*/
export const resolveDisplayReference = (record = {}, options = {}) => {
  const {
    fields = [],
    fallback = "-",
    allowTechnicalId = false,
    compactTechnicalId = true,
    includeDefaultFields = true,
  } = options;

  const fieldOrder = [...new Set(includeDefaultFields ? [...fields, ...DEFAULT_REFERENCE_FIELDS] : fields)];

  for (const fieldName of fieldOrder) {
    const value = readNestedValue(record, fieldName);
    if (!value) continue;

    if (fieldName === "sourceRef" && isLikelyTechnicalId(value)) {
      continue;
    }

    return value;
  }

  if (allowTechnicalId) {
    const technicalReference = readTechnicalReference(record);
    if (technicalReference) {
      if (!compactTechnicalId || technicalReference.length <= 12) return technicalReference;
      return `${technicalReference.slice(0, 8)}...${technicalReference.slice(-4)}`;
    }
  }

  return fallback;
};

export const hasHumanDisplayReference = (record = {}, options = {}) =>
  resolveDisplayReference(record, { ...options, fallback: "", allowTechnicalId: false }) !== "";

export const buildDisplayReferenceSearchText = (record = {}, options = {}) => {
  const reference = resolveDisplayReference(record, { ...options, fallback: "", allowTechnicalId: true });
  const technicalReference = readTechnicalReference(record);

  return [reference, technicalReference].filter(Boolean).join(" ");
};
