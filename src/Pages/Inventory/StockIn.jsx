import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  InputNumber,
  DatePicker,
  Input,
  message,
} from "antd";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebase";
import dayjs from "dayjs";

const { Option } = Select;

const StockIn = () => {
  const [form] = Form.useForm();
  const [stockIns, setStockIns] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Ambil data realtime
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "stock_in"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStockIns(data);
    });

    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        setMaterials(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );

    const unsubSuppliers = onSnapshot(
      collection(db, "supplierPurchases"),
      (snapshot) => {
        setSuppliers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );

    return () => {
      unsub();
      unsubProducts();
      unsubMaterials();
      unsubSuppliers();
    };
  }, []);

  const handleSubmit = async (values) => {
    try {
      const { type, itemId, quantity, date, note, supplierId } = values;

      // Cari nama item dan nama supplier dari ID yang dipilih
      let itemName = "";
      let supplierName = "";

      if (type === "product") {
        const product = products.find((p) => p.id === itemId);
        itemName = product?.name || "Produk tidak ditemukan";
      } else {
        const material = materials.find((m) => m.id === itemId);
        const supplier = suppliers.find((s) => s.id === supplierId);
        itemName = material?.name || "Bahan Baku tidak ditemukan";
        supplierName = supplier?.storeName || "Supplier tidak ditemukan";
      }

      // Simpan transaksi stok masuk dengan data yang lebih lengkap
      await addDoc(collection(db, "stock_in"), {
        type,
        itemId,
        itemName,
        supplierId: supplierId || null,
        supplierName: supplierName || "",
        quantity: Number(quantity),
        note: note || "",
        date: dayjs(date).format("YYYY-MM-DD"),
      });

      // Update stok di produk / material
      if (type === "product") {
        const product = products.find((p) => p.id === itemId);
        if (product) {
          await updateDoc(doc(db, "products", itemId), {
            stock: (product.stock || 0) + Number(quantity),
          });
        }
      } else {
        const material = materials.find((m) => m.id === itemId);
        if (material) {
          await updateDoc(doc(db, "raw_materials", itemId), {
            stock: (material.stock || 0) + Number(quantity),
          });
        }
      }

      message.success("Stok masuk berhasil ditambahkan & sinkron!");
      form.resetFields();
      setModalVisible(false);
    } catch (error) {
      console.error(error);
      message.error("Gagal menyimpan stok masuk");
    }
  };

  const columns = [
    { title: "Tanggal", dataIndex: "date" },
    {
      title: "Jenis",
      dataIndex: "type",
      render: (type) => (type === "product" ? "Produk" : "Bahan Baku"),
    },
    {
      title: "Nama Item",
      dataIndex: "itemName",
      key: "itemName",
    },
    {
      title: "Supplier",
      dataIndex: "supplierName",
      key: "supplierName",
      render: (text) => text || "-",
    },
    { title: "Jumlah", dataIndex: "quantity" },
    { title: "Catatan", dataIndex: "note" },
  ];

  return (
    <div>
      <h2>Stok Masuk</h2>
      <Button type="primary" onClick={() => setModalVisible(true)}>
        Tambah Stok Masuk
      </Button>

      <Table
        style={{ marginTop: 16 }}
        dataSource={stockIns}
        columns={columns}
        rowKey="id"
      />

      <Modal
        title="Tambah Stok Masuk"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="date"
            label="Tanggal"
            rules={[{ required: true, message: "Tanggal wajib diisi" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="type"
            label="Jenis Item"
            rules={[{ required: true, message: "Jenis wajib dipilih" }]}
          >
            <Select placeholder="Pilih jenis item">
              <Option value="product">Produk</Option>
              <Option value="material">Bahan Baku</Option>
            </Select>
          </Form.Item>

          <Form.Item
            shouldUpdate={(prev, curr) => prev.type !== curr.type}
            noStyle
          >
            {({ getFieldValue }) => {
              const type = getFieldValue("type");
              let list = type === "product" ? products : materials;

              return (
                <>
                  <Form.Item
                    name="itemId"
                    label="Nama Item"
                    rules={[{ required: true, message: "Item wajib dipilih" }]}
                  >
                    <Select placeholder="Pilih item">
                      {list.map((item) => (
                        <Option key={item.id} value={item.id}>
                          {item.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>

                  {type === "material" && (
                    <Form.Item
                      name="supplierId"
                      label="Nama Supplier"
                      rules={[
                        { required: true, message: "Supplier wajib dipilih" },
                      ]}
                    >
                      <Select placeholder="Pilih supplier">
                        {suppliers.map((item) => (
                          <Option key={item.id} value={item.id}>
                            {item.storeName}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  )}
                </>
              );
            }}
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Jumlah"
            rules={[{ required: true, message: "Jumlah wajib diisi" }]}
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="note" label="Catatan">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StockIn;
