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
  const [items, setItems] = useState([]);
  const [stockOuts, setStockOuts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchItems();
    fetchStockOuts();
  }, []);

  const fetchItems = async () => {
    try {
      const snap = await getDocs(collection(db, "items"));
      setItems(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
      message.error("Gagal mengambil data items");
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
      await updateStock(values.itemId, values.quantity, "stock_out", {
        destination: values.destination,
        note: values.note,
      });

      message.success("Stok keluar berhasil");
      setModalVisible(false);
      form.resetFields();
      fetchStockOuts();
    } catch (error) {
      console.error(error);
      message.error("Gagal mencatat stok keluar");
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
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="itemId"
            label="Item"
            rules={[{ required: true, message: "Pilih item!" }]}
          >
            <Select placeholder="Pilih item">
              {items.map((item) => (
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
