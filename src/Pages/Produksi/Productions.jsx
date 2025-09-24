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
import {
  collection,
  doc,
  onSnapshot,
  increment,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";
import dayjs from "dayjs";
import { PlusOutlined, EditOutlined } from "@ant-design/icons";
import {
  addInventoryLog,
  performProductionTransaction,
} from "../../utils/stockService";

const { Option } = Select;

const Productions = () => {
  const [productions, setProductions] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [finishedProducts, setFinishedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
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

    return () => {
      unsubscribeProductions();
      unsubscribeMaterials();
      unsubscribeProducts();
    };
  }, []);

  const handleSaveProduction = async (values) => {
    const productionData = {
      values,
      isEditing,
      editingId,
      productions,
      rawMaterials,
      finishedProducts,
    };

    const success = await performProductionTransaction(productionData);

    if (success) {
      const { productResult, materials, name, description } = values;

      // Ambil nama item dari daftar yang tersedia, bukan dari form
      const finishedProductName =
        finishedProducts.find((p) => p.id === productResult.productId)?.name ||
        "Produk tidak ditemukan";

      // Log untuk penambahan produk jadi
      await addInventoryLog(
        productResult.productId,
        finishedProductName,
        productResult.quantity,
        "production_in",
        "products",
        {
          note: `Hasil produksi: ${name || "N/A"} - ${description || "N/A"}`,
        }
      );

      // Log untuk pengurangan bahan baku
      for (const material of materials) {
        const rawMaterialName =
          rawMaterials.find((m) => m.id === material.productId)?.name ||
          "Bahan baku tidak ditemukan";

        await addInventoryLog(
          material.productId,
          rawMaterialName,
          -material.quantity,
          "production_out",
          "raw_materials",
          {
            note: `Bahan baku untuk produksi: ${name || "N/A"} - ${
              description || "N/A"
            }`,
          }
        );
      }

      message.success(
        `Produksi berhasil di${isEditing ? "update" : "tambahkan"}`
      );
      form.resetFields();
      setModalVisible(false);
      setIsEditing(false);
      setEditingId(null);
    } else {
      message.error("Gagal menyimpan produksi. Silakan coba lagi.");
    }
  };

  const handleDeleteProduction = async (id) => {
    const batch = writeBatch(db);
    try {
      const productionToDelete = productions.find((p) => p.id === id);
      if (!productionToDelete) {
        throw new Error("Data produksi tidak ditemukan.");
      }

      for (const material of productionToDelete.materials) {
        const materialRef = doc(db, "raw_materials", material.productId);
        batch.update(materialRef, { stock: increment(material.quantity) });
      }

      if (
        productionToDelete.productResult &&
        productionToDelete.productResult.productId
      ) {
        const productRef = doc(
          db,
          "products",
          productionToDelete.productResult.productId
        );
        batch.update(productRef, {
          stock: increment(-productionToDelete.productResult.quantity),
        });
      }

      const productionRef = doc(db, "productions", id);
      batch.delete(productionRef);

      await batch.commit();

      for (const material of productionToDelete.materials) {
        const rawMaterialName =
          rawMaterials.find((m) => m.id === material.productId)?.name ||
          "Bahan baku tidak ditemukan";

        await addInventoryLog(
          material.productId,
          rawMaterialName,
          material.quantity,
          "production_out_revert",
          "raw_materials",
          {
            note: `Pembatalan produksi: ${productionToDelete.name || "N/A"}`,
          }
        );
      }
      if (
        productionToDelete.productResult &&
        productionToDelete.productResult.productId
      ) {
        const finishedProductName =
          finishedProducts.find(
            (p) => p.id === productionToDelete.productResult.productId
          )?.name || "Produk tidak ditemukan";

        await addInventoryLog(
          productionToDelete.productResult.productId,
          finishedProductName,
          -productionToDelete.productResult.quantity,
          "production_in_revert",
          "products",
          {
            note: `Pembatalan produksi: ${productionToDelete.name || "N/A"}`,
          }
        );
      }

      message.success("Produksi berhasil dihapus");
    } catch (error) {
      message.error(`Gagal menghapus produksi: ${error.message}`);
      console.error(error);
    }
  };

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
        style={{ marginBottom: 16 }}
      >
        Tambah Produksi
      </Button>

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
    </div>
  );
};

export default Productions;
