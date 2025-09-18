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

const StockIn = () => {
  const [products, setProducts] = useState([]);
  const [stockIns, setStockIns] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchProducts();
    fetchStockIns();
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

  const fetchStockIns = async () => {
    try {
      const snap = await getDocs(collection(db, "stock_in"));
      setStockIns(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
      message.error("Gagal mengambil data stok masuk");
    }
  };

  const handleSubmit = async (values) => {
    try {
      await updateStock(values.productId, values.quantity, "stock_in", {
        supplier: values.supplier,
        price: values.price,
        note: values.note,
      });

      message.success("Stok masuk berhasil");
      setModalVisible(false);
      form.resetFields();
      fetchStockIns();
    } catch (error) {
      console.error(error);
      message.error("Gagal menambahkan stok masuk");
    }
  };

  const columns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      render: (val) => (val ? new Date(val).toLocaleString() : ""),
    },
    { title: "Produk", dataIndex: "itemName" },
    { title: "Jumlah", dataIndex: "quantity" },
    {
      title: "Harga",
      dataIndex: "price",
      render: (val) => (val != null ? `Rp ${val.toLocaleString()}` : "-"),
    },
    { title: "Supplier", dataIndex: "supplier" },
    { title: "Catatan", dataIndex: "note" },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>Stok Masuk</h2>
      <Button type="primary" onClick={() => setModalVisible(true)}>
        Tambah Stok Masuk
      </Button>
      <Table
        dataSource={stockIns}
        columns={columns}
        rowKey="id"
        style={{ marginTop: 20 }}
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
            name="productId"
            label="Produk"
            rules={[{ required: true, message: "Pilih produk!" }]}
          >
            <Select placeholder="Pilih produk">
              {products.map((product) => (
                <Option key={product.id} value={product.id}>
                  {product.name}
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
            name="price"
            label="Harga Satuan (Rp)"
            rules={[{ required: true, type: "number", min: 0 }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="supplier"
            label="Supplier"
            rules={[{ required: true, message: "Supplier wajib diisi!" }]}
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

export default StockIn;
