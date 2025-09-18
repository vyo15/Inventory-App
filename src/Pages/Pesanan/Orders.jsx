import React, { useState, useEffect } from "react";
import {
  Table,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { db } from "../../firebase"; // ✅ Sesuaikan path jika berbeda
import {
  collection,
  addDoc,
  getDocs,
  Timestamp,
  query,
  orderBy,
} from "firebase/firestore";

const { Option } = Select;

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 🔄 Ambil data dari Firestore saat load
  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const ordersRef = collection(db, "orders");
      const q = query(ordersRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      const fetchedOrders = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate().toISOString().slice(0, 10),
      }));
      setOrders(fetchedOrders);
    } catch (error) {
      console.error("Gagal mengambil pesanan:", error);
    }
  };

  const handleAddOrder = async () => {
    try {
      const values = await form.validateFields();

      const newOrder = {
        customer: values.customer,
        product: values.product,
        platform: values.platform,
        status: values.status,
        date: Timestamp.fromDate(values.date.toDate()), // simpan sebagai Timestamp
        createdAt: Timestamp.now(), // untuk sorting
      };

      await addDoc(collection(db, "orders"), newOrder);
      message.success("Pesanan berhasil ditambahkan!");

      setIsModalVisible(false);
      form.resetFields();
      fetchOrders(); // refresh table
    } catch (error) {
      console.error("Gagal tambah pesanan:", error);
      message.error("Gagal menambahkan pesanan.");
    }
  };

  const columns = [
    {
      title: "Nama Pelanggan",
      dataIndex: "customer",
      key: "customer",
    },
    {
      title: "Produk",
      dataIndex: "product",
      key: "product",
    },
    {
      title: "Platform",
      dataIndex: "platform",
      key: "platform",
    },
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
    {
      title: "Tanggal",
      dataIndex: "date",
      key: "date",
    },
  ];

  return (
    <div>
      <h2>Daftar Pesanan</h2>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setIsModalVisible(true)}
      >
        Tambah Pesanan
      </Button>

      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        pagination={{ pageSize: 5 }}
        style={{ marginTop: 16 }}
      />

      <Modal
        title="Tambah Pesanan"
        open={isModalVisible}
        onOk={handleAddOrder}
        onCancel={() => setIsModalVisible(false)}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Nama Pelanggan"
            name="customer"
            rules={[{ required: true, message: "Harap isi nama pelanggan!" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Nama Produk"
            name="product"
            rules={[{ required: true, message: "Harap isi nama produk!" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Platform"
            name="platform"
            rules={[{ required: true, message: "Harap pilih platform!" }]}
          >
            <Select placeholder="Pilih platform">
              <Option value="Shopee">Shopee</Option>
              <Option value="Tokopedia">Tokopedia</Option>
              <Option value="TikTok">TikTok</Option>
              <Option value="WhatsApp">WhatsApp</Option>
              <Option value="Instagram">Instagram</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: "Harap pilih status!" }]}
          >
            <Select placeholder="Pilih status pesanan">
              <Option value="Diproses">Diproses</Option>
              <Option value="Dikirim">Dikirim</Option>
              <Option value="Selesai">Selesai</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="Tanggal"
            name="date"
            rules={[{ required: true, message: "Harap pilih tanggal!" }]}
            initialValue={dayjs()}
          >
            <DatePicker format="YYYY-MM-DD" style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Orders;
