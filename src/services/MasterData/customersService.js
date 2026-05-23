import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import {
  generateDailySequenceCode,
  getDailyBusinessCodeSequence,
  isBusinessCodeExists,
  prepareDailySequenceCodeInTransaction,
} from "../../utils/references/businessCodeGenerator";

// =========================
// SECTION: Source of truth customer final
// Fungsi:
// - menetapkan satu collection customer aktif untuk seluruh aplikasi
// Hubungan flow aplikasi:
// - dipakai Master Data Customer sebagai CRUD utama
// - dipakai Sales sebagai dropdown customer transaksi
// Status:
// - aktif/final
// - collection `Customers` uppercase adalah legacy/data uji dan bukan source aktif
// =========================
export const CUSTOMERS_COLLECTION = "customers";

const CUSTOMER_CODE_PREFIX = "CUS";
const CUSTOMER_CODE_PATTERN = /^CUS-\d{8}-\d{3,}$/;

export const normalizeCustomerCode = (value = "") => String(value || "").trim().toUpperCase();
export const isValidCustomerCodeFormat = (code = "") => CUSTOMER_CODE_PATTERN.test(normalizeCustomerCode(code));

// =========================
// SECTION: Normalisasi payload customer
// Fungsi:
// - merapikan field customer sebelum disimpan ke Firestore
// Hubungan flow aplikasi:
// - menjaga bentuk data Master Customer konsisten sebelum dibaca Sales
// Status:
// - aktif/final
// =========================
const normalizeCustomerPayload = (values = {}) => {
  const normalizedCode = normalizeCustomerCode(values.code || values.customerCode);

  return {
    code: normalizedCode,
    customerCode: normalizedCode,
    name: String(values.name || "").trim(),
    contact: String(values.contact || "").trim(),
    address: String(values.address || "").trim(),
    note: String(values.note || "").trim(),
  };
};

// =========================
// SECTION: Ambil semua customer
// Fungsi:
// - membaca customer dari collection final `customers`
// Hubungan flow aplikasi:
// - Master Customer dan Sales sama-sama memakai helper ini agar tidak ada query bercabang
// Status:
// - aktif/final
// =========================
export const getCustomers = async () => {
  const customersQuery = query(
    collection(db, CUSTOMERS_COLLECTION),
    orderBy("name", "asc"),
  );
  const snapshot = await getDocs(customersQuery);

  return snapshot.docs.map((customerDocument) => ({
    id: customerDocument.id,
    ...customerDocument.data(),
  }));
};

/* =====================================================
SECTION: Customer daily sequence code generator — AKTIF
Fungsi:
- Membuat kode Customer otomatis harian dengan format CUS-DDMMYYYY-001 tanpa memakai nama customer.

Dipakai oleh:
- Customers.jsx saat membuka modal tambah dan createCustomer() sebagai fallback service.

Alasan perubahan:
- Kode Customer harus konsisten seperti referensi transaksi, muncul otomatis, dan tidak bisa diinput manual.

Catatan cleanup:
- Helper readable code lama tetap dipertahankan untuk modul lain; belum ada cleanup di service ini.

Risiko:
- Mengembalikan kode berbasis nama atau random akan memutus audit dan membuat document ID tidak seragam.
===================================================== */
export const generateCustomerCode = async (_values = {}, excludeId = null) => {
  void _values;
  return generateDailySequenceCode({
    db,
    collectionName: CUSTOMERS_COLLECTION,
    fieldNames: ["code", "customerCode"],
    prefix: CUSTOMER_CODE_PREFIX,
    excludeId,
    dateFormat: "DDMMYYYY",
    sequenceLength: 3,
  });
};

export const assertCustomerCodeAvailable = async (code = "", editingId = null) => {
  const normalizedCode = normalizeCustomerCode(code);
  if (!normalizedCode) return;

  const existsByField = await isBusinessCodeExists({
    db,
    collectionName: CUSTOMERS_COLLECTION,
    fieldNames: ["code", "customerCode"],
    value: normalizedCode,
    excludeId: editingId,
  });

  if (existsByField) {
    throw { type: "validation", errors: { code: "Kode customer sudah digunakan" } };
  }

  const existingDocument = await getDoc(doc(db, CUSTOMERS_COLLECTION, normalizedCode));
  if (existingDocument.exists() && existingDocument.id !== editingId) {
    throw { type: "validation", errors: { code: "Kode customer sudah digunakan" } };
  }
};

