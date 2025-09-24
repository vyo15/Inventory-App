import React, { useEffect, useState } from "react";
import { Table, message, Tag } from "antd";
import { getInventoryLogs } from "../../utils/stockService";
import dayjs from "dayjs";

const StockManagement = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const columns = [
    {
      title: "Tanggal",
      dataIndex: "timestamp",
      render: (val) => {
        if (!val) return "";
        return dayjs(val.toDate()).format("DD-MM-YYYY HH:mm");
      },
    },
    {
      title: "Tipe",
      dataIndex: "type",
      render: (type, record) => {
        let tagColor = "blue";
        let text = "Lainnya";
        let adjustmentLabel = "";

        if (type.includes("purchase_in")) {
          text = "Pembelian";
          tagColor = "green";
        } else if (type === "sale" || type.includes("sale_revert")) {
          text = type === "sale" ? "Terjual" : "Batal Jual";
          tagColor = type === "sale" ? "blue" : "red";
        } else if (type === "stock_adjustment") {
          text = "Penyesuaian";
          tagColor = "orange";
          if (record.quantityChange > 0) {
            adjustmentLabel = "(+)";
          } else {
            adjustmentLabel = "(-)";
          }
        } else if (type === "production_out") {
          // Menangani log untuk bahan baku produksi
          text = "Produksi";
          tagColor = "red";
        } else if (type === "production_in") {
          // Menangani log untuk hasil produksi
          text = "Hasil Produksi";
          tagColor = "green";
        } else if (type.includes("out")) {
          text = "Keluar";
          tagColor = "red";
        } else if (type.includes("in")) {
          text = "Masuk";
          tagColor = "green";
        }

        return (
          <Tag color={tagColor}>
            {text} {adjustmentLabel}
          </Tag>
        );
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
      render: (val) => {
        const quantity = Math.abs(val);
        return <span>{quantity}</span>;
      },
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
