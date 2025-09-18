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
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { updateStock } from "../../utils/stockService";

const { Option } = Select;

const StockOut = () => {
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [stockOuts, setStockOuts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [itemType, setItemType] = useState("product"); // State baru untuk tipe item

  useEffect(() => {
    fetchProducts();
    fetchRawMaterials();
    fetchStockOuts();
  }, []);

  const fetchProducts = async () => {
    try {
      const snap = await getDocs(collection(db, "products"));
      setProducts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
      message.error("Gagal mengambil data produk");
    }
  };

  const fetchRawMaterials = async () => {
    try {
      const snap = await getDocs(collection(db, "raw_materials"));
      setRawMaterials(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
      message.error("Gagal mengambil data bahan mentah");
    }
  };

  const fetchStockOuts = async () => {
    try {
      const snap = await getDocs(collection(db, "stock_out"));
      setStockOuts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
      message.error("Gagal mengambil data stok keluar");
    }
  };

  const handleSubmit = async (values) => {
    try {
      let selectedItem;
      let updateType;

      if (itemType === "product") {
        selectedItem = products.find((p) => p.id === values.itemId);
        updateType = "stock_out";
      } else {
        selectedItem = rawMaterials.find((m) => m.id === values.itemId);
        updateType = "stock_out_raw";
      }

      if (!selectedItem) {
        throw new Error("Item yang dipilih tidak ditemukan.");
      }

      await updateStock(values.itemId, values.quantity, updateType, {
        itemName: selectedItem.name,
        destination: values.destination,
        note: values.note,
      });

      message.success("Stok keluar berhasil dicatat");
      setModalVisible(false);
      form.resetFields();
      fetchProducts();
      fetchRawMaterials();
      fetchStockOuts();
    } catch (error) {
      console.error(error);
      message.error("Gagal mencatat stok keluar: " + error.message);
    }
  };

  const columns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      render: (val) => (val ? new Date(val).toLocaleString() : ""),
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
          <Form.Item name="itemType" label="Tipe Item" initialValue="product">
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
