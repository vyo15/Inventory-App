import React, { useEffect, useMemo, useState } from "react";
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
  Tag,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { collection, addDoc, onSnapshot, Timestamp } from "firebase/firestore";
import dayjs from "dayjs";
import { db } from "../../firebase";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import {
  updateStock,
  addInventoryLog,
} from "../../services/Inventory/inventoryService";

const { Option } = Select;

// =========================
// SECTION: Returns Page
// =========================
const Returns = () => {
  const [form] = Form.useForm();

  // =========================
  // SECTION: State utama
  // =========================
  const [returnRecords, setReturnRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItemType, setSelectedItemType] = useState("product");

  // =========================
  // SECTION: Semua item
  // =========================
  const allItems = useMemo(() => {
    return [...products, ...materials];
  }, [products, materials]);

  // =========================
  // SECTION: Live Data Subscription
  // =========================
  useEffect(() => {
    const unsubscribeReturns = onSnapshot(
      collection(db, "returns"),
      (snapshot) => {
        const nextReturnRecords = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setReturnRecords(nextReturnRecords);
      },
    );

    const unsubscribeProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const nextProducts = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setProducts(nextProducts);
      },
    );

    const unsubscribeMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        const nextMaterials = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setMaterials(nextMaterials);
      },
    );

    return () => {
      unsubscribeReturns();
      unsubscribeProducts();
      unsubscribeMaterials();
    };
  }, []);

  // =========================
  // SECTION: Modal Helpers
  // =========================
  const resetReturnFormState = () => {
    form.resetFields();
    setIsModalOpen(false);
    setSelectedItemType("product");
  };

  const openCreateReturnModal = () => {
    form.resetFields();
    setSelectedItemType("product");
    setIsModalOpen(true);
  };

  // =========================
  // SECTION: Submit Return
  // =========================
  const handleSubmitReturn = async (values) => {
    try {
      const { type, itemId, quantity, date, note } = values;
      const collectionName = type === "product" ? "products" : "raw_materials";

      const selectedItem = allItems.find((item) => item.id === itemId);
      const itemName = selectedItem?.name || "Item tidak ditemukan";

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
        { note: note || "" },
      );

      message.success("Retur berhasil ditambahkan!");
      resetReturnFormState();
    } catch (error) {
      console.error(error);
      message.error("Gagal menyimpan retur");
    }
  };

  // =========================
  // SECTION: Table Columns
  // =========================
  const returnTableColumns = [
    {
      title: "Tanggal",
      dataIndex: "date",
      key: "date",
      render: (value) =>
        value?.toDate ? dayjs(value.toDate()).format("DD-MM-YYYY HH:mm") : "-",
    },
    {
      title: "Jenis",
      dataIndex: "type",
      key: "type",
      render: (type) =>
        type === "product" ? (
          <Tag color="blue">Produk</Tag>
        ) : (
          <Tag color="gold">Bahan Baku</Tag>
        ),
    },
    {
      title: "Nama Item",
      dataIndex: "itemName",
      key: "itemName",
    },
    {
      title: "Jumlah",
      dataIndex: "quantity",
      key: "quantity",
    },
    {
      title: "Catatan",
      dataIndex: "note",
      key: "note",
      render: (value) => value || "-",
    },
  ];

  return (
    <>
      <PageHeader
        title="Retur"
        subtitle="Catat pengembalian item agar stok bertambah kembali dan riwayat inventaris tetap akurat."
        actions={[
          {
            key: "add-return",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Retur",
            onClick: openCreateReturnModal,
          },
        ]}
      />

      <PageSection
        title="Data Retur"
        subtitle="Setiap retur akan menambah stok item terkait dan tercatat di inventory log."
      >
        {/* =========================
            SECTION: tabel retur baseline global
            Fungsi:
            - menyamakan surface tabel retur dengan halaman ledger/simple action lain
            - retur tidak punya detail drawer, jadi tabel cukup fokus ke data inti tanpa aksi tambahan
            Status: aktif / final
        ========================= */}
        <Table
          className="app-data-table"
          dataSource={returnRecords}
          columns={returnTableColumns}
          rowKey="id"
          scroll={{ x: 920 }}
        />
      </PageSection>

      <Modal
        title="Tambah Retur"
        open={isModalOpen}
        onOk={form.submit}
        onCancel={resetReturnFormState}
        okText="Simpan"
        cancelText="Batal"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitReturn}>
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
              onChange={(value) => setSelectedItemType(value)}
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
              {selectedItemType === "product"
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
    </>
  );
};

export default Returns;
