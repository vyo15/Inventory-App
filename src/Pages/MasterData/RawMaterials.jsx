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
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";

const { Option } = Select;

const RawMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]); // State untuk kategori
  const [suppliers, setSuppliers] = useState([]); // State untuk supplier
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  // Fungsi untuk mengambil data bahan baku
  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "raw_materials"));
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setMaterials(data);
    } catch (error) {
      message.error("Gagal mengambil data bahan baku");
      console.error(error);
    }
    setLoading(false);
  };

  // Fungsi untuk mengambil data kategori
  const fetchCategories = async () => {
    try {
      const snapshot = await getDocs(collection(db, "categories"));
      const data = snapshot.docs.map((doc) => doc.data().name);
      setCategories(data);
    } catch (error) {
      message.error("Gagal mengambil data kategori");
      console.error(error);
    }
  };

  // Fungsi untuk mengambil data supplier
  const fetchSuppliers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "supplierPurchases"));
      const supplierNames = new Set();
      snapshot.forEach((doc) => {
        if (doc.data().storeName) {
          supplierNames.add(doc.data().storeName);
        }
      });
      setSuppliers(Array.from(supplierNames));
    } catch (error) {
      message.error("Gagal mengambil data supplier");
      console.error(error);
    }
  };

  useEffect(() => {
    fetchMaterials();
    fetchCategories();
    fetchSuppliers();
  }, []);

  const handleSaveMaterial = async (values) => {
    try {
      if (isEditing) {
        const docRef = doc(db, "raw_materials", editingId);
        await updateDoc(docRef, values);
        message.success("Bahan baku berhasil diupdate");
      } else {
        await addDoc(collection(db, "raw_materials"), {
          ...values,
          stock: values.stock || 0,
        });
        message.success("Bahan baku berhasil ditambahkan");
      }

      form.resetFields();
      setModalVisible(false);
      setIsEditing(false);
      setEditingId(null);
      fetchMaterials();
    } catch (error) {
      message.error("Gagal menyimpan bahan baku");
      console.error(error);
    }
  };

  const handleDeleteMaterial = async (id) => {
    try {
      await deleteDoc(doc(db, "raw_materials", id));
      message.success("Bahan baku berhasil dihapus");
      fetchMaterials();
    } catch (error) {
      message.error("Gagal menghapus bahan baku");
      console.error(error);
    }
  };

  const handleEditMaterial = (record) => {
    setIsEditing(true);
    setModalVisible(true);
    setEditingId(record.id);
    form.setFieldsValue(record);
  };

  const columns = [
    { title: "Nama Bahan Baku", dataIndex: "name", key: "name" },
    { title: "Kategori", dataIndex: "category", key: "category" },
    { title: "Satuan", dataIndex: "unit", key: "unit" },
    {
      title: "Harga Satuan",
      dataIndex: "price",
      key: "price",
      render: (text) => `Rp ${text.toLocaleString()}`,
    },
    { title: "Stok", dataIndex: "stock", key: "stock" },
    { title: "Supplier", dataIndex: "supplier", key: "supplier" }, // Kolom baru untuk supplier
    {
      title: "Aksi",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEditMaterial(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Yakin hapus bahan baku ini?"
            onConfirm={() => handleDeleteMaterial(record.id)}
            okText="Ya"
            cancelText="Batal"
          >
            <Button danger size="small">
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
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
        Tambah Bahan Baku
      </Button>

      <h2>Daftar Bahan Baku</h2>
      <Table
        columns={columns}
        dataSource={materials}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={isEditing ? "Edit Bahan Baku" : "Tambah Bahan Baku"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setIsEditing(false);
          setEditingId(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveMaterial}
          initialValues={{ stock: 0 }}
        >
          <Form.Item
            name="name"
            label="Nama Bahan Baku"
            rules={[{ required: true, message: "Nama wajib diisi" }]}
          >
            <Input placeholder="Contoh: Kayu Jati" />
          </Form.Item>

          <Form.Item
            name="category"
            label="Kategori"
            rules={[{ required: true, message: "Kategori wajib diisi" }]}
          >
            <Select placeholder="Pilih kategori">
              {categories.map((category) => (
                <Option key={category} value={category}>
                  {category}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="supplier"
            label="Supplier"
            rules={[{ required: true, message: "Supplier wajib diisi" }]}
          >
            <Select placeholder="Pilih supplier">
              {suppliers.map((supplier) => (
                <Option key={supplier} value={supplier}>
                  {supplier}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="unit"
            label="Satuan"
            rules={[{ required: true, message: "Satuan wajib diisi" }]}
          >
            <Select placeholder="Pilih satuan">
              <Option value="pcs">Pcs</Option>
              <Option value="Roll">Roll</Option>
              <Option value="meter">Meter</Option>
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

          <Form.Item
            name="stock"
            label="Stok Awal"
            rules={[{ required: true, message: "Stok wajib diisi" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RawMaterials;
