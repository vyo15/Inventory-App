import React, { useEffect, useState } from "react";
import { Table, Tag, message } from "antd";
import { db } from "../../firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useParams } from "react-router-dom";

const statusMap = {
  processing: "Diproses",
  shipped: "Dikirim",
  completed: "Selesai",
};

const OrdersByStatus = () => {
  const { status } = useParams();
  const [orders, setOrders] = useState([]);

  const readableStatus = statusMap[status];

  useEffect(() => {
    if (!readableStatus) return;
    fetchOrders();
  }, [status]);

  const fetchOrders = async () => {
    try {
      const q = query(
        collection(db, "orders"),
        where("status", "==", readableStatus),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const fetched = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate().toISOString().slice(0, 10),
      }));
      setOrders(fetched);
    } catch (error) {
      console.error("Gagal mengambil pesanan:", error);
      message.error("Gagal mengambil data.");
    }
  };

  const columns = [
    { title: "Nama Pelanggan", dataIndex: "customer", key: "customer" },
    { title: "Produk", dataIndex: "product", key: "product" },
    { title: "Platform", dataIndex: "platform", key: "platform" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        let color = "blue";
        if (status === "Selesai") color = "green";
        else if (status === "Dikirim") color = "orange";
        else if (status === "Diproses") color = "purple";
        return <Tag color={color}>{status}</Tag>;
      },
    },
    { title: "Tanggal", dataIndex: "date", key: "date" },
  ];

  if (!readableStatus) {
    return <p>Status pesanan tidak valid.</p>;
  }

  return (
    <div>
      <h2>Pesanan: {readableStatus}</h2>
      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        pagination={{ pageSize: 5 }}
      />
    </div>
  );
};

export default OrdersByStatus;
