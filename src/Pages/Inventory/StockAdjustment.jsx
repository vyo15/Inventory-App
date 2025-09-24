// src/pages/Inventory/StockAdjustment.jsx

import React, { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";

import { Form, Select, InputNumber, Input, Button, message } from "antd";
import { updateStock, addInventoryLog } from "../../utils/stockService";

const { Option } = Select;

const StockAdjustment = () => {
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [itemType, setItemType] = useState("product");

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const [productsSnap, rawMaterialsSnap] = await Promise.all([
        getDocs(collection(db, "products")),
        getDocs(collection(db, "raw_materials")),
      ]);

      const productsList = productsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const rawMaterialsList = rawMaterialsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setProducts(productsList);
      setRawMaterials(rawMaterialsList);
    } catch (error) {
      console.error("Gagal mengambil data items:", error);
      message.error("Gagal mengambil data item");
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      let selectedItem;
      let collectionName;

      if (itemType === "product") {
        selectedItem = products.find((p) => p.id === values.itemId);
        collectionName = "products";
      } else {
        selectedItem = rawMaterials.find((m) => m.id === values.itemId);
        collectionName = "raw_materials";
      }

      if (!selectedItem) {
        throw new Error("Item yang dipilih tidak ditemukan.");
      }

      const adjustmentValue =
        values.adjustmentType === "Increase"
          ? Number(values.amount)
          : -Number(values.amount);

      await updateStock(values.itemId, adjustmentValue, collectionName);

      // Mengirimkan `reason` sebagai `note` di `addInventoryLog`
      await addInventoryLog(
        values.itemId,
        selectedItem.name,
        adjustmentValue,
        "stock_adjustment",
        collectionName,
        {
          note: values.reason, // <-- Perubahan di sini
          adjustmentType: values.adjustmentType,
        }
      );

      message.success("Penyesuaian stok berhasil disimpan");
      form.resetFields();
    } catch (error) {
      console.error("Error saat penyesuaian stok:", error);
      message.error("Gagal menyimpan penyesuaian stok: " + error.message);
    }
    setLoading(false);
  };

  const getItemsBasedOnType = () => {
    if (itemType === "product") {
      return products;
    } else {
      return rawMaterials;
    }
  };

  return (
    <div style={{ maxWidth: 500, margin: "auto", padding: 24 }}>
      <h2>Penyesuaian Stok</h2>
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Form.Item label="Tipe Item" initialValue="product">
          <Select onChange={(value) => setItemType(value)}>
            <Option value="product">Produk Jadi</Option>
            <Option value="raw_material">Bahan Baku</Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="Pilih Item"
          name="itemId"
          rules={[{ required: true, message: "Mohon pilih item!" }]}
        >
          <Select placeholder="Pilih item">
            {getItemsBasedOnType().map((item) => (
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
