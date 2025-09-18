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
  Typography,
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
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]); // Berisi nama produk dan linknya
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "raw_materials"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMaterials(data);
    } catch (error) {
      message.error("Gagal mengambil data bahan baku.");
      console.error(error);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const snapshot = await getDocs(collection(db, "categories"));
      const data = snapshot.docs.map((doc) => doc.data().name);
      setCategories(data);
    } catch (error) {
      message.error("Gagal mengambil data kategori.");
      console.error(error);
    }
  };

  // 🔴 PERUBAHAN UTAMA 1: Mengambil nama produk dan linknya dari `supplierPurchases`
  const fetchSuppliers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "supplierPurchases"));
      const uniqueItems = {};
      snapshot.forEach((doc) => {
        const { item, storeLink } = doc.data();
        if (item && storeLink) {
          // Gunakan nama item (produk) sebagai kunci untuk memastikan keunikan
          uniqueItems[item] = storeLink;
        }
      });
      // Ubah objek menjadi array objek agar mudah di-map
      setSuppliers(
        Object.keys(uniqueItems).map((key) => ({
          name: key,
          link: uniqueItems[key],
        }))
      );
    } catch (error) {
      message.error("Gagal mengambil data supplier.");
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
      let supplierData = values.supplier;
      if (typeof supplierData === "string") {
        supplierData = suppliers.find((s) => s.name === supplierData);
      }

      const payload = {
        ...values,
        supplier: supplierData,
        stock: values.stock || 0,
      };

      if (isEditing) {
        const docRef = doc(db, "raw_materials", editingId);
        await updateDoc(docRef, payload);
        message.success("Bahan baku berhasil diupdate.");
      } else {
        await addDoc(collection(db, "raw_materials"), payload);
        message.success("Bahan baku berhasil ditambahkan.");
      }
      form.resetFields();
      setModalVisible(false);
      setIsEditing(false);
      setEditingId(null);
      fetchMaterials();
    } catch (error) {
      message.error("Gagal menyimpan bahan baku.");
      console.error(error);
    }
  };

  const handleDeleteMaterial = async (id) => {
    try {
      await deleteDoc(doc(db, "raw_materials", id));
      message.success("Bahan baku berhasil dihapus.");
      fetchMaterials();
    } catch (error) {
      message.error("Gagal menghapus bahan baku.");
      console.error(error);
    }
  };

  const handleEditMaterial = (record) => {
    setIsEditing(true);
    setModalVisible(true);
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      supplier: record.supplier ? record.supplier.name : null,
    });
  };

  const columns = [
    { title: "Nama Bahan Baku", dataIndex: "name", key: "name" },
    { title: "Kategori", dataIndex: "category", key: "category" },
    { title: "Satuan", dataIndex: "unit", key: "unit" },
    {
      title: "Harga Satuan",
      dataIndex: "price",
      key: "price",
      render: (text) => `Rp ${text.toLocaleString("id-ID")}`,
    },
    { title: "Stok", dataIndex: "stock", key: "stock" },
    // 🔴 PERUBAHAN UTAMA 2: Kolom Supplier hanya menampilkan tulisan "Link"
    {
      title: "Supplier",
      dataIndex: "supplier",
      key: "supplier",
      render: (supplier) =>
        supplier && supplier.link ? (
          <a href={supplier.link} target="_blank" rel="noopener noreferrer">
            Link
          </a>
        ) : (
          "-"
        ),
    },
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
      <Typography.Title level={4}>Daftar Bahan Baku</Typography.Title>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setModalVisible(true);
          setIsEditing(false);
          setEditingId(null);
          form.resetFields();
        }}
        style={{ marginBottom: 16 }}
      >
        Tambah Bahan Baku
      </Button>

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
            label="Produk Supplier"
            rules={[{ required: true, message: "Produk supplier wajib diisi" }]}
          >
            <Select placeholder="Pilih produk supplier">
              {suppliers.map((supplier) => (
                <Option key={supplier.name} value={supplier.name}>
                  {supplier.name}
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
