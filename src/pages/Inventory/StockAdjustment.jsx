import React, { useEffect, useMemo, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  InputNumber,
  Input,
  DatePicker,
  Tag,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import {
  collection,
  addDoc,
  onSnapshot,
  Timestamp,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";
import dayjs from "dayjs";
import { db } from "../../firebase";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import { addInventoryLog } from "../../services/Inventory/inventoryService";

const { Option } = Select;

// =========================
// SECTION: Stock Adjustment Page
// =========================
const StockAdjustments = () => {
  // =========================
  // SECTION: State
  // =========================
  const [stockAdjustmentRecords, setStockAdjustmentRecords] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [finishedProducts, setFinishedProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form] = Form.useForm();
  const selectedItemType = Form.useWatch("itemType", form);

  // =========================
  // SECTION: Live Data Subscription
  // =========================
  useEffect(() => {
    const unsubscribeAdjustments = onSnapshot(
      collection(db, "stock_adjustments"),
      (snapshot) => {
        const nextAdjustmentRecords = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setStockAdjustmentRecords(nextAdjustmentRecords);
      },
    );

    const unsubscribeRawMaterials = onSnapshot(
      collection(db, "raw_materials"),
      (snapshot) => {
        const nextRawMaterials = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setRawMaterials(nextRawMaterials);
      },
    );

    const unsubscribeFinishedProducts = onSnapshot(
      collection(db, "products"),
      (snapshot) => {
        const nextFinishedProducts = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setFinishedProducts(nextFinishedProducts);
      },
    );

    return () => {
      unsubscribeAdjustments();
      unsubscribeRawMaterials();
      unsubscribeFinishedProducts();
    };
  }, []);

  // =========================
  // SECTION: Modal Helpers
  // =========================
  const resetAdjustmentFormState = () => {
    form.resetFields();
    setIsModalOpen(false);
  };

  const openCreateAdjustmentModal = () => {
    form.resetFields();
    setIsModalOpen(true);
  };

  // =========================
  // SECTION: Save Stock Adjustment
  // =========================
  const handleSubmitStockAdjustment = async (values) => {
    try {
      const isRawMaterial = values.itemType === "raw_material";
      const sourceCollectionName = isRawMaterial ? "raw_materials" : "products";
      const sourceItems = isRawMaterial ? rawMaterials : finishedProducts;

      const selectedItem = sourceItems.find(
        (item) => item.id === values.itemId,
      );

      if (!selectedItem) {
        message.error("Item tidak ditemukan");
        return;
      }

      // RULE:
      // adjustmentType = in  => stok bertambah
      // adjustmentType = out => stok berkurang
      const adjustmentQuantity = Number(values.quantity || 0);
      const finalQuantityChange =
        values.adjustmentType === "out"
          ? -adjustmentQuantity
          : adjustmentQuantity;

      // =========================
      // SECTION: Update stok item
      // =========================
      await updateDoc(doc(db, sourceCollectionName, values.itemId), {
        stock: increment(finalQuantityChange),
      });

      // =========================
      // SECTION: Simpan record penyesuaian
      // =========================
      await addDoc(collection(db, "stock_adjustments"), {
        date: Timestamp.fromDate(values.date.toDate()),
        itemType: values.itemType,
        itemId: values.itemId,
        itemName: selectedItem.name,
        adjustmentType: values.adjustmentType,
        quantity: adjustmentQuantity,
        finalQuantity: finalQuantityChange,
        reason: values.reason || "",
        note: values.note || "",
        unit: selectedItem.stockUnit || selectedItem.unit || "",
        createdAt: Timestamp.now(),
      });

      // =========================
      // SECTION: Simpan inventory log
      // =========================
      await addInventoryLog(
        values.itemId,
        selectedItem.name,
        finalQuantityChange,
        "stock_adjustment",
        sourceCollectionName,
        {
          reason: values.reason || "",
          note: values.note || "",
        },
      );

      message.success("Penyesuaian stok berhasil disimpan");
      resetAdjustmentFormState();
    } catch (error) {
      console.error(error);
      message.error("Gagal menyimpan penyesuaian stok");
    }
  };

  // =========================
  // SECTION: Table Columns
  // =========================
  const stockAdjustmentColumns = useMemo(() => {
    return [
      {
        title: "Tanggal",
        dataIndex: "date",
        key: "date",
        render: (value) =>
          value?.toDate ? dayjs(value.toDate()).format("DD-MM-YYYY") : "-",
      },
      {
        title: "Jenis Item",
        dataIndex: "itemType",
        key: "itemType",
        render: (value) =>
          value === "raw_material" ? (
            <Tag color="gold">Bahan Baku</Tag>
          ) : (
            <Tag color="blue">Produk</Tag>
          ),
      },
      {
        title: "Nama Item",
        dataIndex: "itemName",
        key: "itemName",
      },
      {
        title: "Tipe Penyesuaian",
        dataIndex: "adjustmentType",
        key: "adjustmentType",
        render: (value) =>
          value === "in" ? (
            <Tag color="green">Tambah</Tag>
          ) : (
            <Tag color="red">Kurang</Tag>
          ),
      },
      {
        title: "Qty",
        key: "quantity",
        render: (_, record) => `${record.quantity} ${record.unit || ""}`,
      },
      {
        title: "Alasan",
        dataIndex: "reason",
        key: "reason",
        render: (value) => value || "-",
      },
      {
        title: "Catatan",
        dataIndex: "note",
        key: "note",
        render: (value) => value || "-",
      },
    ];
  }, []);

  // =========================
  // SECTION: Available Items By Type
  // =========================
  const availableItems =
    selectedItemType === "product" ? finishedProducts : rawMaterials;

  return (
    <>
      <PageHeader
        title="Penyesuaian Stok"
        subtitle="Catat perubahan stok manual untuk bahan baku maupun produk jadi dengan alasan yang jelas."
        actions={[
          {
            key: "add-stock-adjustment",
            type: "primary",
            icon: <PlusOutlined />,
            label: "Tambah Penyesuaian",
            onClick: openCreateAdjustmentModal,
          },
        ]}
      />

      <PageSection
        title="Riwayat Penyesuaian"
        subtitle="Semua penyesuaian stok akan memperbarui stok item dan tercatat di inventory log."
      >
        <Table
          rowKey="id"
          columns={stockAdjustmentColumns}
          dataSource={stockAdjustmentRecords}
        />
      </PageSection>

      <Modal
        title="Tambah Penyesuaian Stok"
        open={isModalOpen}
        onCancel={resetAdjustmentFormState}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmitStockAdjustment}
        >
          <Form.Item
            name="date"
            label="Tanggal"
            rules={[{ required: true, message: "Tanggal wajib diisi" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="itemType"
            label="Jenis Item"
            rules={[{ required: true, message: "Jenis item wajib dipilih" }]}
          >
            <Select placeholder="Pilih jenis item">
              <Option value="raw_material">Bahan Baku</Option>
              <Option value="product">Produk Jadi</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="itemId"
            label="Pilih Item"
            rules={[{ required: true, message: "Item wajib dipilih" }]}
          >
            <Select placeholder="Pilih item">
              {availableItems.map((item) => (
                <Option key={item.id} value={item.id}>
                  {item.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="adjustmentType"
            label="Tipe Penyesuaian"
            rules={[
              { required: true, message: "Tipe penyesuaian wajib dipilih" },
            ]}
          >
            <Select placeholder="Pilih tipe penyesuaian">
              <Option value="in">Tambah</Option>
              <Option value="out">Kurang</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="quantity"
            label="Jumlah"
            rules={[{ required: true, message: "Jumlah wajib diisi" }]}
          >
            <InputNumber min={0.01} step={0.01} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Alasan"
            rules={[{ required: true, message: "Alasan wajib diisi" }]}
          >
            <Select placeholder="Pilih alasan">
              <Option value="stok_awal">Stok Awal</Option>
              <Option value="opname">Selisih Opname</Option>
              <Option value="rusak">Barang Rusak</Option>
              <Option value="hilang">Barang Hilang</Option>
              <Option value="lainnya">Lainnya</Option>
            </Select>
          </Form.Item>

          <Form.Item name="note" label="Catatan">
            <Input.TextArea rows={3} placeholder="Catatan tambahan" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default StockAdjustments;
