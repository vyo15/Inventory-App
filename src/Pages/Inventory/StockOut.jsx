import React, { useEffect, useState } from "react";
import {
  Form,
  Select,
  InputNumber,
  Input,
  Button,
  Modal,
  Table,
  message,
} from "antd";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../firebase";
import dayjs from "dayjs";

const { Option } = Select;

const StockOut = () => {
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [stockOuts, setStockOuts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [itemType, setItemType] = useState("product");

  useEffect(() => {
    // Listener real-time untuk products
    const unsubProducts = onSnapshot(collection(db, "products"), (snapshot) => {
      setProducts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // Listener real-time untuk raw_materials
    const unsubRawMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        setRawMaterials(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );

    // Listener real-time untuk stock_out
    const unsubStockOuts = onSnapshot(
      collection(db, "stock_out"),
      (snapshot) => {
        setStockOuts(
          snapshot.docs.map((d) => ({ id: d.id, ...d.data(), key: d.id }))
        );
      }
    );

    // Cleanup function
    return () => {
      unsubProducts();
      unsubRawMaterials();
      unsubStockOuts();
    };
  }, []);

  const handleSubmit = async (values) => {
    try {
      const { itemType, itemId, quantity, destination, note } = values;

      let selectedItem;
      let collectionName = "";
      if (itemType === "product") {
        selectedItem = products.find((p) => p.id === itemId);
        collectionName = "products";
      } else {
        selectedItem = rawMaterials.find((m) => m.id === itemId);
        collectionName = "raw_materials";
      }

      if (!selectedItem) {
        throw new Error("Item yang dipilih tidak ditemukan.");
      }

      // Pastikan stok mencukupi
      if ((selectedItem.stock || 0) < quantity) {
        message.error("Stok tidak mencukupi!");
        return;
      }

      // Tambahkan dokumen baru ke koleksi 'stock_out'
      await addDoc(collection(db, "stock_out"), {
        itemId,
        itemName: selectedItem.name, // Simpan nama item
        itemType, // Simpan tipe item
        quantity,
        destination: destination || "-",
        note: note || "-",
        date: new Date(),
      });

      // Perbarui stok di produk / bahan baku
      await updateDoc(doc(db, collectionName, itemId), {
        stock: (selectedItem.stock || 0) - Number(quantity),
      });

      message.success("Stok keluar berhasil dicatat");
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error(error);
      message.error("Gagal mencatat stok keluar: " + error.message);
    }
  };

  const columns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      render: (val) => {
        if (!val) return "";
        const dateObj = val.toDate ? val.toDate() : new Date(val);
        return dayjs(dateObj).format("DD-MM-YYYY HH:mm");
      },
    },
    {
      title: "Jenis Item",
      dataIndex: "itemType",
      render: (type) => (type === "product" ? "Produk Jadi" : "Bahan Baku"),
    },
    { title: "Item", dataIndex: "itemName" },
    { title: "Jumlah", dataIndex: "quantity" },
    { title: "Tujuan", dataIndex: "destination" },
    { title: "Catatan", dataIndex: "note" },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>Stok Keluar</h2>
      <Button type="primary" onClick={() => setModalVisible(true)}>
        Tambah Stok Keluar
      </Button>
      <Table
        dataSource={stockOuts}
        columns={columns}
        rowKey="id"
        style={{ marginTop: 20 }}
      />
      <Modal
        title="Tambah Stok Keluar"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="itemType"
            label="Tipe Item"
            initialValue="product"
            rules={[{ required: true, message: "Pilih tipe item!" }]}
          >
            <Select onChange={(value) => setItemType(value)}>
              <Option value="product">Produk Jadi</Option>
              <Option value="raw_material">Bahan Baku</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="itemId"
            label={itemType === "product" ? "Nama Produk" : "Nama Bahan Mentah"}
            rules={[{ required: true, message: "Pilih item!" }]}
          >
            <Select
              placeholder={`Pilih ${
                itemType === "product" ? "produk" : "bahan mentah"
              }`}
            >
              {itemType === "product"
                ? products.map((item) => (
                    <Option key={item.id} value={item.id}>
                      {item.name}
                    </Option>
                  ))
                : rawMaterials.map((item) => (
                    <Option key={item.id} value={item.id}>
                      {item.name}
                    </Option>
                  ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Jumlah"
            rules={[{ required: true, type: "number", min: 1 }]}
          >
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="destination"
            label="Tujuan"
            rules={[{ required: true, message: "Tujuan wajib diisi!" }]}
          >
            <Input />
          </Form.Item>

          <Form.Item name="note" label="Catatan">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StockOut;
