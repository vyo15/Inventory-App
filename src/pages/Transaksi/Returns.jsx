import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Table,
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
  addInventoryLog,
  updateInventoryStock,
} from "../../services/Inventory/inventoryService";
import {
  buildVariantOptionsFromItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
} from "../../utils/variants/variantStockHelpers";
import { formatNumberId } from "../../utils/formatters/numberId";

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

  const selectedItemId = Form.useWatch("itemId", form);
  const selectedVariantKey = Form.useWatch("variantKey", form);

  // =========================
  // SECTION: Semua item
  // =========================
  const allItems = useMemo(() => {
    return [...products, ...materials];
  }, [products, materials]);

  const selectedItemsByType = selectedItemType === "product" ? products : materials;
  const selectedItem = useMemo(
    () => selectedItemsByType.find((item) => item.id === selectedItemId) || null,
    [selectedItemId, selectedItemsByType],
  );
  const selectedItemHasVariants = inferHasVariants(selectedItem || {});
  const variantOptions = useMemo(
    () => (selectedItemHasVariants ? buildVariantOptionsFromItem(selectedItem) : []),
    [selectedItem, selectedItemHasVariants],
  );
  const selectedVariant = useMemo(
    () => (selectedItemHasVariants ? findVariantByKey(selectedItem, selectedVariantKey) : null),
    [selectedItem, selectedItemHasVariants, selectedVariantKey],
  );

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

  useEffect(() => {
    form.setFieldsValue({ itemId: undefined, variantKey: undefined });
  }, [form, selectedItemType]);

  useEffect(() => {
    form.setFieldsValue({ variantKey: undefined });
  }, [form, selectedItemId]);

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
    form.setFieldsValue({ date: dayjs(), type: "product" });
    setSelectedItemType("product");
    setIsModalOpen(true);
  };

  // =========================
  // SECTION: Submit Return
  // =========================
  const handleSubmitReturn = async (values) => {
    try {
      const { type, itemId, quantity, date, note, variantKey } = values;
      const collectionName = type === "product" ? "products" : "raw_materials";

      const item = allItems.find((sourceItem) => sourceItem.id === itemId);
      const itemName = item?.name || "Item tidak ditemukan";

      if (!item) {
        message.error("Item tidak ditemukan");
        return;
      }

      if (inferHasVariants(item) && !variantKey) {
        message.error("Pilih varian item terlebih dahulu agar retur masuk ke stok varian yang benar.");
        return;
      }

      // =========================
      // SECTION: Mutasi stok retur final
      // Source of truth variant berasal dari form variantKey; helper final menjaga variants[] dan aggregate stock sinkron.
      // =========================
      const stockMutationResult = await updateInventoryStock({
        itemId,
        collectionName,
        quantityChange: Number(quantity),
        variantKey: variantKey || "",
        itemSnapshot: item,
      });

      const variantPayload = {
        variantKey: stockMutationResult.variantKey,
        variantLabel: stockMutationResult.variantLabel,
        stockSourceType: stockMutationResult.stockSourceType,
      };

      const returnDocument = await addDoc(collection(db, "returns"), {
        type,
        itemId,
        itemName,
        quantity: Number(quantity),
        note: note || "",
        date: Timestamp.fromDate(date.toDate()),
        ...variantPayload,
      });

      await addInventoryLog(
        itemId,
        itemName,
        Number(quantity),
        "return_in",
        collectionName,
        {
          // ACTIVE: reference retur membuat inventory log bisa ditelusuri dari Stock Management.
          returnId: returnDocument.id,
          referenceId: returnDocument.id,
          referenceType: "return",
          note: note || "",
          ...variantPayload,
        },
      );

      message.success("Retur berhasil ditambahkan!");
      resetReturnFormState();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyimpan retur");
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
      title: "Varian / Sumber",
      key: "variant",
      render: (_, record) =>
        record.variantLabel || record.variantKey ? (
          <Tag color="purple">{record.variantLabel || record.variantKey}</Tag>
        ) : (
          <Tag>Master</Tag>
        ),
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
        subtitle="Catat pengembalian item agar stok master/varian bertambah kembali dan riwayat inventaris tetap akurat."
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
        subtitle="Setiap retur memakai helper stok variant-aware dan mencatat variantKey/variantLabel pada inventory log."
      >
        {/* =========================
            SECTION: tabel retur baseline global
            Fungsi:
            - retur tidak punya detail drawer, jadi tabel cukup fokus ke data inti tanpa aksi tambahan
            - kolom varian memakai schema final dari record retur/log
            Status: aktif / final
        ========================= */}
        <Table
          className="app-data-table"
          dataSource={returnRecords}
          columns={returnTableColumns}
          rowKey="id"
          scroll={{ x: 980 }}
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
            <Select placeholder="Pilih item" showSearch optionFilterProp="children">
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

          {selectedItemHasVariants ? (
            <Form.Item
              name="variantKey"
              label={selectedItem?.variantLabel || "Varian"}
              rules={[{ required: true, message: "Varian wajib dipilih" }]}
              extra="Item ini bervarian. Retur harus masuk ke varian yang dipilih, bukan master/default."
            >
              <Select placeholder="Pilih varian" showSearch optionFilterProp="children">
                {variantOptions.map((item) => (
                  <Option key={item.value} value={item.value}>
                    {item.label} - Stok: {formatNumberId(item.raw?.currentStock || 0)}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : null}

          {selectedItem ? (
            <Alert
              showIcon
              type={selectedItemHasVariants ? "info" : "success"}
              style={{ marginBottom: 16 }}
              message={
                selectedItemHasVariants
                  ? `Stok varian terpilih: ${formatNumberId(selectedVariant?.currentStock || 0)}`
                  : `Stok master saat ini: ${formatNumberId(getItemStockSnapshot(selectedItem).currentStock)}`
              }
            />
          ) : null}

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
