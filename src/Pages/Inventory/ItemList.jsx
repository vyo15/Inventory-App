// src/components/ItemList.jsx
import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase"; // pastikan path ini sesuai

const ItemList = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "items"));
        const list = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setItems(list);
      } catch (error) {
        console.error("Gagal mengambil data items:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (items.length === 0) return <p>Data kosong</p>;

  return (
    <div>
      <h2>Daftar Items</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.nama || "Nama tidak tersedia"}{" "}
            {/* Ganti 'nama' sesuai field di Firestore */}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ItemList;
