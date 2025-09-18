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
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  // Ambil data bahan baku dari Firestore
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

  useEffect(() => {
    fetchMaterials();
  }, []);

  // Simpan bahan baku (tambah / edit)
  const handleSaveMaterial = async (values) => {
    try {
      if (isEditing) {
        // Update
        const docRef = doc(db, "raw_materials", editingId);
        await updateDoc(docRef, values);
        message.success("Bahan baku berhasil diupdate");
      } else {
        // Tambah baru
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

  // Hapus bahan baku
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

  // Edit bahan baku
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
    { title: "Stok", dataIndex: "stock", key: "stock" },
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
              <Option value="Kayu">Kayu</Option>
              <Option value="Cat">Cat</Option>
              <Option value="Besi">Besi</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="unit"
            label="Satuan"
            rules={[{ required: true, message: "Satuan wajib diisi" }]}
          >
            <Select placeholder="Pilih satuan">
              <Option value="pcs">Pcs</Option>
              <Option value="kg">Kg</Option>
              <Option value="liter">Liter</Option>
              <Option value="meter">Meter</Option>
            </Select>
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

      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setModalVisible(true);
          setIsEditing(false);
          form.resetFields();
        }}
        style={{ marginTop: 16 }}
      >
        Tambah Bahan Baku
      </Button>
    </div>
  );
};

export default RawMaterials;
