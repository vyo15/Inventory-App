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
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase";
import dayjs from "dayjs";
import { updateStock } from "../../utils/updateStock";

const { Option } = Select;

const Productions = () => {
  const [productions, setProductions] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]); // Daftar khusus bahan baku dari koleksi 'materials'
  const [finishedProducts, setFinishedProducts] = useState([]); // Daftar khusus produk jadi dari koleksi 'products'
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    // Listener untuk koleksi productions (sinkronisasi real-time)
    const unsubscribeProductions = onSnapshot(
      collection(db, "productions"),
      (snapshot) => {
        const data = [];
        snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
        setProductions(data);
        setLoading(false);
      },
      (error) => {
        message.error("Gagal sinkronisasi data produksi");
        console.error("Error fetching productions:", error);
        setLoading(false);
      }
    );

    // Listener untuk koleksi materials (sinkronisasi real-time bahan baku)
    const unsubscribeMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        const data = [];
        snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
        setRawMaterials(data);
      },
      (error) => {
        message.error("Gagal sinkronisasi data bahan baku");
        console.error("Error fetching materials:", error);
      }
    );

    // Listener untuk koleksi products (sinkronisasi real-time produk jadi)
    const unsubscribeProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const data = [];
        snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
        setFinishedProducts(data);
      },
      (error) => {
        message.error("Gagal sinkronisasi data produk jadi");
        console.error("Error fetching finished products:", error);
      }
    );

    // Cleanup function untuk menghentikan semua listener saat komponen di-unmount
    return () => {
      unsubscribeProductions();
      unsubscribeMaterials();
      unsubscribeProducts();
    };
  }, []); // [] agar listener hanya berjalan sekali saat komponen dimuat

  // Simpan produksi (tambah / edit)
  const handleSaveProduction = async (values) => {
    try {
      const productionData = {
        ...values,
        date: values.date.format("YYYY-MM-DD"),
        // Tambahkan nama produk dan bahan baku agar mudah ditampilkan di tabel
        productResult: {
          ...values.productResult,
          name:
            finishedProducts.find(
              (p) => p.id === values.productResult.productId
            )?.name || "N/A",
        },
        materials: values.materials.map((mat) => ({
          ...mat,
          name: rawMaterials.find((p) => p.id === mat.productId)?.name || "N/A",
        })),
      };

      if (isEditing) {
        const docRef = doc(db, "productions", editingId);
        await updateDoc(docRef, productionData);
        message.success("Produksi berhasil diupdate");
      } else {
        await addDoc(collection(db, "productions"), productionData);
        message.success("Produksi berhasil ditambahkan");
      }

      // Perbarui stok bahan baku dari koleksi 'materials' menggunakan updateStock
      for (const material of values.materials) {
        await updateStock(
          material.productId,
          material.quantity,
          "stock_out_raw",
          { note: `Digunakan untuk produksi: ${values.name}` }
        );
      }

      // Perbarui stok produk jadi dari koleksi 'products' menggunakan updateStock
      if (values.productResult && values.productResult.productId) {
        await updateStock(
          values.productResult.productId,
          values.productResult.quantity,
          "stock_in",
          { note: `Hasil produksi: ${values.name}` }
        );
      }

      form.resetFields();
      setModalVisible(false);
      setIsEditing(false);
      setEditingId(null);
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
      title: "Produk Jadi",
      dataIndex: ["productResult", "name"],
      key: "productResultName",
      render: (text, record) => (
        <span>
          {record.productResult?.name} ({record.productResult?.quantity})
        </span>
      ),
    },
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
                      style={{ width: 200 }}
                    >
                      <Select placeholder="Pilih bahan baku">
                        {rawMaterials.map((p) => (
                          <Option key={p.id} value={p.id}>
                            {p.name} (stok: {p.stock || 0})
                          </Option>
                        ))}
                      </Select>
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
                <Select placeholder="Pilih produk jadi" style={{ width: 250 }}>
                  {finishedProducts.map((p) => (
                    <Option key={p.id} value={p.id}>
                      {p.name}
                    </Option>
                  ))}
                </Select>
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
