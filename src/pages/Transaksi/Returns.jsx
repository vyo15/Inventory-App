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
import { collection, doc, onSnapshot, runTransaction, Timestamp } from "firebase/firestore";
import dayjs from "dayjs";
import { db } from "../../firebase";
import PageHeader from "../../components/Layout/Page/PageHeader";
import PageSection from "../../components/Layout/Page/PageSection";
import {
  buildInventoryLogPayload,
  INVENTORY_LOG_COLLECTION,
} from "../../services/Inventory/inventoryLogService";
import {
  applyStockMutationToItem,
  buildVariantOptionsFromItem,
  findVariantByKey,
  getItemStockSnapshot,
  inferHasVariants,
} from "../../utils/variants/variantStockHelpers";
import { formatNumberId, parseIntegerIdInput } from "../../utils/formatters/numberId";


// IMS NOTE [AKTIF/GUARDED] - Standar input angka bulat
// Fungsi blok: mengarahkan InputNumber aktif ke step 1, precision 0, dan parser integer Indonesia.
// Hubungan flow: hanya membatasi input/display UI; service calculation stok, kas, HPP, payroll, dan report tidak diubah.
// Alasan logic: IMS operasional memakai angka tanpa desimal, sementara data lama decimal tidak dimigrasi otomatis.
// Behavior: input baru no-decimal; business rules dan schema Firestore tetap sama.

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
  // SECTION: Submit loading guard
  // AKTIF + GUARDED:
  // - mencegah user menekan Simpan Retur berkali-kali saat transaction masih berjalan;
  // - menjaga satu klik submit tidak membuat double stock atau double inventory log.
  // =========================
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

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
  // AKTIF + GUARDED:
  // - flow ini adalah jalur resmi retur yang menambah stok kembali;
  // - dokumen retur, update stok, dan inventory log wajib commit bersama dalam Firestore transaction;
  // - tidak memakai addInventoryLog/updateInventoryStock langsung agar tidak ada stok berubah tanpa audit log.
  // LEGACY:
  // - flow lama melakukan update stok lebih dulu, lalu addDoc returns, lalu addInventoryLog; jika addDoc/log gagal, stok bisa sudah berubah.
  // CLEANUP CANDIDATE:
  // - jika nanti ada service khusus retur, orkestrasi transaction ini bisa dipindah dari page ke service tanpa mengubah business rule.
  // =========================
  const handleSubmitReturn = async (values) => {
    if (isSubmittingReturn) return;

    setIsSubmittingReturn(true);

    try {
      const { type, itemId, quantity, date, note, variantKey } = values;
      const collectionName = type === "product" ? "products" : "raw_materials";
      const normalizedQuantity = Number(quantity || 0);
      const normalizedNote = String(note || "").trim();

      // =========================
      // SECTION: Validasi awal sebelum write pertama
      // AKTIF + GUARDED:
      // - memastikan data wajib valid sebelum Firestore transaction dibuat;
      // - menjaga retur tidak menghasilkan dokumen/log/stok dengan item, tanggal, atau qty kosong;
      // - validasi ini tidak mengubah business rule retur, hanya mencegah partial write dan data rusak.
      // =========================
      if (!type || !["product", "material"].includes(type)) {
        message.error("Jenis item retur tidak valid.");
        return;
      }

      if (!itemId) {
        message.error("Item retur wajib dipilih.");
        return;
      }

      if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
        message.error("Jumlah retur harus lebih dari 0.");
        return;
      }

      if (!date?.toDate || !dayjs(date.toDate()).isValid()) {
        message.error("Tanggal retur tidak valid.");
        return;
      }

      const item = allItems.find((sourceItem) => sourceItem.id === itemId);

      if (!item) {
        message.error("Item tidak ditemukan");
        return;
      }

      if (inferHasVariants(item) && !variantKey) {
        message.error("Pilih varian item terlebih dahulu agar retur masuk ke stok varian yang benar.");
        return;
      }

      const returnReference = doc(collection(db, "returns"));
      const itemReference = doc(db, collectionName, itemId);
      const inventoryLogReference = doc(collection(db, INVENTORY_LOG_COLLECTION));
      const returnTimestamp = Timestamp.fromDate(date.toDate());

      await runTransaction(db, async (transaction) => {
        const itemDocument = await transaction.get(itemReference);

        if (!itemDocument.exists()) {
          throw new Error("Item stok tidak ditemukan. Retur dibatalkan agar stok dan log tidak partial.");
        }

        const latestItem = {
          id: itemDocument.id,
          ...itemDocument.data(),
        };
        const latestItemName = latestItem?.name || item?.name || "Item tanpa nama";
        const latestItemHasVariants = inferHasVariants(latestItem);
        const selectedVariant = latestItemHasVariants
          ? findVariantByKey(latestItem, variantKey)
          : null;

        // =========================
        // SECTION: Validasi ulang varian di dalam transaction
        // AKTIF + GUARDED:
        // - membaca item terbaru dari Firestore, bukan hanya state UI;
        // - mencegah retur masuk ke master/default ketika item sebenarnya bervarian;
        // - menjaga stock/currentStock/availableStock varian tetap sinkron lewat helper final.
        // =========================
        if (latestItemHasVariants && !variantKey) {
          throw new Error("Item memiliki varian. Pilih varian agar stok retur masuk ke sumber yang benar.");
        }

        if (latestItemHasVariants && !selectedVariant) {
          throw new Error("Varian item tidak ditemukan. Retur dibatalkan agar stok tidak masuk ke master/default.");
        }

        const stockSnapshotBefore = selectedVariant
          ? getItemStockSnapshot(selectedVariant)
          : getItemStockSnapshot(latestItem);
        const stockUpdatePayload = applyStockMutationToItem({
          item: latestItem,
          variantKey: selectedVariant?.variantKey || "",
          deltaCurrent: normalizedQuantity,
        });
        const currentStockAfter = stockSnapshotBefore.currentStock + normalizedQuantity;
        const availableStockAfter = currentStockAfter - stockSnapshotBefore.reservedStock;
        const variantPayload = {
          variantKey: selectedVariant?.variantKey || "",
          variantLabel: selectedVariant?.variantLabel || "",
          stockSourceType: selectedVariant ? "variant" : "master",
        };

        // =========================
        // SECTION: Commit atomik retur + stok + inventory log
        // AKTIF + GUARDED:
        // - ketiga write ini berada dalam satu Firestore transaction;
        // - jika salah satu gagal, tidak ada stok berubah tanpa dokumen retur/log;
        // - inventory log memakai buildInventoryLogPayload agar schema audit sama dengan writer aktif lain.
        // =========================
        transaction.set(returnReference, {
          type,
          itemId,
          itemName: latestItemName,
          quantity: normalizedQuantity,
          note: normalizedNote,
          date: returnTimestamp,
          ...variantPayload,
        });

        transaction.update(itemReference, stockUpdatePayload);

        transaction.set(
          inventoryLogReference,
          buildInventoryLogPayload({
            itemId,
            itemName: latestItemName,
            quantityChange: normalizedQuantity,
            type: "return_in",
            collectionName,
            timestamp: Timestamp.now(),
            extraData: {
              returnId: returnReference.id,
              referenceId: returnReference.id,
              referenceType: "return",
              note: normalizedNote,
              currentStockBefore: stockSnapshotBefore.currentStock,
              currentStockAfter,
              previousStock: stockSnapshotBefore.currentStock,
              newStock: currentStockAfter,
              reservedStockBefore: stockSnapshotBefore.reservedStock,
              reservedStockAfter: stockSnapshotBefore.reservedStock,
              availableStockBefore: stockSnapshotBefore.availableStock,
              availableStockAfter,
              ...variantPayload,
            },
          }),
        );
      });

      message.success("Retur berhasil ditambahkan!");
      resetReturnFormState();
    } catch (error) {
      console.error(error);
      message.error(error?.message || "Gagal menyimpan retur");
    } finally {
      setIsSubmittingReturn(false);
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
        confirmLoading={isSubmittingReturn}
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
            <InputNumber min={1} step={1} precision={0} parser={parseIntegerIdInput} style={{ width: "100%" }} />
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
