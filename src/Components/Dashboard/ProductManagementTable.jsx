// src/Components/Dashboard/ProductManagementTable.jsx
import React from "react";
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Popconfirm,
  Space,
  Select,
  InputNumber,
  message, // Tambahkan message dari antd
} from "antd";
import { EditOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import {
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  doc,
} from "firebase/firestore"; // Import fungsi Firebase
import { db } from "../../firebase"; // <--- PASTIKAN PATH INI BENAR (relatif ke firebase.js)

const { Option } = Select;

const ProductManagementTable = ({ products, categories, loading }) => {
  const [form] = Form.useForm(); // Gunakan useForm di sini untuk mengelola form modal
  const [modalVisible, setModalVisible] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null);

  // --- Fungsi CRUD Produk ---
  const handleSaveProduct = async (values) => {
    try {
      const productData = { ...values, stock: values.stock || 0 };
      if (isEditing) {
        await updateDoc(doc(db, "products", editingId), productData);
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
    form.setFieldsValue(record); // Isi form dengan data yang akan diedit
  };

  const handleAddProduct = () => {
    setIsEditing(false);
    setModalVisible(true);
    setEditingId(null);
    form.resetFields(); // Bersihkan form
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setIsEditing(false);
    setEditingId(null);
    form.resetFields();
  };

  const productColumns = [
    { title: "Nama", dataIndex: "name", key: "name" },
    { title: "Kategori", dataIndex: "category", key: "category" },
    { title: "Satuan", dataIndex: "unit", key: "unit" },
    { title: "Stok", dataIndex: "stock", key: "stock" },
    {
      title: "Harga Satuan",
      dataIndex: "price",
      key: "price",
      render: (text) => `Rp ${Number(text || 0).toLocaleString("id-ID")}`,
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
    <Card title="Daftar Produk" className="dashboard-card" loading={loading}>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleAddProduct}
        style={{ marginBottom: 16 }}
      >
        Tambah Produk
      </Button>
      <Table
        columns={productColumns}
        dataSource={products}
        loading={loading}
        rowKey="id"
        locale={{ emptyText: "Tidak ada produk." }}
      />

      <Modal
        title={isEditing ? "Edit Produk" : "Tambah Produk"}
        open={modalVisible}
        onCancel={handleModalCancel}
        onOk={() => form.submit()} // Trigger form submission
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
              { required: true, message: "Harga wajib diisi", type: "number" },
            ]}
          >
            <InputNumber
              min={0}
              style={{ width: "100%" }}
              formatter={(value) =>
                `Rp ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              } // Format saat diketik
              parser={(value) => value.replace(/Rp\s?|(,*)/g, "")} // Parse kembali ke angka
            />
          </Form.Item>
          <Form.Item name="stock" label="Stok">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default ProductManagementTable;
