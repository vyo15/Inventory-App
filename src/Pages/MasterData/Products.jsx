import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  Popconfirm,
  message,
  Select,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";

const { Option } = Select;

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form] = Form.useForm();

  // 🚀 Ambil semua produk dari Firestore
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "products"));
      const items = querySnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      setProducts(items);
    } catch (error) {
      console.error("Gagal ambil produk:", error);
      message.error("Gagal memuat produk");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 🚀 Tambah / Edit Produk
  const handleSave = async (values) => {
    try {
      if (editingProduct) {
        // update
        const docRef = doc(db, "products", editingProduct.id);
        await updateDoc(docRef, values);
        message.success("Produk berhasil diperbarui");
      } else {
        // tambah
        await addDoc(collection(db, "products"), values);
        message.success("Produk berhasil ditambahkan");
      }
      setIsModalVisible(false);
      form.resetFields();
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      console.error("Gagal simpan produk:", error);
      message.error("Gagal menyimpan produk");
    }
  };

  // 🚀 Hapus produk
  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "products", id));
      message.success("Produk berhasil dihapus");
      fetchProducts();
    } catch (error) {
      console.error("Gagal hapus produk:", error);
      message.error("Gagal menghapus produk");
    }
  };

  // 🚀 Kolom tabel
  const columns = [
    { title: "Nama Produk", dataIndex: "name", key: "name" },
    { title: "Kategori", dataIndex: "category", key: "category" },
    { title: "Supplier", dataIndex: "supplier", key: "supplier" },
    { title: "Stok", dataIndex: "stock", key: "stock" },
    {
      title: "Harga",
      dataIndex: "price",
      key: "price",
      render: (val) => `Rp ${val?.toLocaleString()}`,
    },
    {
      title: "Aksi",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            type="primary"
            size="small"
            onClick={() => {
              setEditingProduct(record);
              setIsModalVisible(true);
              form.setFieldsValue(record);
            }}
          >
            Edit
          </Button>
          <Popconfirm
            title="Yakin hapus produk ini?"
            onConfirm={() => handleDelete(record.id)}
            okText="Ya"
            cancelText="Batal"
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2>Daftar Produk</h2>

      <Button
        type="primary"
        icon={<PlusOutlined />}
        style={{ marginBottom: 16 }}
        onClick={() => {
          setIsModalVisible(true);
          setEditingProduct(null);
          form.resetFields();
        }}
      >
        Tambah Produk
      </Button>

      <Table
        columns={columns}
        dataSource={products}
        rowKey="id"
        loading={loading}
        bordered
      />

      <Modal
        title={editingProduct ? "Edit Produk" : "Tambah Produk"}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingProduct(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="name"
            label="Nama Produk"
            rules={[{ required: true, message: "Nama wajib diisi" }]}
          >
            <Input placeholder="Contoh: Baju Kemeja" />
          </Form.Item>

          <Form.Item
            name="category"
            label="Kategori"
            rules={[{ required: true, message: "Kategori wajib diisi" }]}
          >
            <Select placeholder="Pilih kategori">
              <Option value="Pakaian">Pakaian</Option>
              <Option value="Elektronik">Elektronik</Option>
              <Option value="Makanan">Makanan</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="supplier"
            label="Supplier"
            rules={[{ required: true, message: "Supplier wajib diisi" }]}
          >
            <Input placeholder="Contoh: PT Sumber Makmur" />
          </Form.Item>

          <Form.Item
            name="stock"
            label="Stok"
            rules={[{ required: true, message: "Stok wajib diisi" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="price"
            label="Harga (Rp)"
            rules={[{ required: true, message: "Harga wajib diisi" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Products;