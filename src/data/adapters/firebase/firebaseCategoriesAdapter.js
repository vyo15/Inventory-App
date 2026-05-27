import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../../firebase";

const CATEGORIES_COLLECTION = "categories";

const toCategoryRecord = (categoryDocument) => ({
  id: categoryDocument.id,
  ...categoryDocument.data(),
});

export const listCategories = async () => {
  const categoriesQuery = query(
    collection(db, CATEGORIES_COLLECTION),
    orderBy("name", "asc")
  );
  const snapshot = await getDocs(categoriesQuery);
  return snapshot.docs.map(toCategoryRecord);
};

export const getCategoryById = async (categoryId) => {
  if (!categoryId) return null;

  const snapshot = await getDoc(doc(db, CATEGORIES_COLLECTION, categoryId));
  return snapshot.exists() ? toCategoryRecord(snapshot) : null;
};

export const createCategory = async (values = {}) => {
  const createdRef = await addDoc(collection(db, CATEGORIES_COLLECTION), values);
  return { id: createdRef.id };
};

export const updateCategory = async (categoryId, values = {}) => {
  if (!categoryId) {
    throw new Error("Kategori yang akan diubah tidak valid.");
  }

  await updateDoc(doc(db, CATEGORIES_COLLECTION, categoryId), values);
  return { id: categoryId };
};

export const deleteCategory = async (categoryId) => {
  if (!categoryId) {
    throw new Error("Kategori yang akan dihapus tidak valid.");
  }

  await deleteDoc(doc(db, CATEGORIES_COLLECTION, categoryId));
  return { id: categoryId, deleted: true };
};
