import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Table,
  Modal,
  Form,
  Select,
  InputNumber,
  Input,
  DatePicker,
  Tag,
  message,
  Typography,
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
const { Text } = Typography;

const ITEM_TYPE_META = {
  raw_material: {
    label: "Bahan Baku",
    color: "gold",
    collectionName: "raw_materials",
  },
  product: {
    label: "Produk Jadi",
    color: "blue",
    collectionName: "products",
  },
  semi_finished_material: {
    label: "Bahan Setengah Jadi",
    color: "purple",
    collectionName: "semi_finished_materials",
  },
};

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
  const [semiFinishedMaterials, setSemiFinishedMaterials] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form] = Form.useForm();
  const selectedItemType = Form.useWatch("itemType", form);
  const selectedItemId = Form.useWatch("itemId", form);
  const selectedVariantKey = Form.useWatch("variantKey", form);

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

    const unsubscribeSemiFinished = onSnapshot(
      collection(db, "semi_finished_materials"),
      (snapshot) => {
        const nextSemiFinished = snapshot.docs.map((documentItem) => ({
          id: documentItem.id,
          ...documentItem.data(),
        }));

        setSemiFinishedMaterials(nextSemiFinished);
      },
    );

    return () => {
      unsubscribeAdjustments();
      unsubscribeRawMaterials();
      unsubscribeFinishedProducts();
      unsubscribeSemiFinished();
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
    form.setFieldsValue({
      date: dayjs(),
      itemType: "raw_material",
    });
    setIsModalOpen(true);
  };

  // =========================
  // SECTION: Available Items By Type
  // =========================
  const availableItems = useMemo(() => {
    if (selectedItemType === "product") return finishedProducts;
    if (selectedItemType === "semi_finished_material") return semiFinishedMaterials;
    return rawMaterials;
  }, [finishedProducts, rawMaterials, selectedItemType, semiFinishedMaterials]);

  const selectedItem = useMemo(
    () => availableItems.find((item) => item.id === selectedItemId) || null,
    [availableItems, selectedItemId],
  );

  const selectedItemHasVariants = inferHasVariants(selectedItem || {});

  const selectedVariant = useMemo(
    () => (selectedItemHasVariants ? findVariantByKey(selectedItem, selectedVariantKey) : null),
    [selectedItem, selectedItemHasVariants, selectedVariantKey],
  );

  const variantOptions = useMemo(
    () => (selectedItemHasVariants ? buildVariantOptionsFromItem(selectedItem) : []),
    [selectedItem, selectedItemHasVariants],
  );

  const stockPreview = selectedVariant
    ? selectedVariant.currentStock
    : selectedItem
      ? getItemStockSnapshot(selectedItem).currentStock
      : 0;

  // =========================
  // SECTION: Reset field turunan saat item/type berubah
  // ACTIVE / FINAL:
  // - item bervarian wajib memilih variantKey baru dari item tersebut
  // - reset ini mencegah variant dari item sebelumnya ikut tersubmit diam-diam
  // =========================
  useEffect(() => {
    form.setFieldsValue({ itemId: undefined, variantKey: undefined });
  }, [form, selectedItemType]);

  useEffect(() => {
    form.setFieldsValue({ variantKey: undefined });
  }, [form, selectedItemId]);

  // =========================
  // SECTION: Save Stock Adjustment
  // =========================
  const handleSubmitStockAdjustment = async (values) => {
    try {
      const itemTypeMeta = ITEM_TYPE_META[values.itemType] || ITEM_TYPE_META.raw_material;
      const sourceCollectionName = itemTypeMeta.collectionName;
      const sourceItems =
        values.itemType === "product"
          ? finishedProducts
          : values.itemType === "semi_finished_material"
            ? semiFinishedMaterials
            : rawMaterials;

      const item = sourceItems.find((sourceItem) => sourceItem.id === values.itemId);

      if (!item) {
        message.error("Item tidak ditemukan");
        return;
      }

      if (inferHasVariants(item) && !values.variantKey) {
        message.error("Item ini memiliki varian. Pilih varian sebelum menyimpan penyesuaian stok.");
        return;
      }

      // RULE:
      // adjustmentType = in  => stok bertambah
      // adjustmentType = out => stok berkurang
      const adjustmentQuantity = Number(values.quantity || 0);
      const finalQuantityChange =
        values.adjustmentType === "out" ? -adjustmentQuantity : adjustmentQuantity;

      // =========================
      // SECTION: Mutasi stok variant-aware final
      // Source of truth varian berasal dari form variantKey jika item bervarian.
      // Helper final menjaga variants[], currentStock, stock, reservedStock, dan availableStock tetap sinkron.
      // =========================
      const stockMutationResult = await updateInventoryStock({
        itemId: values.itemId,
        collectionName: sourceCollectionName,
        quantityChange: finalQuantityChange,
        variantKey: values.variantKey || "",
        itemSnapshot: item,
        preventNegative: values.adjustmentType === "out",
      });

      const variantPayload = {
        variantKey: stockMutationResult.variantKey,
        variantLabel: stockMutationResult.variantLabel,
        stockSourceType: stockMutationResult.stockSourceType,
      };

      // =========================
      // SECTION: Simpan record penyesuaian
      // ACTIVE / FINAL:
      // - record adjustment menyimpan contract variant final agar audit tidak perlu menebak dari master item.
      // =========================
      await addDoc(collection(db, "stock_adjustments"), {
        date: Timestamp.fromDate(values.date.toDate()),
        itemType: values.itemType,
        itemId: values.itemId,
        itemName: item.name,
        adjustmentType: values.adjustmentType,
        quantity: adjustmentQuantity,
        finalQuantity: finalQuantityChange,
        reason: values.reason || "",
        note: values.note || "",
        unit: item.stockUnit || item.unit || "",
        ...variantPayload,
        createdAt: Timestamp.now(),
      });

      // =========================
      // SECTION: Simpan inventory log final
      // Source of truth display audit memakai variantKey / variantLabel / stockSourceType di root log.
      // =========================
      await addInventoryLog(
        values.itemId,
        item.name,
        finalQuantityChange,
        "stock_adjustment",
        sourceCollectionName,
        {
          reason: values.reason || "",
          note: values.note || "",
          ...variantPayload,
        },
      );

      message.success("Penyesuaian stok berhasil disimpan");
      resetAdjustmentFormState();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyimpan penyesuaian stok");
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
        render: (value) => {
          const meta = ITEM_TYPE_META[value] || ITEM_TYPE_META.raw_material;
          return <Tag color={meta.color}>{meta.label}</Tag>;
        },
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
        render: (_, record) => `${formatNumberId(record.quantity)} ${record.unit || ""}`,
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

  return (
    <>
      <PageHeader
        title="Penyesuaian Stok"
        subtitle="Catat perubahan stok manual untuk bahan baku, produk jadi, dan bahan setengah jadi dengan variant-aware stock mutation."
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
        subtitle="Semua penyesuaian stok memperbarui stok item/varian dan tercatat di inventory log final."
      >
        {/* =========================
            SECTION: tabel penyesuaian stok baseline global
            Fungsi:
            - menjaga surface audit adjustment tetap seragam
            - kolom varian membaca field final variantKey/variantLabel, bukan fallback lama
            Status: aktif / final
        ========================= */}
        <Table
          className="app-data-table"
          rowKey="id"
          columns={stockAdjustmentColumns}
          dataSource={stockAdjustmentRecords}
          scroll={{ x: 1200 }}
        />
      </PageSection>

      <Modal
        title="Tambah Penyesuaian Stok"
        open={isModalOpen}
        onCancel={resetAdjustmentFormState}
        onOk={() => form.submit()}
        okText="Simpan"
        cancelText="Batal"
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitStockAdjustment}>
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
              <Option value="semi_finished_material">Bahan Setengah Jadi</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="itemId"
            label="Pilih Item"
            rules={[{ required: true, message: "Item wajib dipilih" }]}
          >
            <Select placeholder="Pilih item" showSearch optionFilterProp="children">
              {availableItems.map((item) => (
                <Option key={item.id} value={item.id}>
                  {item.name} - Stok: {formatNumberId(getItemStockSnapshot(item).currentStock)} {item.stockUnit || item.unit || ""}
                </Option>
              ))}
            </Select>
          </Form.Item>

          {selectedItemHasVariants ? (
            <Form.Item
              name="variantKey"
              label={selectedItem?.variantLabel || "Varian"}
              rules={[{ required: true, message: "Varian wajib dipilih untuk item bervarian" }]}
              extra="Item ini bervarian. Penyesuaian stok wajib masuk ke varian yang dipilih, bukan ke master/default."
            >
              <Select placeholder="Pilih varian" showSearch optionFilterProp="children">
                {variantOptions.map((variantOption) => (
                  <Option key={variantOption.value} value={variantOption.value}>
                    {variantOption.label} - Stok: {formatNumberId(variantOption.raw?.currentStock || 0)}
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
                  ? `Stok varian terpilih: ${formatNumberId(stockPreview)} ${selectedItem.stockUnit || selectedItem.unit || ""}`
                  : `Stok master saat ini: ${formatNumberId(stockPreview)} ${selectedItem.stockUnit || selectedItem.unit || ""}`
              }
            />
          ) : null}

          <Form.Item
            name="adjustmentType"
            label="Tipe Penyesuaian"
            rules={[{ required: true, message: "Tipe penyesuaian wajib dipilih" }]}
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
