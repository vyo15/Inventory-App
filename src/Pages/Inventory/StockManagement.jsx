import React, { useEffect, useState } from "react";
import { Table, message } from "antd";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

const StockManagement = () => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const [insSnap, outsSnap, adjSnap] = await Promise.all([
        getDocs(collection(db, "stock_in")),
        getDocs(collection(db, "stock_out")),
        getDocs(collection(db, "stock_adjustments")),
      ]);

      const mapSnap = (snap, type) =>
        snap.docs.map((doc) => ({
          id: doc.id,
          type,
          ...doc.data(),
        }));

      let merged = [
        ...mapSnap(insSnap, "stock_in"),
        ...mapSnap(outsSnap, "stock_out"),
        ...mapSnap(adjSnap, "adjustment"),
      ];

      // urut berdasarkan tanggal desc
      merged.sort((a, b) => new Date(b.date) - new Date(a.date));

      setHistory(merged);
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil riwayat stok");
    }
  };

  const columns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      render: (val) => (val ? new Date(val).toLocaleString() : ""),
    },
    {
      title: "Tipe",
      dataIndex: "type",
      render: (val) => {
        if (val === "stock_in") return "Masuk";
        if (val === "stock_out") return "Keluar";
        if (val === "adjustment") return "Penyesuaian";
        return val;
      },
    },
    { title: "Item", dataIndex: "itemName" },
    { title: "Jumlah", dataIndex: "quantity" },
    { title: "Catatan", dataIndex: "note", defaultValue: "-" },
    {
      title: "Supplier",
      dataIndex: "supplier",
      defaultValue: "-",
    }, // bisa beda nama
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>Riwayat Pergerakan Stok</h2>
      <Table dataSource={history} columns={columns} rowKey="id" />
    </div>
  );
};

export default StockManagement;
