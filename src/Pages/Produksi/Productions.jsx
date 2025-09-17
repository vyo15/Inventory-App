import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Select,
  Space,
  Popconfirm,
  message,
  InputNumber,
} from "antd";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import dayjs from "dayjs";

const { Option } = Select;

const Productions = () => {
  const [productions, setProductions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  // Ambil daftar produksi
  const fetchProductions = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "productions"));
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setProductions(data);
    } catch (error) {
      message.error("Gagal mengambil data produksi");
      console.error(error);
    }
    setLoading(false);
  };

  // Ambil daftar produk untuk bahan baku dan produk jadi
  const fetchProducts = async () => {
    try {
      const snapshot = await getDocs(collection(db, "products"));
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setProducts(data);
    } catch (error) {
      message.error("Gagal mengambil data produk");
      console.error(error);
    }
  };

  useEffect(() => {
    fetchProductions();
    fetchProducts();
  }, []);

  // Simpan produksi (tambah / edit)
  const handleSaveProduction = async (values) => {
    try {
      const productionData = {
        ...values,
        date: values.date.format("YYYY-MM-DD"),
      };

      if (isEditing) {
        // Update dokumen produksi
        const docRef = doc(db, "productions", editingId);
        await updateDoc(docRef, productionData);
        message.success("Produksi berhasil diupdate");
      } else {
        // Tambah dokumen produksi baru
        await addDoc(collection(db, "productions"), productionData);
        message.success("Produksi berhasil ditambahkan");
      }

      // Update stok bahan baku (kurangi)
      for (const material of productionData.materials) {
        const productRef = doc(db, "products", material.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const currentStock = productSnap.data().stock || 0;
          const newStock = currentStock - material.quantity;
          if (newStock < 0) {
            message.error(
              `Stok bahan baku ${material.name} tidak cukup (stok: ${currentStock})`
            );
            // Bisa batalkan transaksi / rollback di sini jika perlu
            return;
          }
          await updateDoc(productRef, { stock: newStock });
        }
      }

      // Update stok produk jadi (tambah)
      if (productionData.productResult) {
        const prodRes = productionData.productResult;
        if (prodRes.productId) {
          const prodResRef = doc(db, "products", prodRes.productId);
          const prodResSnap = await getDoc(prodResRef);
          if (prodResSnap.exists()) {
            const currentStock = prodResSnap.data().stock || 0;
            await updateDoc(prodResRef, {
              stock: currentStock + prodRes.quantity,
            });
          }
        }
      }

      form.resetFields();
      setModalVisible(false);
      setIsEditing(false);
      setEditingId(null);
      fetchProductions();
      fetchProducts();
    } catch (error) {
      message.error("Gagal menyimpan produksi");
      console.error(error);
    }
  };

  // Hapus produksi
  const handleDeleteProduction = async (id) => {
    try {
      await deleteDoc(doc(db, "productions", id));
      message.success("Produksi berhasil dihapus");
      fetchProductions();
    } catch (error) {
      message.error("Gagal menghapus produksi");
      console.error(error);
    }
  };

  // Edit produksi (isi form)
  const handleEditProduction = (record) => {
    setIsEditing(true);
    setModalVisible(true);
    setEditingId(record.id);

    form.setFieldsValue({
      name: record.name,
      description: record.description,
      date: dayjs(record.date, "YYYY-MM-DD"),
      status: record.status,
      materials: record.materials || [],
      productResult: record.productResult || {},
    });
  };

  const columns = [
    { title: "Nama Produksi", dataIndex: "name", key: "name" },
    { title: "Deskripsi", dataIndex: "description", key: "description" },
    { title: "Tanggal", dataIndex: "date", key: "date" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        let color = "gray";
        if (status === "completed") color = "green";
        else if (status === "pending") color = "orange";
        return (
          <span style={{ color }}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      },
    },
    {
      title: "Aksi",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEditProduction(record)}
          >
            Edit
          </Button>
          <Popconfirm
            title="Yakin hapus produksi ini?"
            onConfirm={() => handleDeleteProduction(record.id)}
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
      <h2>Daftar Produksi</h2>

      <Table
        columns={columns}
        dataSource={productions}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={isEditing ? "Edit Produksi" : "Tambah Produksi"}
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
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveProduction}
          initialValues={{
            status: "pending",
            materials: [],
            productResult: {},
          }}
        >
          <Form.Item
            name="name"
            label="Nama Produksi"
            rules={[{ required: true, message: "Nama produksi wajib diisi" }]}
          >
            <Input placeholder="Contoh: Produksi Batch #1" />
          </Form.Item>

          <Form.Item name="description" label="Deskripsi">
            <Input.TextArea placeholder="Deskripsi produksi (opsional)" />
          </Form.Item>

          <Form.Item
            name="date"
            label="Tanggal Produksi"
            rules={[{ required: true, message: "Tanggal wajib diisi" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="status"
            label="Status Produksi"
            rules={[{ required: true, message: "Status wajib diisi" }]}
          >
            <Select>
              <Option value="pending">Pending</Option>
              <Option value="completed">Completed</Option>
            </Select>
          </Form.Item>

          {/* Input Dinamis Bahan Baku */}
          <Form.List name="materials">
            {(fields, { add, remove }) => (
              <>
                <label>Bahan Baku</label>
                {fields.map(({ key, name, ...restField }) => (
                  <Space
                    key={key}
                    style={{ display: "flex", marginBottom: 8 }}
                    align="baseline"
                  >
                    <Form.Item
                      {...restField}
                      name={[name, "productId"]}
                      rules={[{ required: true, message: "Pilih bahan baku" }]}
                    >
                      <Select
                        placeholder="Pilih bahan baku"
                        style={{ width: 200 }}
                        options={products.map((p) => ({
                          label: `${p.name} (stok: ${p.stock || 0})`,
                          value: p.id,
                        }))}
                        // onChange={(value, option) => {
                        //   // Bisa handle auto-set nama bahan baku jika perlu
                        // }}
                      />
                    </Form.Item>

                    <Form.Item
                      {...restField}
                      name={[name, "quantity"]}
                      rules={[{ required: true, message: "Masukkan jumlah" }]}
                    >
                      <InputNumber min={1} placeholder="Jumlah" />
                    </Form.Item>

                    <Button danger onClick={() => remove(name)}>
                      Hapus
                    </Button>
                  </Space>
                ))}

                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    Tambah Bahan Baku
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          {/* Produk Jadi */}
          <Form.Item label="Produk Jadi" style={{ marginTop: 16 }}>
            <Space>
              <Form.Item
                name={["productResult", "productId"]}
                rules={[{ required: true, message: "Pilih produk jadi" }]}
                noStyle
              >
                <Select
                  placeholder="Pilih produk jadi"
                  style={{ width: 250 }}
                  options={products.map((p) => ({
                    label: p.name,
                    value: p.id,
                  }))}
                />
              </Form.Item>

              <Form.Item
                name={["productResult", "quantity"]}
                rules={[{ required: true, message: "Masukkan jumlah" }]}
                noStyle
              >
                <InputNumber min={1} placeholder="Jumlah" />
              </Form.Item>
            </Space>
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
          form.setFieldsValue({
            status: "pending",
            materials: [],
            productResult: {},
          });
        }}
        style={{ marginTop: 16 }}
      >
        Tambah Produksi
      </Button>
    </div>
  );
};

export default Productions;