export const resolveCustomerCode = async (values = {}, excludeId = null) => {
  const candidate = normalizeCustomerCode(values.code || values.customerCode);

  if (isValidCustomerCodeFormat(candidate)) {
    try {
      await assertCustomerCodeAvailable(candidate, excludeId);
      return candidate;
    } catch (error) {
      if (error?.type !== "validation") throw error;
    }
  }

  return generateCustomerCode(values, excludeId);
};

/* =====================================================
SECTION: Customer readable document ID create flow — AKTIF / GUARDED
Fungsi:
- Membuat Customer baru dengan Firestore document ID yang sama dengan kode bisnis CUS-DDMMYYYY-001.

Dipakai oleh:
- Customers.jsx saat submit tambah Customer.

Alasan perubahan:
- Create Customer tidak boleh lagi memakai addDoc/random ID atau kode berbasis nama agar referensi audit konsisten.

Catatan cleanup:
- Belum ada.

Risiko:
- Mengganti kembali ke addDoc akan menghasilkan document ID random dan memutus rule kode sebagai referensi utama.
===================================================== */
export const createCustomer = async (values = {}) => {
  const baselineCode = await generateCustomerCode(values, null);
  const baselineSequence = getDailyBusinessCodeSequence({
    code: baselineCode,
    prefix: CUSTOMER_CODE_PREFIX,
    date: new Date(),
  });
  let createdId = "";

  await runTransaction(db, async (transaction) => {
    const codeReservation = await prepareDailySequenceCodeInTransaction({
      transaction,
      db,
      collectionName: CUSTOMERS_COLLECTION,
      prefix: CUSTOMER_CODE_PREFIX,
      date: new Date(),
      minimumSequence: Math.max(baselineSequence - 1, 0),
    });
    const finalCode = codeReservation.code;

    if (!isValidCustomerCodeFormat(finalCode)) {
      throw { type: "validation", errors: { code: "Kode customer otomatis belum valid" } };
    }

    const customerRef = doc(db, CUSTOMERS_COLLECTION, finalCode);
    const existingSnapshot = await transaction.get(customerRef);

    if (existingSnapshot.exists()) {
      throw { type: "validation", errors: { code: "Kode customer sudah digunakan" } };
    }

    const payload = normalizeCustomerPayload({ ...values, code: finalCode, customerCode: finalCode });

    codeReservation.commit();
    transaction.set(customerRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    createdId = finalCode;
  });

  return { id: createdId };
};

/* =====================================================
SECTION: Customer immutable code update guard — AKTIF / GUARDED
Fungsi:
- Mengubah detail Customer tanpa generate ulang kode dan tanpa rename document ID.

Dipakai oleh:
- Customers.jsx saat submit edit Customer.

Alasan perubahan:
- Kode Customer harus immutable agar perubahan nama/kontak tidak mengubah referensi Sales dan audit.

Catatan cleanup:
- Data lama tanpa kode tetap dibuka tanpa migration; cleanup/migration harus menjadi task terpisah.

Risiko:
- Regenerate kode saat edit dapat membuat relasi historis dan audit master customer tidak konsisten.
===================================================== */
export const updateCustomer = async (customerId, values = {}) => {
  if (!customerId) {
    throw new Error("Customer yang akan diubah tidak valid.");
  }

  const currentSnapshot = await getDoc(doc(db, CUSTOMERS_COLLECTION, customerId));
  const currentData = currentSnapshot.exists() ? currentSnapshot.data() : {};
  const immutableCode = normalizeCustomerCode(
    values.code || values.customerCode || currentData.code || currentData.customerCode || customerId,
  );

  if (immutableCode) {
    await assertCustomerCodeAvailable(immutableCode, customerId);
  }

  const customerRef = doc(db, CUSTOMERS_COLLECTION, customerId);
  const payload = normalizeCustomerPayload({ ...values, code: immutableCode, customerCode: immutableCode });

  await updateDoc(customerRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  });
};

// =========================
// SECTION: Hapus customer
// Fungsi:
// - menghapus master customer dari collection final `customers`
// Hubungan flow aplikasi:
// - transaksi sales lama tetap aman karena menyimpan snapshot customerName
// Status:
// - aktif/final
// - jangan diarahkan ke `Customers` uppercase karena itu legacy/data uji
// =========================
export const deleteCustomer = async (customerId) => {
  if (!customerId) {
    throw new Error("Customer yang akan dihapus tidak valid.");
  }

  await deleteDoc(doc(db, CUSTOMERS_COLLECTION, customerId));
};
