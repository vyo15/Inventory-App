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
  Typography,
  DatePicker,
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
import dayjs from "dayjs";

const SupplierPurchases = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [form] = Form.useForm();

  // Renamed function for clarity
  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, "supplierPurchases"));
      const purchases = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Convert timestamp to Day.js object for the form
        purchaseDate: doc.data().purchaseDate
          ? dayjs(doc.data().purchaseDate)
          : null,
      }));
      setData(purchases);
      message.success("Data berhasil dimuat.");
    } catch (error) {
      console.error("Gagal mengambil data pembelian supplier:", error);
      message.error("Gagal mengambil data.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const handleAddOrEdit = async (values) => {
    try {
      // Convert Day.js object back to ISO string for Firestore
      const payload = {
        ...values,
        purchaseDate: values.purchaseDate
          ? values.purchaseDate.toISOString()
          : null,
      };

      if (isEditing && currentId) {
        await updateDoc(doc(db, "supplierPurchases", currentId), payload);
        message.success("Data berhasil diperbarui.");
      } else {
        await addDoc(collection(db, "supplierPurchases"), payload);
        message.success("Data berhasil ditambahkan.");
      }

      form.resetFields();
      setIsModalVisible(false);
      setIsEditing(false);
      setCurrentId(null);
      fetchPurchases();
    } catch (error) {
      console.error("Gagal menyimpan data:", error);
      message.error("Gagal menyimpan data.");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "supplierPurchases", id));
      message.success("Data berhasil dihapus.");
      fetchPurchases();
    } catch (error) {
      console.error("Gagal menghapus data:", error);
      message.error("Gagal menghapus data.");
    }
  };

  const handleEdit = (record) => {
    setIsEditing(true);
    setIsModalVisible(true);
    setCurrentId(record.id);
    // Set form fields with the Day.js object
    form.setFieldsValue({
      ...record,
    });
  };

  const columns = [
    { title: "Nama Bahan", dataIndex: "item", key: "item" },
    { title: "Toko", dataIndex: "storeName", key: "storeName" },
    {
      title: "Link",
      dataIndex: "storeLink",
      key: "storeLink",
      render: (text) =>
        text ? (
          <a href={text} target="_blank" rel="noopener noreferrer">
            Link Toko
          </a>
        ) : (
          "-"
        ),
    },
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
            title="Yakin hapus data ini?"
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
      <Typography.Title level={4} style={{ marginBottom: 16 }}>
        Data Pembelian Supplier
      </Typography.Title>

      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => {
          setIsModalVisible(true);
          setIsEditing(false);
          setCurrentId(null);
          form.resetFields();
        }}
        style={{ marginBottom: 16 }}
      >
        Tambah Pembelian
      </Button>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 5 }}
      />

      <Modal
        title={isEditing ? "Edit Pembelian" : "Tambah Pembelian"}
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
        <Form form={form} layout="vertical" onFinish={handleAddOrEdit}>
          <Form.Item
            name="item"
            label="Nama Bahan"
            rules={[{ required: true, message: "Wajib diisi" }]}
          >
            <Input placeholder="Contoh: Plastik Kemasan" />
          </Form.Item>

          <Form.Item
            name="storeName"
            label="Toko"
            rules={[{ required: true, message: "Wajib diisi" }]}
          >
            <Input placeholder="Contoh: Toko Plastik Online" />
          </Form.Item>

          <Form.Item name="storeLink" label="Link Toko">
            <Input placeholder="Contoh: https://tokopedia.com/toko" />
          </Form.Item>

          <Form.Item name="note" label="Catatan">
            <Input.TextArea placeholder="Contoh: warna merah, ukuran 20cm" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SupplierPurchases;
