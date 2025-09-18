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
  const [rawMaterials, setRawMaterials] = useState([]); // State untuk bahan baku
  const [suppliers, setSuppliers] = useState([]); // State untuk supplier
  const [stockIns, setStockIns] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [itemType, setItemType] = useState("product"); // State untuk memilih tipe item

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
      message.error("Gagal mengambil data bahan baku");
    }
  };

  // Fungsi untuk mengambil data supplier
  const fetchSuppliers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "supplierPurchases"));
      const supplierNames = new Set();
      snapshot.forEach((doc) => {
        if (doc.data().storeName) {
          supplierNames.add(doc.data().storeName);
        }
      });
      setSuppliers(Array.from(supplierNames));
    } catch (error) {
      message.error("Gagal mengambil data supplier");
      console.error(error);
    }
  };

  const fetchStockIns = async () => {
    try {
      const snap = await getDocs(collection(db, "stock_in"));
      const stockInsData = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setStockIns(stockInsData);
    } catch (err) {
      console.error(err);
      message.error("Gagal mengambil data stok masuk");
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchRawMaterials();
    fetchSuppliers(); // Panggil fungsi untuk mengambil data supplier
    fetchStockIns();
  }, []);

  const handleSubmit = async (values) => {
    try {
      let selectedItem;
      let updateType;

      if (itemType === "product") {
        selectedItem = products.find((p) => p.id === values.itemId);
        updateType = "stock_in";
      } else {
        selectedItem = rawMaterials.find((m) => m.id === values.itemId);
        updateType = "stock_in_raw";
      }

      if (!selectedItem) {
        throw new Error("Item yang dipilih tidak ditemukan.");
      }

      await updateStock(values.itemId, values.quantity, updateType, {
        itemName: selectedItem.name,
        unit: selectedItem.unit,
        price: values.price,
        supplier: values.supplier,
        note: values.note,
      });

      message.success("Stok masuk berhasil ditambahkan");
      setModalVisible(false);
      form.resetFields();
      fetchStockIns();
      fetchProducts();
      fetchRawMaterials();
    } catch (error) {
      console.error(error);
      message.error("Gagal menambahkan stok masuk: " + error.message);
    }
  };

  const columns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      render: (val) => (val ? new Date(val).toLocaleString() : ""),
    },
    { title: "Nama Item", dataIndex: "itemName" },
    { title: "Jumlah", dataIndex: "quantity" },
    { title: "Satuan", dataIndex: "unit" },
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
            label={itemType === "product" ? "Nama Produk" : "Nama Bahan Baku"}
            rules={[{ required: true, message: "Pilih item!" }]}
          >
            <Select
              placeholder={`Pilih ${
                itemType === "product" ? "produk" : "bahan baku"
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
            name="price"
            label="Harga Total (Rp)"
            rules={[{ required: true, type: "number", min: 0 }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="supplier"
            label="Supplier"
            rules={[{ required: true, message: "Supplier wajib diisi!" }]}
          >
            <Select
              showSearch
              placeholder="Pilih atau cari supplier"
              optionFilterProp="children"
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {suppliers.map((supplier) => (
                <Option key={supplier} value={supplier}>
                  {supplier}
                </Option>
              ))}
            </Select>
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
