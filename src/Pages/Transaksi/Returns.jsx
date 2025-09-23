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

const Returns = () => {
  const [form] = Form.useForm();
  const [returns, setReturns] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [itemType, setItemType] = useState("product");

  const allItems = [...products, ...materials];

  useEffect(() => {
    const unsubReturns = onSnapshot(collection(db, "returns"), (snapshot) => {
      const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setReturns(data);
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
    return () => {
      unsubReturns();
      unsubProducts();
      unsubMaterials();
    };
  }, []);

  const handleSubmit = async (values) => {
    try {
      const { type, itemId, quantity, date, note } = values;
      let itemName = "";
      let collectionName = type === "product" ? "products" : "raw_materials";

      const selectedItem = allItems.find((item) => item.id === itemId);
      itemName = selectedItem?.name || "Item tidak ditemukan";

      await addDoc(collection(db, "returns"), {
        type,
        itemId,
        itemName,
        quantity: Number(quantity),
        note: note || "",
        date: Timestamp.fromDate(date.toDate()),
      });

      await updateStock(itemId, Number(quantity), collectionName);

      await addInventoryLog(
        itemId,
        itemName,
        Number(quantity),
        "return_in",
        collectionName,
        { note: note || "" }
      );

      message.success("Retur berhasil ditambahkan!");
      form.resetFields();
      setModalVisible(false);
    } catch (error) {
      console.error(error);
      message.error("Gagal menyimpan retur");
    }
  };

  const columns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      render: (val) =>
        val?.toDate ? dayjs(val.toDate()).format("DD-MM-YYYY HH:mm") : "-",
    },
    {
      title: "Jenis",
      dataIndex: "type",
      render: (type) => (type === "product" ? "Produk" : "Bahan Baku"),
    },
    { title: "Nama Item", dataIndex: "itemName" },
    { title: "Jumlah", dataIndex: "quantity" },
    { title: "Catatan", dataIndex: "note" },
  ];

  return (
    <div>
      <h2>Retur</h2>
      <Button
        type="primary"
        onClick={() => setModalVisible(true)}
        icon={<PlusOutlined />}
      >
        Tambah Retur
      </Button>
      <Table
        style={{ marginTop: 16 }}
        dataSource={returns}
        columns={columns}
        rowKey="id"
      />
      <Modal
        title="Tambah Retur"
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
            rules={[{ required: true, message: "Jenis wajib dipilih" }]}
          >
            <Select
              placeholder="Pilih jenis item"
              onChange={(value) => setItemType(value)}
            >
              <Option value="product">Produk</Option>
              <Option value="material">Bahan Baku</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="itemId"
            label="Nama Item"
            rules={[{ required: true, message: "Item wajib dipilih" }]}
          >
            <Select placeholder="Pilih item">
              {itemType === "product"
                ? products.map((item) => (
                    <Option key={item.id} value={item.id}>
                      {item.name}
                    </Option>
                  ))
                : materials.map((item) => (
                    <Option key={item.id} value={item.id}>
                      {item.name}
                    </Option>
                  ))}
            </Select>
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

export default Returns;
