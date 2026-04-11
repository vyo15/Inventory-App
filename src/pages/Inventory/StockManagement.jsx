import React, { useEffect, useState } from "react";
import { Table, message, Tag } from "antd";
import { getInventoryLogs } from "../../utils/stockService";
import dayjs from "dayjs";

// SECTION: format angka Indonesia tanpa desimal
const formatNumberID = (value) => {
  return Number(value || 0).toLocaleString("id-ID", {
    maximumFractionDigits: 0,
  });
};

const StockManagement = () => {
  // SECTION: state utama riwayat stok
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // SECTION: ambil seluruh riwayat pergerakan stok
  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await getInventoryLogs();
      setHistory(data);
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

  // SECTION: helper ubah kode log menjadi label yang lebih mudah dibaca
  const resolveTypeMeta = (type, record) => {
    if (!type) {
      return { text: "Lainnya", color: "default" };
    }

    if (type.includes("purchase_in")) {
      return { text: "Pembelian", color: "green" };
    }

    if (type === "sale") {
      return { text: "Terjual", color: "blue" };
    }

    if (type === "sale_revert" || type === "sale_cancel_revert") {
      return { text: "Batal / Hapus Jual", color: "red" };
    }

    if (type === "stock_adjustment") {
      return {
        text: record.quantityChange > 0 ? "Penyesuaian (+)" : "Penyesuaian (-)",
        color: "orange",
      };
    }

    if (type === "production_out_pending") {
      return { text: "Produksi Pending - Bahan Keluar", color: "volcano" };
    }

    if (type === "production_in_completed") {
      return { text: "Produksi Selesai - Produk Masuk", color: "green" };
    }

    if (type.includes("out")) {
      return { text: "Keluar", color: "red" };
    }

    if (type.includes("in")) {
      return { text: "Masuk", color: "green" };
    }

    return { text: "Lainnya", color: "default" };
  };

  // SECTION: kolom tabel riwayat stok
  const columns = [
    {
      title: "Tanggal",
      dataIndex: "timestamp",
      render: (val) => {
        if (!val?.toDate) return "";
        return dayjs(val.toDate()).format("DD-MM-YYYY HH:mm");
      },
    },
    {
      title: "Tipe",
      dataIndex: "type",
      render: (type, record) => {
        const meta = resolveTypeMeta(type, record);
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: "Item",
      dataIndex: "itemName",
    },
    {
      title: "Jenis Item",
      dataIndex: "collectionName",
      render: (name) => {
        if (name === "products") return "Produk Jadi";
        if (name === "raw_materials") return "Bahan Baku";
        return "-";
      },
    },
    {
      title: "Jumlah",
      dataIndex: "quantityChange",
      render: (val) => formatNumberID(Math.abs(val || 0)),
    },
    {
      title: "Catatan",
      dataIndex: "note",
      render: (text, record) => {
        if (record.note) {
          return record.note;
        }
        if (record.reason) {
          return record.reason;
        }
        return "-";
      },
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
