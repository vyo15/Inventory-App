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

const Supplier = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [form] = Form.useForm();

  // Fetch semua supplier
  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "suppliers"));
      const data = querySnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setSuppliers(data);
    } catch (error) {
      console.error("Gagal ambil data supplier:", error);
      message.error("Gagal mengambil data supplier.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Tambah atau update
  const handleAddOrEditSupplier = async (values) => {
    try {
      if (isEditing && currentId) {
        await updateDoc(doc(db, "suppliers", currentId), values);
        message.success("Supplier berhasil diubah!");
      } else {
        await addDoc(collection(db, "suppliers"), values);
        message.success("Supplier berhasil ditambahkan!");
      }
      form.resetFields();
      setIsModalVisible(false);
      setIsEditing(false);
      setCurrentId(null);
      fetchSuppliers();
    } catch (error) {
      console.error("Gagal simpan supplier:", error);
      message.error("Gagal menyimpan supplier.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "suppliers", id));
      message.success("Supplier dihapus");
      fetchSuppliers();
    } catch (error) {
      console.error("Gagal hapus supplier:", error);
      message.error("Gagal menghapus supplier");
    }
  };

  const handleEdit = (record) => {
    setIsEditing(true);
    setIsModalVisible(true);
    setCurrentId(record.id);
    form.setFieldsValue({
      name: record.name,
      contact: record.contact,
      address: record.address,
      note: record.note,
    });
  };

  const columns = [
    { title: "Nama Supplier", dataIndex: "name", key: "name" },
    { title: "Kontak", dataIndex: "contact", key: "contact" },
    { title: "Alamat", dataIndex: "address", key: "address" },
    { title: "Catatan", dataIndex: "note", key: "note" },
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
            title="Yakin hapus supplier ini?"
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
      <h2>Daftar Supplier</h2>

      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setIsModalVisible(true);
          setIsEditing(false);
          form.resetFields();
        }}
        style={{ marginBottom: 16 }}
      >
        Tambah Supplier
      </Button>

      <Table
        columns={columns}
        dataSource={suppliers}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={isEditing ? "Edit Supplier" : "Tambah Supplier"}
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
        <Form form={form} layout="vertical" onFinish={handleAddOrEditSupplier}>
          <Form.Item
            name="name"
            label="Nama Supplier"
            rules={[{ required: true, message: "Nama wajib diisi" }]}
          >
            <Input placeholder="Contoh: PT Sumber Makmur" />
          </Form.Item>
          <Form.Item
            name="contact"
            label="Kontak"
            rules={[{ required: true, message: "Kontak wajib diisi" }]}
          >
            <Input placeholder="Nomor HP / Email" />
          </Form.Item>
          <Form.Item name="address" label="Alamat">
            <Input.TextArea placeholder="Alamat lengkap" />
          </Form.Item>
          <Form.Item name="note" label="Catatan">
            <Input.TextArea placeholder="Catatan tambahan (opsional)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Supplier;
