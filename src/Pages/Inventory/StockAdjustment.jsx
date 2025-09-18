import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";

import { Form, Select, InputNumber, Input, Button, message } from "antd";
import { updateStock } from "../../utils/stockService";

const { Option } = Select;

const StockAdjustment = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // Fetch items saat pertama kali component load
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const snap = await getDocs(collection(db, "items"));
        const itemList = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setItems(itemList);
      } catch (error) {
        console.error("Gagal mengambil data items:", error);
        message.error("Gagal mengambil data item");
      }
    };

    fetchItems();
  }, []);

  // Saat submit form penyesuaian
  const onFinish = async (values) => {
    setLoading(true);
    try {
      const adjustmentValue =
        values.adjustmentType === "Increase"
          ? Number(values.amount)
          : -Number(values.amount);

      await updateStock(values.itemId, adjustmentValue, "stock_adjustments", {
        adjustmentType: values.adjustmentType,
        reason: values.reason,
      });

      message.success("Penyesuaian stok berhasil disimpan");
      form.resetFields();
    } catch (error) {
      console.error("Error saat penyesuaian stok:", error);
      message.error("Gagal menyimpan penyesuaian stok");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 500, margin: "auto", padding: 24 }}>
      <h2>Penyesuaian Stok</h2>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item
          label="Pilih Item"
          name="itemId"
          rules={[{ required: true, message: "Mohon pilih item!" }]}
        >
          <Select placeholder="Pilih item">
            {items.map((item) => (
              <Option key={item.id} value={item.id}>
                {item.name || "Nama tidak tersedia"}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="Tipe Penyesuaian"
          name="adjustmentType"
          rules={[{ required: true, message: "Mohon pilih tipe penyesuaian!" }]}
        >
          <Select placeholder="Pilih tipe penyesuaian">
            <Option value="Increase">Tambah</Option>
            <Option value="Decrease">Kurangi</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Jumlah"
          name="amount"
          rules={[{ required: true, message: "Mohon masukkan jumlah!" }]}
        >
          <InputNumber min={1} style={{ width: "100%" }} />
        </Form.Item>

        <Form.Item
          label="Alasan"
          name="reason"
          rules={[{ required: true, message: "Mohon isi alasan penyesuaian!" }]}
        >
          <Input placeholder="Misal: barang rusak, koreksi stok" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Simpan Penyesuaian
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default StockAdjustment;
