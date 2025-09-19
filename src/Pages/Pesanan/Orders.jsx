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
  Tabs,
  message,
  Space,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  getDocs,
  Timestamp,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
} from "firebase/firestore";

const { Option } = Select;

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [form] = Form.useForm();

  useEffect(() => {
    fetchOrders(activeTab);
    fetchProducts();
  }, [activeTab]);

  const fetchOrders = async (statusFilter) => {
    setLoading(true);
    try {
      const ordersRef = collection(db, "orders");
      let q;

      if (statusFilter === "all") {
        q = query(ordersRef, orderBy("createdAt", "desc"));
      } else {
        q = query(
          ordersRef,
          where("status", "==", statusFilter),
          orderBy("createdAt", "desc")
        );
      }

      const querySnapshot = await getDocs(q);
      const fetchedOrders = querySnapshot.docs.map((d) => {
        const data = d.data();
        const dateValue = data.date;
        return {
          id: d.id,
          ...data,
          date: dateValue?.toDate
            ? dayjs(dateValue.toDate()).format("YYYY-MM-DD")
            : "Tanggal Tidak Tersedia",
        };
      });
      setOrders(fetchedOrders);
    } catch (error) {
      console.error("Gagal mengambil pesanan:", error);
      message.error(
        "Gagal mengambil data pesanan. Silakan periksa konsol untuk detailnya."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const productsRef = collection(db, "products");
      const productsSnapshot = await getDocs(productsRef);
      const productsList = productsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProducts(productsList);
    } catch (error) {
      console.error("Gagal mengambil data produk:", error);
      message.error("Gagal memuat daftar produk.");
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
        date: Timestamp.fromDate(values.date.toDate()),
        receiptNumber: values.receiptNumber || null,
        createdAt: Timestamp.now(),
      };
      await addDoc(collection(db, "orders"), newOrder);
      message.success("Pesanan berhasil ditambahkan!");
      setIsModalVisible(false);
      form.resetFields();
      fetchOrders(activeTab);
    } catch (error) {
      console.error("Gagal tambah pesanan:", error);
      message.error("Gagal menambahkan pesanan.");
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { status: newStatus });
      message.success(`Status pesanan berhasil diubah menjadi ${newStatus}.`);
      fetchOrders(activeTab);
    } catch (error) {
      console.error("Gagal update status:", error);
      message.error("Gagal mengubah status pesanan.");
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
      title: "Resi",
      dataIndex: "receiptNumber",
      key: "receiptNumber",
      render: (receiptNumber) => receiptNumber || "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const statusColors = {
          Selesai: "green",
          Dikirim: "orange",
          Diproses: "blue",
        };
        const color = statusColors[status] || "default";
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: "Tanggal",
      dataIndex: "date",
      key: "date",
    },
    {
      title: "Aksi",
      key: "action",
      render: (text, record) => (
        <Space size="middle">
          {record.status === "Diproses" && (
            <Button
              type="link"
              onClick={() => handleUpdateStatus(record.id, "Dikirim")}
            >
              Dikirim
            </Button>
          )}
          {record.status === "Dikirim" && (
            <Button
              type="link"
              onClick={() => handleUpdateStatus(record.id, "Selesai")}
            >
              Selesai
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: "all", label: "Semua Pesanan" },
    { key: "Diproses", label: "Diproses" },
    { key: "Dikirim", label: "Dikirim" },
    { key: "Selesai", label: "Selesai" },
  ];

  return (
    <div>
      <h2>Daftar Pesanan</h2>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setIsModalVisible(true);
          form.resetFields();
        }}
      >
        Tambah Pesanan
      </Button>

      <Tabs
        items={tabItems}
        defaultActiveKey="all"
        onChange={(key) => setActiveTab(key)}
        style={{ marginTop: 16 }}
      />

      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        pagination={{ pageSize: 5 }}
        loading={loading}
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
            <Input placeholder="Ketik nama pelanggan" />
          </Form.Item>
          <Form.Item
            label="Nama Produk"
            name="product"
            rules={[{ required: true, message: "Harap pilih produk!" }]}
          >
            <Select placeholder="Pilih produk dari inventaris">
              {products.map((product) => (
                <Option key={product.id} value={product.name}>
                  {product.name}
                </Option>
              ))}
            </Select>
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
          <Form.Item label="Nomor Resi" name="receiptNumber">
            <Input placeholder="Opsional: Masukkan nomor resi" />
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
