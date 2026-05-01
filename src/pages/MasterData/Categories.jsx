import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
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
import PageFormModal from "../../components/Layout/Forms/PageFormModal";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";

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
      // =========================
      // SECTION: aksi tabel
      // Fungsi:
      // - Categories termasuk simple config page, jadi cukup Edit + Hapus tanpa Detail
      // - kolom aksi tetap memakai marker baseline final agar visual dan spacing konsisten lintas halaman
      // =========================
      title: "Aksi",
      key: "actions",
      width: 170,
      className: "app-table-action-column",
      render: (_, record) => (
        <Space wrap className="ims-action-group">
          <Button
            className="ims-action-button"
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
            <Button className="ims-action-button" danger size="small">
              Hapus
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <PageHeader
        title="Kategori"
        subtitle="Kelola master kategori agar pengelompokan item tetap konsisten di seluruh IMS."
        actions={[
          {
            key: "create-category",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Kategori",
            onClick: () => {
              setIsModalVisible(true);
              setIsEditing(false);
              setCurrentId(null);
              form.resetFields();
            },
          },
        ]}
      />

      <PageSection
        title="Daftar Kategori"
        subtitle="Halaman ini hanya mengelola master kategori dan tidak mengubah stok, kas, atau transaksi aktif."
      >
        <Table
          className="app-data-table"
          columns={columns}
          dataSource={categories}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </PageSection>

      <PageFormModal
        title={isEditing ? "Edit Kategori" : "Tambah Kategori"}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setIsEditing(false);
          setCurrentId(null);
          form.resetFields();
        }}
        okText="Simpan"
        cancelText="Batal"
        form={form}
        onFinish={handleAddOrEditCategory}
      >
        <Form.Item
          name="name"
          label="Nama Kategori"
          rules={[{ required: true, message: "Nama wajib diisi" }]}
        >
          <Input placeholder="Contoh: Bouquet, Aksesoris, Dekorasi" />
        </Form.Item>
        <Form.Item name="description" label="Deskripsi">
          <Input.TextArea placeholder="Deskripsi kategori jika perlu" />
        </Form.Item>
      </PageFormModal>
    </div>
  );
};

export default Categories;
