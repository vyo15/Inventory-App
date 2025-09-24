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

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [form] = Form.useForm();

  // Fetch semua customer
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "Customers"));
      const data = querySnapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setCustomers(data);
    } catch (error) {
      console.error("Gagal ambil data customer:", error);
      message.error("Gagal mengambil data customer.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Tambah atau update
  const handleAddOrEditCustomer = async (values) => {
    try {
      if (isEditing && currentId) {
        await updateDoc(doc(db, "customers", currentId), values);
        message.success("Customer berhasil diubah!");
      } else {
        await addDoc(collection(db, "customers"), values);
        message.success("Customer berhasil ditambahkan!");
      }
      form.resetFields();
      setIsModalVisible(false);
      setIsEditing(false);
      setCurrentId(null);
      fetchCustomers();
    } catch (error) {
      console.error("Gagal simpan customer:", error);
      message.error("Gagal menyimpan customer.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "customers", id));
      message.success("Customer dihapus");
      fetchCustomers();
    } catch (error) {
      console.error("Gagal hapus customer:", error);
      message.error("Gagal menghapus customer");
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
    { title: "Nama Customer", dataIndex: "name", key: "name" },
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
            title="Yakin hapus customer ini?"
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
      <h2>Daftar Customer</h2>

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
        Tambah Customer
      </Button>

      <Table
        columns={columns}
        dataSource={customers}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={isEditing ? "Edit Customer" : "Tambah Customer"}
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
        <Form form={form} layout="vertical" onFinish={handleAddOrEditCustomer}>
          <Form.Item
            name="name"
            label="Nama Customer"
            rules={[{ required: true, message: "Nama wajib diisi" }]}
          >
            <Input placeholder="Contoh: Budi Santoso" />
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

export default Customers;
