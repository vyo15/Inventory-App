import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";

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

// =========================
// SECTION: Normalisasi payload customer
// Fungsi:
// - merapikan field customer sebelum disimpan ke Firestore
// Hubungan flow aplikasi:
// - menjaga bentuk data Master Customer konsisten sebelum dibaca Sales
// Status:
// - aktif/final
// =========================
const normalizeCustomerPayload = (values = {}) => ({
  name: String(values.name || "").trim(),
  contact: String(values.contact || "").trim(),
  address: String(values.address || "").trim(),
  note: String(values.note || "").trim(),
});

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

// =========================
// SECTION: Tambah customer
// Fungsi:
// - membuat customer baru di collection final `customers`
// Hubungan flow aplikasi:
// - customer baru langsung bisa muncul di Sales setelah fetch ulang
// Status:
// - aktif/final
// =========================
export const createCustomer = async (values = {}) => {
  const payload = normalizeCustomerPayload(values);

  return await addDoc(collection(db, CUSTOMERS_COLLECTION), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

// =========================
// SECTION: Update customer
// Fungsi:
// - mengubah master customer di collection final `customers`
// Hubungan flow aplikasi:
// - tidak mengubah snapshot customerName pada sales lama agar histori transaksi aman
// Status:
// - aktif/final
// =========================
export const updateCustomer = async (customerId, values = {}) => {
  if (!customerId) {
    throw new Error("Customer yang akan diubah tidak valid.");
  }

  const customerRef = doc(db, CUSTOMERS_COLLECTION, customerId);
  const payload = normalizeCustomerPayload(values);

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
