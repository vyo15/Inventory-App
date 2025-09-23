// src/pages/Transaksi/Purchases.jsx

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
import { collection, addDoc, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../../firebase";
import dayjs from "dayjs";
import { updateStock, addInventoryLog } from "../../utils/stockService";
import { PlusOutlined } from "@ant-design/icons";

const { Option } = Select;

const Purchases = () => {
  const [form] = Form.useForm();
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  // --- Perbaikan: Menggunakan Form.useWatch untuk memantau nilai form
  const itemType = Form.useWatch("type", form);
  const itemId = Form.useWatch("itemId", form);
  const quantity = Form.useWatch("quantity", form);
  const purchasePrice = Form.useWatch("purchasePrice", form);

  // Menggabungkan produk dan bahan baku dalam satu array untuk pencarian
  const allItems = [...products, ...materials];

  useEffect(() => {
    const unsubPurchases = onSnapshot(
      collection(db, "purchases"),
      (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPurchases(data);
      }
    );

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
      unsubPurchases();
      unsubProducts();
      unsubMaterials();
      unsubSuppliers();
    };
  }, []);

  // --- Perbaikan: useEffect untuk mengisi harga otomatis
  useEffect(() => {
    let list = itemType === "product" ? products : materials;
    const selectedItem = list.find((item) => item.id === itemId);

    if (selectedItem) {
      form.setFieldsValue({ purchasePrice: selectedItem.price });
    } else {
      form.setFieldsValue({ purchasePrice: null });
    }
  }, [itemId, itemType, products, materials, form]);

  const handleSubmit = async (values) => {
    try {
      const { type, itemId, quantity, date, note, supplierId, purchasePrice } =
        values;
      let itemName = "";
      let supplierName = "";
      let collectionName = type === "product" ? "products" : "raw_materials";

      const selectedItem = allItems.find((item) => item.id === itemId);
      const selectedSupplier = suppliers.find((s) => s.id === supplierId);

      itemName = selectedItem?.name || "Item tidak ditemukan";
      supplierName = selectedSupplier?.storeName || "Supplier tidak ditemukan";

      const totalPrice = Number(quantity) * Number(purchasePrice);

      await addDoc(collection(db, "purchases"), {
        type,
        itemId,
        itemName,
        supplierId: supplierId || null,
        supplierName: supplierName || "",
        quantity: Number(quantity),
        purchasePrice: Number(purchasePrice),
        totalPrice: totalPrice,
        note: note || "",
        date: Timestamp.fromDate(date.toDate()),
      });

      await updateStock(itemId, Number(quantity), collectionName);
      await addInventoryLog(
        itemId,
        itemName,
        Number(quantity),
        "purchase_in",
        collectionName,
        {
          note: note || "",
          supplierName: supplierName || "",
          totalPrice: totalPrice,
        }
      );

      // --- Menambahkan log pengeluaran ke koleksi 'expenses'
      await addDoc(collection(db, "expenses"), {
        date: Timestamp.fromDate(date.toDate()),
        type: "Pembelian Bahan/Barang",
        description: `Pembelian ${itemName} dari ${supplierName}`,
        amount: totalPrice,
      });

      message.success("Pembelian berhasil ditambahkan!");
      form.resetFields();
      setModalVisible(false);
    } catch (error) {
      console.error(error);
      message.error("Gagal menyimpan pembelian");
    }
  };

  const columns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      render: (val) =>
        val?.toDate ? dayjs(val.toDate()).format("DD-MM-YYYY") : "-",
    },
    {
      title: "Jenis",
      dataIndex: "type",
      render: (type) => (type === "product" ? "Produk" : "Bahan Baku"),
    },
    { title: "Nama Item", dataIndex: "itemName", key: "itemName" },
    { title: "Supplier", dataIndex: "supplierName", key: "supplierName" },
    { title: "Jumlah", dataIndex: "quantity" },
    {
      title: "Harga Beli",
      dataIndex: "purchasePrice",
      render: (val) => `Rp ${Number(val).toLocaleString()}`,
    },
    {
      title: "Total Harga",
      dataIndex: "totalPrice",
      render: (val) => `Rp ${Number(val).toLocaleString()}`,
    },
    { title: "Catatan", dataIndex: "note" },
  ];

  return (
    <div>
      <h2>Pembelian</h2>
      <Button
        type="primary"
        onClick={() => {
          form.resetFields();
          form.setFieldsValue({ type: "product" });
          setModalVisible(true);
        }}
        icon={<PlusOutlined />}
      >
        Tambah Pembelian
      </Button>
      <Table
        style={{ marginTop: 16 }}
        dataSource={purchases}
        columns={columns}
        rowKey="id"
      />
      <Modal
        title="Tambah Pembelian"
        open={modalVisible}
        onOk={form.submit}
        onCancel={() => setModalVisible(false)}
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
            initialValue="product"
            rules={[{ required: true, message: "Jenis wajib dipilih" }]}
          >
            <Select placeholder="Pilih jenis item">
              <Option value="product">Produk</Option>
              <Option value="material">Bahan Baku</Option>
            </Select>
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => {
              const type = getFieldValue("type");
              const list = type === "product" ? products : materials;
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
          {/* --- Diperbarui: Menambahkan input harga pembelian */}
          <Form.Item
            name="purchasePrice"
            label="Harga Beli"
            rules={[{ required: true, message: "Harga beli wajib diisi" }]}
          >
            <InputNumber min={0} style={{ width: "100%" }} addonBefore="Rp" />
          </Form.Item>
          {/* --- Diperbarui: Menampilkan total harga secara real-time */}
          <Form.Item label="Total Harga">
            <InputNumber
              style={{ width: "100%" }}
              value={quantity * purchasePrice}
              readOnly
              addonBefore="Rp"
            />
          </Form.Item>
          <Form.Item name="note" label="Catatan">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Purchases;
