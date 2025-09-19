import React, { useEffect, useState } from "react";
import { Table, message, Tag } from "antd";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import dayjs from "dayjs";

const StockManagement = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fungsi untuk mengambil data riwayat stok
  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Ambil data dari 3 koleksi yang berbeda secara paralel
      const [insSnap, outsSnap, adjSnap] = await Promise.all([
        getDocs(collection(db, "stock_in")),
        getDocs(collection(db, "stock_out")),
        getDocs(collection(db, "stock_adjustments")),
      ]);

      // Ubah snapshot menjadi array objek dengan properti tambahan
      const mapSnap = (snap, type) =>
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          movementType: type, // Tambahkan tipe pergerakan stok (contoh: "stock_in")
        }));

      // Gabungkan semua data dari 3 koleksi
      let merged = [
        ...mapSnap(insSnap, "stock_in"),
        ...mapSnap(outsSnap, "stock_out"),
        ...mapSnap(adjSnap, "adjustment"),
      ];

      // Urutkan data berdasarkan tanggal terbaru
      merged.sort(
        (a, b) =>
          new Date(b.date?.toDate?.() || b.date) -
          new Date(a.date?.toDate?.() || a.date)
      );

      setHistory(merged);
    } catch (error) {
      console.error(error);
      message.error("Gagal mengambil riwayat stok");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Definisikan kolom tabel
  const columns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      render: (val) => {
        if (!val) return "";
        const dateObj = val.toDate ? val.toDate() : new Date(val);
        return dayjs(dateObj).format("DD-MM-YYYY HH:mm");
      },
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
    },
    {
      title: "Tipe",
      dataIndex: "movementType",
      render: (val) => {
        let tagColor = "blue";
        let text = "Tidak Diketahui";
        if (val === "stock_in") {
          text = "Masuk";
          tagColor = "green";
        } else if (val === "stock_out") {
          text = "Keluar";
          tagColor = "red";
        } else if (val === "adjustment") {
          text = "Penyesuaian";
          tagColor = "geekblue";
        }
        return <Tag color={tagColor}>{text}</Tag>;
      },
    },
    {
      title: "Item",
      dataIndex: "itemName", // Menampilkan nama item yang sudah disimpan
      key: "itemName",
      render: (text) => text || "-",
    },
    {
      title: "Jenis Item",
      dataIndex: "type",
      key: "type",
      render: (type) => (type === "product" ? "Produk" : "Bahan Baku"),
    },
    {
      title: "Jumlah",
      dataIndex: "quantity",
      render: (val, record) => {
        let color = "black";
        if (record.movementType === "stock_in") {
          color = "green";
        } else if (record.movementType === "stock_out") {
          color = "red";
        }
        return <span style={{ color, fontWeight: "bold" }}>{val}</span>;
      },
    },
    {
      title: "Catatan",
      dataIndex: "note",
      render: (text) => text || "-",
    },
    {
      title: "Supplier",
      dataIndex: "supplierName", // Kolom untuk nama supplier
      render: (text) => text || "-",
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>Riwayat Pergerakan Stok</h2>
      <Table
        dataSource={history}
        columns={columns}
        rowKey="id"
        loading={loading}
      />
    </div>
  );
};

export default StockManagement;
