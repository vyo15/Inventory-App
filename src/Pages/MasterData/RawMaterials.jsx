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
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
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

const RawMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    setLoading(true);
    const unsubMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMaterials(data);
        setLoading(false);
      },
      (error) => {
        message.error("Gagal memuat bahan baku.");
        console.error("Error fetching materials: ", error);
        setLoading(false);
      }
    );

    const unsubSuppliers = onSnapshot(
      collection(db, "supplierPurchases"),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSuppliers(data);
      },
      (error) => {
        message.error("Gagal memuat supplier.");
        console.error("Error fetching suppliers: ", error);
      }
    );

    return () => {
      unsubMaterials();
      unsubSuppliers();
    };
  }, []);

  const handleSaveMaterial = async (values) => {
    try {
      const { supplierId, ...materialData } = values;

      let supplierName = null;
      let supplierLink = null;

      if (supplierId && supplierId !== null) {
        const selectedSupplier = suppliers.find((s) => s.id === supplierId);
        if (selectedSupplier) {
          // Mengambil nama toko dan link dari properti yang benar
          supplierName = selectedSupplier.storeName;
          supplierLink = selectedSupplier.storeLink;
        }
      }

      const finalData = {
        ...materialData,
        category: "Bahan Baku",
        supplierId: supplierId || null,
        supplierName: supplierName || null,
        supplierLink: supplierLink || null,
        stock: materialData.stock || 0,
      };

      if (isEditing) {
        const docRef = doc(db, "raw_materials", editingId);
        await updateDoc(docRef, finalData);
        message.success("Bahan baku berhasil diupdate!");
      } else {
        await addDoc(collection(db, "raw_materials"), finalData);
        message.success("Bahan baku berhasil ditambahkan!");
      }

      form.resetFields();
      setModalVisible(false);
      setIsEditing(false);
      setEditingId(null);
    } catch (error) {
      message.error("Gagal menyimpan bahan baku.");
      console.error(error);
    }
  };

  const handleDeleteMaterial = async (id) => {
    try {
      await deleteDoc(doc(db, "raw_materials", id));
      message.success("Bahan baku berhasil dihapus!");
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
      supplierId: record.supplierId || null,
    });
  };

  const columns = [
    { title: "Nama Bahan Baku", dataIndex: "name", key: "name" },
    { title: "Kategori", dataIndex: "category", key: "category" },
    { title: "Satuan", dataIndex: "unit", key: "unit" },

    { title: "Stok", dataIndex: "stock", key: "stock" },

    {
      title: "Harga Satuan",
      dataIndex: "price",
      key: "price",
      render: (text) => `Rp ${Number(text).toLocaleString("id-ID")}`,
    },
    {
      title: "Supplier",
      dataIndex: "supplierLink",
      key: "supplierLink",
      render: (text, record) =>
        text ? (
          <a href={text} target="_blank" rel="noopener noreferrer">
            {record.supplierName || "Link Toko"} {/* <--- Perbaikan di sini */}
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
            type="link"
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
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
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
            name="supplierId"
            label="Supplier"
            rules={[{ required: true, message: "Supplier wajib diisi" }]}
          >
            <Select placeholder="Pilih supplier">
              {suppliers.map((supplier) => (
                <Option key={supplier.id} value={supplier.id}>
                  {supplier.item} - {supplier.storeName}
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
              <Option value="roll">Roll</Option>
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
        </Form>
      </Modal>
    </div>
  );
};

export default RawMaterials;
