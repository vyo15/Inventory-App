import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
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

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [form] = Form.useForm();

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "categories"));
      const list = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCategories(list);
    } catch (error) {
      console.error("Gagal ambil data:", error);
      message.error("Gagal mengambil data kategori.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddOrEditCategory = async (values) => {
    try {
      if (isEditing && currentId) {
        // update dokumen
        await updateDoc(doc(db, "categories", currentId), values);
        message.success("Kategori berhasil diubah!");
      } else {
        // tambah dokumen baru
        await addDoc(collection(db, "categories"), values);
        message.success("Kategori berhasil ditambahkan!");
      }
      form.resetFields();
      setIsModalVisible(false);
      setIsEditing(false);
      setCurrentId(null);
      fetchCategories();
    } catch (error) {
      console.error("Gagal simpan kategori:", error);
      message.error("Gagal menyimpan kategori.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "categories", id));
      message.success("Kategori dihapus");
      fetchCategories();
    } catch (error) {
      console.error("Gagal hapus kategori:", error);
      message.error("Gagal menghapus kategori");
    }
  };

  const handleEdit = (record) => {
    setIsEditing(true);
    setIsModalVisible(true);
    setCurrentId(record.id);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
    });
  };

  const columns = [
    {
      title: "Nama Kategori",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "Deskripsi",
      dataIndex: "description",
      key: "description",
    },
    {
      title: "Aksi",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Yakin hapus kategori ini?"
            onConfirm={() => handleDelete(record.id)}
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
      <h2>Daftar Kategori</h2>

      <Table
        columns={columns}
        dataSource={categories}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={isEditing ? "Edit Kategori" : "Tambah Kategori"}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setIsEditing(false);
          setCurrentId(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical" onFinish={handleAddOrEditCategory}>
          <Form.Item
            name="name"
            label="Nama Kategori"
            rules={[{ required: true, message: "Nama wajib diisi" }]}
          >
            <Input placeholder="Contoh: Makanan, Elektronik" />
          </Form.Item>
          <Form.Item name="description" label="Deskripsi">
            <Input.TextArea placeholder="Deskripsi kategori (opsional)" />
          </Form.Item>
        </Form>
      </Modal>

      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setIsModalVisible(true);
          setIsEditing(false);
          setCurrentId(null);
          form.resetFields();
        }}
        style={{
          marginTop: 16,
          marginBottom: 16,
        }}
      >
        Tambah Kategori
      </Button>
    </div>
  );
};

export default Categories;
