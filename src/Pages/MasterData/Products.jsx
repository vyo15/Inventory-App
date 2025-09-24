import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Popconfirm,
  message,
  Space,
  Select,
  InputNumber,
} from "antd";
import { EditOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase";

const { Option } = Select;

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    // Real-time listener untuk koleksi products
    const unsubscribeProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const data = [];
        snapshot.forEach((doc) =>
          data.push({ id: doc.id, ...doc.data(), key: doc.id })
        );
        setProducts(data);
        setLoading(false);
      },
      (error) => {
        message.error("Gagal memuat produk.");
        console.error("Error fetching products: ", error);
        setLoading(false);
      }
    );

    // Real-time listener untuk koleksi categories
    const unsubscribeCategories = onSnapshot(
      collection(db, "categories"),
      (snapshot) => {
        const data = [];
        snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
        setCategories(data);
      },
      (error) => {
        message.error("Gagal memuat kategori.");
        console.error("Error fetching categories: ", error);
      }
    );

    // Listener untuk koleksi raw_materials
    const unsubscribeRawMaterials = onSnapshot(
      collection(db, "raw_materials"),
      () => {},
      () => {}
    );

    // Cleanup function
    return () => {
      unsubscribeProducts();
      unsubscribeCategories();
      unsubscribeRawMaterials();
    };
  }, []);

  const handleSaveProduct = async (values) => {
    try {
      const productData = { ...values, stock: values.stock || 0 };

      if (isEditing) {
        const docRef = doc(db, "products", editingId);
        await updateDoc(docRef, productData);
        message.success("Produk berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "products"), productData);
        message.success("Produk berhasil ditambahkan!");
      }

      form.resetFields();
      setModalVisible(false);
      setIsEditing(false);
      setEditingId(null);
    } catch (error) {
      message.error("Gagal menyimpan produk.");
      console.error("Error saving product: ", error);
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      await deleteDoc(doc(db, "products", id));
      message.success("Produk berhasil dihapus!");
    } catch (error) {
      message.error("Gagal menghapus produk.");
      console.error("Error deleting product: ", error);
    }
  };

  const handleEditProduct = (record) => {
    setIsEditing(true);
    setModalVisible(true);
    setEditingId(record.id);
    form.setFieldsValue(record);
  };

  const columns = [
    { title: "Nama", dataIndex: "name", key: "name" },
    { title: "Kategori", dataIndex: "category", key: "category" },
    { title: "Satuan", dataIndex: "unit", key: "unit" }, // Tambahkan kolom unit
    { title: "Stok", dataIndex: "stock", key: "stock" },
    {
      title: "Harga Satuan",
      dataIndex: "price",
      key: "price",
      render: (text) => `Rp ${Number(text).toLocaleString("id-ID")}`,
    },
    {
      title: "Aksi",
      key: "actions",
      render: (_, record) => (
        <Space size="middle">
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEditProduct(record)}
            size="small"
          >
            Edit
          </Button>
          <Popconfirm
            title="Yakin ingin menghapus produk ini?"
            onConfirm={() => handleDeleteProduct(record.id)}
            okText="Ya"
            cancelText="Tidak"
          >
            <Button icon={<DeleteOutlined />} danger size="small">
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
        onClick={() => {
          setModalVisible(true);
          setIsEditing(false);
          form.resetFields();
        }}
        style={{ marginBottom: 16 }}
      >
        Tambah Produk
      </Button>
      <Table columns={columns} dataSource={products} loading={loading} />

      <Modal
        title={isEditing ? "Edit Produk" : "Tambah Produk"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setIsEditing(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical" onFinish={handleSaveProduct}>
          <Form.Item
            name="name"
            label="Nama Produk"
            rules={[{ required: true, message: "Nama produk wajib diisi!" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="unit"
            label="Satuan"
            rules={[{ required: true, message: "Satuan wajib diisi" }]}
          >
            <Select placeholder="Pilih satuan">
              <Option value="pcs">Pcs</Option>
              <Option value="roll">Roll</Option>
              <Option value="meter">Meter</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="category"
            label="Kategori"
            rules={[{ required: true, message: "Kategori wajib diisi!" }]}
          >
            <Select placeholder="Pilih kategori">
              {categories.map((cat) => (
                <Option key={cat.id} value={cat.name}>
                  {cat.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="price"
            label="Harga Satuan (Rp)"
            rules={[
              {
                required: true,
                message: "Harga wajib diisi",
                type: "number",
                min: 0,
              },
            ]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="stock" label="Stok">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Products;
